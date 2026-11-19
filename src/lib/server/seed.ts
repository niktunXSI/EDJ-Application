import "server-only";
import { ALERT_KEYS, type AlertSettings } from "@/lib/domain";
import { addDays, isWeekend, todayIso } from "@/lib/dates";
import { config } from "./config";
import type { Queryable } from "./db";
import {
  seedAccounts,
  seedAdvisor,
  seedBanks,
  seedClients,
  seedGoals,
  seedHousehold,
  seedLetters,
  seedSecurities,
  seedThreads,
  type SeedAccount,
} from "./seed-data";

type RunInTransaction = <T>(fn: (tx: Queryable) => Promise<T>) => Promise<T>;

const SEED_LOCK_ID = 7272743;

/** Seeds the demo household the first time the app starts against an empty database. */
export async function initialiseData(runInTransaction: RunInTransaction) {
  if (!config.seedOnEmpty) return;
  await runInTransaction(async (tx) => {
    await tx.query("select pg_advisory_xact_lock($1)", [SEED_LOCK_ID]);
    const [{ count }] = await tx.query<{ count: number }>("select count(*)::int as count from households");
    if (count === 0) await insertDemoData(tx, todayIso());
  });
}

/** Deletes everything and re-seeds the demo household, dated relative to `today`. */
export async function resetDemoData(tx: Queryable, today = todayIso()) {
  await tx.query("select pg_advisory_xact_lock($1)", [SEED_LOCK_ID]);
  await tx.query("delete from households");
  await tx.query("delete from advisors");
  await tx.query("delete from securities");
  await insertDemoData(tx, today);
}

// ---------------------------------------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number) {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const round = (value: number, places = 2) => Math.round(value * 10 ** places) / 10 ** places;

function nextBusinessDay(date: string) {
  let d = date;
  while (isWeekend(d)) d = addDays(d, 1);
  return d;
}

function lastBusinessDayOfMonth(year: number, month: number) {
  let d = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
  while (isWeekend(d)) d = addDays(d, -1);
  return d;
}

function ymd(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

async function insertRows(tx: Queryable, table: string, columns: string[], rows: unknown[][]) {
  const perChunk = Math.floor(30_000 / columns.length);
  for (let i = 0; i < rows.length; i += perChunk) {
    const chunk = rows.slice(i, i + perChunk);
    const params: unknown[] = [];
    const tuples = chunk.map((row) => {
      const placeholders = row.map((value) => {
        params.push(value);
        return `$${params.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });
    await tx.query(`insert into ${table} (${columns.join(", ")}) values ${tuples.join(", ")}`, params);
  }
}

interface Holding {
  accountId: string;
  symbol: string;
  quantity: number;
  costBasis: number;
}

interface Txn {
  id?: string;
  accountId: string;
  tradeDate: string;
  type: string;
  description: string;
  symbol?: string;
  quantity?: number;
  price?: number;
  amount: number;
  taxYear?: number;
  confirm?: boolean;
}

const priceOf = new Map(seedSecurities.map((s) => [s.symbol, s]));
const nameOf = (symbol: string) => priceOf.get(symbol)?.name ?? symbol;

/** A plausible historical price: today's price less roughly 9% a year of drift. */
function historicalPrice(symbol: string, today: string, date: string) {
  const current = priceOf.get(symbol)!.price;
  const years = daysBetween(date, today) / 365;
  const drift = priceOf.get(symbol)!.assetClass === "fixed_income" ? 0.01 : 0.09;
  return round(current / (1 + drift) ** years, 4);
}

function buildHoldings(): Holding[] {
  const rand = mulberry32(42);
  const holdings: Holding[] = [];
  for (const account of seedAccounts) {
    const invested = account.targetValue - account.cashBalance;
    for (const [symbol, weight] of account.allocation) {
      const price = priceOf.get(symbol)!.price;
      const decimals = priceOf.get(symbol)!.type === "stock" || priceOf.get(symbol)!.type === "etf" ? 0 : 3;
      const quantity = round((invested * weight) / price, decimals);
      const gainFactor = 0.72 + rand() * 0.3;
      holdings.push({ accountId: account.id, symbol, quantity, costBasis: round(quantity * price * gainFactor) });
    }
  }
  return holdings;
}

function accountValue(account: SeedAccount, holdings: Holding[], field: "price" | "previousClose") {
  return (
    account.cashBalance +
    holdings
      .filter((h) => h.accountId === account.id)
      .reduce((sum, h) => sum + h.quantity * priceOf.get(h.symbol)![field], 0)
  );
}

function buildTransactions(today: string, holdings: Holding[]): Txn[] {
  const year = Number(today.slice(0, 4));
  const start = `${year - 1}-01-01`;
  const txns: Txn[] = [];
  const add = (txn: Txn) => {
    if (txn.tradeDate >= start && txn.tradeDate <= today) txns.push(txn);
  };
  const buy = (accountId: string, symbol: string, date: string, amount: number, confirm = false) => {
    const price = historicalPrice(symbol, today, date);
    add({
      accountId,
      tradeDate: date,
      type: "buy",
      description: `Bought ${nameOf(symbol)}`,
      symbol,
      quantity: round(amount / price, 3),
      price,
      amount: -round(amount),
      confirm,
    });
  };
  const sell = (accountId: string, symbol: string, date: string, amount: number) => {
    const price = historicalPrice(symbol, today, date);
    add({
      accountId,
      tradeDate: date,
      type: "sell",
      description: `Sold ${nameOf(symbol)}`,
      symbol,
      quantity: -round(amount / price, 3),
      price,
      amount: round(amount),
      confirm: true,
    });
  };

  for (const y of [year - 1, year]) {
    for (let m = 0; m < 12; m++) {
      // Simran's Roth IRA: $500 on the 5th from checking, invested the next business day.
      const rothDate = nextBusinessDay(ymd(y, m, 5));
      add({
        accountId: "ACC-2215",
        tradeDate: rothDate,
        type: "contribution",
        description: `Contribution from Lakeside Credit Union ••6612 — tax year ${y}`,
        amount: 500,
        taxYear: y,
      });
      buy("ACC-2215", "MGRFX", nextBusinessDay(addDays(rothDate, 1)), 500);

      // Maya's 529: $250 a month, raised to $300 at the annual review.
      const eduDate = nextBusinessDay(ymd(y, m, 15));
      const eduAmount = daysBetween(eduDate, today) <= 45 ? 300 : 250;
      add({
        accountId: "ACC-5530",
        tradeDate: eduDate,
        type: "contribution",
        description: `Contribution from Lakeside Credit Union ••6612 — tax year ${y}`,
        amount: eduAmount,
        taxYear: y,
      });
      buy("ACC-5530", m % 2 === 0 ? "EDGRX" : "EDBLX", nextBusinessDay(addDays(eduDate, 1)), eduAmount);

      // Joint account: $1,000 monthly deposit.
      add({
        accountId: "ACC-4471",
        tradeDate: nextBusinessDay(ymd(y, m, 1)),
        type: "transfer_in",
        description: "Deposit from Lakeside Credit Union ••6612",
        amount: 1000,
      });

      // Money market sweep interest.
      for (const account of seedAccounts.filter((a) => a.cashBalance > 1000)) {
        add({
          accountId: account.id,
          tradeDate: lastBusinessDayOfMonth(y, m),
          type: "interest",
          description: "Interest — Edward Jones Money Market sweep",
          amount: round((account.cashBalance * 0.042) / 12),
        });
      }

      // Quarterly dividends and the advisory fee.
      if (m % 3 === 2) {
        const payDate = nextBusinessDay(ymd(y, m, 20));
        for (const h of holdings) {
          const security = priceOf.get(h.symbol)!;
          if (security.dividendYield === 0 || h.accountId === "ACC-5530") continue;
          add({
            accountId: h.accountId,
            tradeDate: payDate,
            type: "dividend",
            description: `Dividend — ${security.name}`,
            symbol: h.symbol,
            amount: round((h.quantity * security.price * security.dividendYield) / 4),
          });
        }
      }
      if (m % 3 === 0) {
        add({
          accountId: "ACC-4471",
          tradeDate: nextBusinessDay(ymd(y, m, 2)),
          type: "fee",
          description: "Quarterly advisory program fee",
          amount: -round((186_000 * 0.0125) / 4),
        });
      }
    }
  }

  // A prior-year Roth contribution made before the April filing deadline.
  const priorYearRoth = nextBusinessDay(ymd(year, 2, 12));
  add({
    accountId: "ACC-2215",
    tradeDate: priorYearRoth,
    type: "contribution",
    description: `Contribution from Cascade Federal Savings ••0937 — tax year ${year - 1}`,
    amount: 2000,
    taxYear: year - 1,
  });
  buy("ACC-2215", "PTMK", nextBusinessDay(addDays(priorYearRoth, 1)), 2000);

  // Arjun contributes in lump sums.
  const arjun: Array<[string, number, number]> = [
    [nextBusinessDay(ymd(year - 1, 3, 10)), 7000, year - 1],
    [nextBusinessDay(ymd(year, 1, 14)), 4000, year],
    [nextBusinessDay(ymd(year, 8, 3)), 1500, year],
  ];
  for (const [date, amount, taxYear] of arjun) {
    add({
      accountId: "ACC-3092",
      tradeDate: date,
      type: "contribution",
      description: `Contribution from Lakeside Credit Union ••6612 — tax year ${taxYear}`,
      amount,
      taxYear,
    });
    buy("ACC-3092", "PTMK", nextBusinessDay(addDays(date, 1)), amount);
  }

  // Simran also funds her Traditional IRA; it shares one annual limit with her Roth IRA.
  const traditionalDate = nextBusinessDay(ymd(year, 3, 14));
  add({
    accountId: "ACC-2208",
    tradeDate: traditionalDate,
    type: "contribution",
    description: `Contribution from Lakeside Credit Union ••6612 — tax year ${year}`,
    amount: 1000,
    taxYear: year,
  });
  buy("ACC-2208", "HCBAX", nextBusinessDay(addDays(traditionalDate, 1)), 1000);

  // The 401(k) rollover into Simran's Traditional IRA, then its investment.
  const rolloverDate = nextBusinessDay(addDays(today, -610));
  add({
    accountId: "ACC-2208",
    tradeDate: rolloverDate,
    type: "rollover",
    description: "Direct rollover from Columbia Ridge Manufacturing 401(k) Plan",
    amount: 185_000,
  });
  const investDate = nextBusinessDay(addDays(rolloverDate, 3));
  buy("ACC-2208", "MGRFX", investDate, 55_000, true);
  buy("ACC-2208", "HCBAX", investDate, 70_000, true);
  buy("ACC-2208", "GHFAX", investDate, 35_000, true);
  buy("ACC-2208", "UST31", investDate, 25_000, true);

  // Discretionary trades.
  sell("ACC-4471", "CSCD", nextBusinessDay(addDays(today, -270)), 8_400);
  buy("ACC-4471", "NWND", nextBusinessDay(addDays(today, -268)), 8_000, true);
  buy("ACC-4471", "BRLN", nextBusinessDay(addDays(today, -150)), 5_000, true);
  sell("ACC-2208", "LCVAX", nextBusinessDay(addDays(today, -24)), 12_000);
  buy("ACC-2208", "HCBAX", nextBusinessDay(addDays(today, -24)), 12_000, true);

  txns.sort((a, b) => (a.tradeDate === b.tradeDate ? a.accountId.localeCompare(b.accountId) : a.tradeDate.localeCompare(b.tradeDate)));
  txns.forEach((t, i) => (t.id = `TX-${String(10001 + i)}`));
  return txns;
}

function tradingDays(from: string, to: string) {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (!isWeekend(d)) days.push(d);
  return days;
}

/** Walks each account's value backwards from today's market value through synthetic daily returns. */
function buildValueHistory(today: string, holdings: Holding[], txns: Txn[]) {
  const days = tradingDays(addDays(today, -3 * 365 - 7), today);
  const rand = mulberry32(7);
  const market = days.map(() => gaussian(rand));
  const rows: unknown[][] = [];

  for (const account of seedAccounts) {
    const flows = new Map<string, number>();
    for (const t of txns) {
      if (t.accountId !== account.id) continue;
      if (["contribution", "transfer_in", "rollover", "transfer_out", "withdrawal", "fee"].includes(t.type)) {
        flows.set(t.tradeDate, (flows.get(t.tradeDate) ?? 0) + t.amount);
      }
    }
    const current = accountValue(account, holdings, "price");
    const previous = accountValue(account, holdings, "previousClose");
    const values = new Array<number>(days.length);
    values[days.length - 1] = current;
    if (days.length > 1) values[days.length - 2] = previous;
    for (let i = days.length - 2; i > 0; i--) {
      const r = 0.00034 + account.volatility * (0.85 * market[i] + 0.5 * gaussian(rand));
      const prior = values[i] / (1 + r) - (flows.get(days[i]) ?? 0);
      values[i - 1] = Math.max(prior, 1000);
    }
    days.forEach((day, i) => rows.push([account.id, day, round(values[i])]));
  }
  return rows;
}

async function insertDemoData(tx: Queryable, today: string) {
  const year = Number(today.slice(0, 4));
  const holdings = buildHoldings();
  const txns = buildTransactions(today, holdings);
  const history = buildValueHistory(today, holdings, txns);

  await insertRows(
    tx,
    "advisors",
    ["id", "name", "title", "branch", "address_line", "city", "state", "phone", "email"],
    [[seedAdvisor.id, seedAdvisor.name, seedAdvisor.title, seedAdvisor.branch, seedAdvisor.addressLine, seedAdvisor.city, seedAdvisor.state, seedAdvisor.phone, seedAdvisor.email]],
  );
  await insertRows(
    tx,
    "households",
    ["id", "name", "advisor_id", "segment", "client_since", "service_team"],
    [[seedHousehold.id, seedHousehold.name, seedAdvisor.id, seedHousehold.segment, seedHousehold.clientSince, JSON.stringify(seedHousehold.serviceTeam)]],
  );
  await insertRows(
    tx,
    "clients",
    ["id", "household_id", "first_name", "last_name", "date_of_birth", "email", "phone", "address_line", "city", "state", "postal_code", "is_primary"],
    seedClients.map((c) => [c.id, seedHousehold.id, c.firstName, c.lastName, c.dateOfBirth, c.email, c.phone, c.addressLine, c.city, c.state, c.postalCode, c.isPrimary]),
  );
  await insertRows(
    tx,
    "securities",
    ["symbol", "name", "asset_class", "security_type", "price", "previous_close", "dividend_yield"],
    seedSecurities.map((s) => [s.symbol, s.name, s.assetClass, s.type, s.price, s.previousClose, s.dividendYield]),
  );
  await insertRows(
    tx,
    "accounts",
    ["id", "household_id", "owner_client_id", "account_number", "nickname", "account_type", "registration", "objective", "is_advisory", "beneficiary_name", "cash_balance", "opened_on", "sort_order"],
    seedAccounts.map((a, i) => [a.id, seedHousehold.id, a.ownerClientId, a.accountNumber, a.nickname, a.type, a.registration, a.objective, a.isAdvisory, a.beneficiaryName, a.cashBalance, a.openedOn, i]),
  );
  await insertRows(
    tx,
    "holdings",
    ["account_id", "symbol", "quantity", "cost_basis"],
    holdings.map((h) => [h.accountId, h.symbol, h.quantity, h.costBasis]),
  );
  await insertRows(tx, "account_values", ["account_id", "as_of", "market_value"], history);
  await insertRows(
    tx,
    "transactions",
    ["id", "account_id", "trade_date", "settle_date", "activity_type", "description", "symbol", "quantity", "price", "amount", "tax_year"],
    txns.map((t) => [
      t.id,
      t.accountId,
      t.tradeDate,
      t.type === "buy" || t.type === "sell" ? nextBusinessDay(addDays(t.tradeDate, 1)) : t.tradeDate,
      t.type,
      t.description,
      t.symbol ?? null,
      t.quantity ?? null,
      t.price ?? null,
      t.amount,
      t.taxYear ?? null,
    ]),
  );
  await insertRows(
    tx,
    "linked_bank_accounts",
    ["id", "household_id", "bank_name", "account_kind", "last_four", "verified_on"],
    seedBanks.map((b) => [b.id, seedHousehold.id, b.bankName, b.accountKind, b.lastFour, b.verifiedOn]),
  );

  const nextMonthly = (day: number) => {
    let date = ymd(year, Number(today.slice(5, 7)) - 1, day);
    if (date <= today) date = ymd(year, Number(today.slice(5, 7)), day);
    return date;
  };
  await insertRows(
    tx,
    "money_movements",
    ["id", "household_id", "kind", "from_account_id", "to_account_id", "bank_account_id", "amount", "frequency", "scheduled_for", "status", "memo", "requested_by", "created_at"],
    [
      ["MM-5101", seedHousehold.id, "deposit", null, "ACC-2215", "BANK-6612", 500, "monthly", nextMonthly(5), "scheduled", "Roth IRA monthly contribution", "Simran Kaur", "2023-01-03T17:12:00Z"],
      ["MM-5102", seedHousehold.id, "deposit", null, "ACC-5530", "BANK-6612", 300, "monthly", nextMonthly(15), "scheduled", "Maya's college savings", "Grace Lindqvist", `${addDays(today, -23)}T19:40:00Z`],
      ["MM-5103", seedHousehold.id, "deposit", null, "ACC-4471", "BANK-6612", 1000, "monthly", nextMonthly(1), "scheduled", null, "Simran Kaur", "2021-06-01T15:02:00Z"],
      ["MM-5100", seedHousehold.id, "internal", "ACC-4471", "ACC-3092", null, 1500, "once", nextBusinessDay(ymd(year, 8, 3)), "completed", "Arjun Roth top-up", "Arjun Singh", `${ymd(year, 8, 2)}T14:21:00Z`],
    ].filter((row) => (row[9] === "completed" ? (row[8] as string) <= today : true)),
  );

  const docs: unknown[][] = [];
  const pushDoc = (
    category: string,
    title: string,
    issuedOn: string,
    extra: { accountId?: string; periodStart?: string; periodEnd?: string; taxYear?: number; pages?: number; transactionId?: string } = {},
  ) => {
    if (issuedOn > today) return;
    const viewed = daysBetween(issuedOn, today) > 30 ? `${addDays(issuedOn, 2)}T16:00:00Z` : null;
    docs.push([
      `DOC-${String(70001 + docs.length)}`,
      seedHousehold.id,
      extra.accountId ?? null,
      category,
      title,
      extra.periodStart ?? null,
      extra.periodEnd ?? null,
      extra.taxYear ?? null,
      issuedOn,
      extra.pages ?? 1,
      extra.transactionId ?? null,
      viewed,
    ]);
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  for (let back = 12; back >= 1; back--) {
    const ref = new Date(Date.UTC(year, Number(today.slice(5, 7)) - 1 - back, 1));
    const y = ref.getUTCFullYear();
    const m = ref.getUTCMonth();
    const periodEnd = ymd(y, m + 1, 0);
    pushDoc("statement", `Monthly statement — ${monthNames[m]} ${y}`, nextBusinessDay(ymd(y, m + 1, 4)), {
      periodStart: ymd(y, m, 1),
      periodEnd,
      pages: 9 + (m % 4),
    });
    if (m % 3 === 2) {
      pushDoc("report", `Quarterly performance report — Q${(m + 1) / 3} ${y}`, nextBusinessDay(ymd(y, m + 1, 12)), {
        periodStart: ymd(y, m - 2, 1),
        periodEnd,
        pages: 6,
      });
    }
  }

  const taxYear = year - 1;
  pushDoc("tax", `${taxYear} Form 1099 Composite — Joint Investment Account`, nextBusinessDay(ymd(year, 1, 14)), {
    accountId: "ACC-4471",
    taxYear,
    pages: 7,
  });
  for (const account of seedAccounts.filter((a) => a.type === "traditional_ira" || a.type === "roth_ira")) {
    pushDoc("tax", `${taxYear} Form 5498 — ${account.nickname}`, nextBusinessDay(ymd(year, 4, 29)), {
      accountId: account.id,
      taxYear,
      pages: 1,
    });
  }

  for (const t of txns.filter((t) => t.confirm)) {
    const verb = t.type === "buy" ? "Bought" : "Sold";
    pushDoc("confirmation", `Trade confirmation — ${verb} ${t.symbol}`, nextBusinessDay(addDays(t.tradeDate, 1)), {
      accountId: t.accountId,
      transactionId: t.id,
      pages: 2,
    });
  }
  for (const letter of seedLetters) {
    pushDoc("letter", letter.title, addDays(today, -letter.daysAgo), { pages: letter.pages });
  }

  await insertRows(
    tx,
    "documents",
    ["id", "household_id", "account_id", "category", "title", "period_start", "period_end", "tax_year", "issued_on", "page_count", "transaction_id", "viewed_at"],
    docs,
  );

  await insertRows(
    tx,
    "goals",
    ["id", "household_id", "name", "goal_type", "target_amount", "target_date", "monthly_contribution", "assumed_return", "account_ids"],
    seedGoals.map((g) => [g.id, seedHousehold.id, g.name, g.type, g.targetAmount, g.targetDate, g.monthlyContribution, g.assumedReturn, g.accountIds]),
  );

  const now = Date.now();
  const threadRows: unknown[][] = [];
  const messageRows: unknown[][] = [];
  for (const thread of seedThreads) {
    const sentTimes = thread.messages.map((m, i) => new Date(now - m.daysAgo * 86_400_000 - (3 - i) * 3_600_000).toISOString());
    threadRows.push([thread.id, seedHousehold.id, thread.subject, sentTimes[0], sentTimes[sentTimes.length - 1]]);
    thread.messages.forEach((m, i) => {
      messageRows.push([
        `${thread.id}-${i + 1}`,
        thread.id,
        m.sender,
        m.author,
        m.body,
        sentTimes[i],
        m.unread ? null : new Date(Date.parse(sentTimes[i]) + 3_600_000).toISOString(),
      ]);
    });
  }
  await insertRows(tx, "message_threads", ["id", "household_id", "subject", "created_at", "last_message_at"], threadRows);
  await insertRows(tx, "messages", ["id", "thread_id", "sender", "author_name", "body", "sent_at", "read_at"], messageRows);

  await insertRows(
    tx,
    "preferences",
    ["household_id", "paperless_statements", "paperless_tax_documents", "paperless_confirmations", "alerts"],
    [[seedHousehold.id, true, true, false, JSON.stringify(defaultAlerts())]],
  );
}

export function defaultAlerts(): AlertSettings {
  const alerts = {} as AlertSettings;
  for (const key of ALERT_KEYS) {
    alerts[key] = { email: true, text: key === "money_movement" || key === "large_withdrawals" };
  }
  return alerts;
}