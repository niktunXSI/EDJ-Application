import type { AccountType, AssetClass } from "@/lib/domain";

// Every person, address, account, security, and figure below is fictional.

export const seedAdvisor = {
  id: "ADV-205",
  name: "Grace Lindqvist",
  title: "Financial Advisor",
  branch: "Bend Westside Branch",
  addressLine: "1020 NW Galveston Ave, Suite 110",
  city: "Bend",
  state: "OR",
  phone: "(541) 555-0187",
  email: "grace.lindqvist@example.com",
};

export const seedHousehold = {
  id: "HH-3113",
  name: "Kaur Household",
  segment: "Established",
  clientSince: "2020-09-14",
  serviceTeam: [
    { name: "Grace Lindqvist", role: "Financial Advisor", phone: "(541) 555-0187" },
    { name: "Erin Matsuda", role: "Senior Branch Office Administrator", phone: "(541) 555-0188" },
  ],
};

export const seedClients = [
  {
    id: "CL-1",
    firstName: "Simran",
    lastName: "Kaur",
    dateOfBirth: "1975-03-08",
    email: "simran.kaur@example.com",
    phone: "(503) 555-0142",
    addressLine: "1847 NW Hoyt Street",
    city: "Portland",
    state: "OR",
    postalCode: "97209",
    isPrimary: true,
  },
  {
    id: "CL-2",
    firstName: "Arjun",
    lastName: "Singh",
    dateOfBirth: "1979-10-21",
    email: "arjun.singh@example.com",
    phone: "(503) 555-0163",
    addressLine: "1847 NW Hoyt Street",
    city: "Portland",
    state: "OR",
    postalCode: "97209",
    isPrimary: false,
  },
];

export interface SeedSecurity {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  type: "stock" | "etf" | "mutual_fund" | "bond" | "money_market" | "portfolio";
  price: number;
  previousClose: number;
  dividendYield: number;
}

export const seedSecurities: SeedSecurity[] = [
  { symbol: "MGRFX", name: "Meridian Growth Fund A", assetClass: "us_equity", type: "mutual_fund", price: 68.42, previousClose: 67.95, dividendYield: 0.006 },
  { symbol: "LCVAX", name: "Lakeshore Capital Value Fund A", assetClass: "us_equity", type: "mutual_fund", price: 41.18, previousClose: 41.02, dividendYield: 0.018 },
  { symbol: "PTMK", name: "Pinnacle Total Market ETF", assetClass: "us_equity", type: "etf", price: 284.37, previousClose: 282.1, dividendYield: 0.013 },
  { symbol: "NWND", name: "Northwind Industries Inc.", assetClass: "us_equity", type: "stock", price: 142.65, previousClose: 144.1, dividendYield: 0.021 },
  { symbol: "CSCD", name: "Cascade Health Systems Corp.", assetClass: "us_equity", type: "stock", price: 96.3, previousClose: 95.12, dividendYield: 0.015 },
  { symbol: "BRLN", name: "Brightline Software Inc.", assetClass: "us_equity", type: "stock", price: 218.04, previousClose: 214.77, dividendYield: 0 },
  { symbol: "GHFAX", name: "Global Horizons Fund A", assetClass: "intl_equity", type: "mutual_fund", price: 52.76, previousClose: 52.9, dividendYield: 0.019 },
  { symbol: "EMOAX", name: "Emerging Markets Opportunity Fund A", assetClass: "intl_equity", type: "mutual_fund", price: 24.11, previousClose: 24.2, dividendYield: 0.022 },
  { symbol: "HCBAX", name: "Harborview Core Bond Fund A", assetClass: "fixed_income", type: "mutual_fund", price: 9.84, previousClose: 9.83, dividendYield: 0.041 },
  { symbol: "RIMAX", name: "Riverbend Intermediate Municipal Fund A", assetClass: "fixed_income", type: "mutual_fund", price: 10.62, previousClose: 10.61, dividendYield: 0.031 },
  { symbol: "UST31", name: "U.S. Treasury Note 4.125% 05/15/2031", assetClass: "fixed_income", type: "bond", price: 100.84, previousClose: 100.79, dividendYield: 0.041 },
  { symbol: "SREIX", name: "Summit Real Estate Income Fund A", assetClass: "real_estate", type: "mutual_fund", price: 18.45, previousClose: 18.31, dividendYield: 0.038 },
  { symbol: "EDGRX", name: "Education Growth Portfolio (529)", assetClass: "us_equity", type: "portfolio", price: 31.27, previousClose: 31.08, dividendYield: 0 },
  { symbol: "EDBLX", name: "Education Balanced Portfolio (529)", assetClass: "fixed_income", type: "portfolio", price: 22.64, previousClose: 22.61, dividendYield: 0 },
];

export interface SeedAccount {
  id: string;
  ownerClientId: string | null;
  accountNumber: string;
  nickname: string;
  type: AccountType;
  registration: string;
  objective: string;
  isAdvisory: boolean;
  beneficiaryName: string | null;
  openedOn: string;
  targetValue: number;
  cashBalance: number;
  /** Daily volatility used to generate the synthetic value history. */
  volatility: number;
  allocation: Array<[symbol: string, weight: number]>;
}

export const seedAccounts: SeedAccount[] = [
  {
    id: "ACC-4471",
    ownerClientId: null,
    accountNumber: "586-04471-1-2",
    nickname: "Joint Investment Account",
    type: "joint",
    registration: "Joint tenants with rights of survivorship",
    objective: "Growth & income",
    isAdvisory: true,
    beneficiaryName: null,
    openedOn: "2020-09-14",
    targetValue: 186_420,
    cashBalance: 9_842.17,
    volatility: 0.0085,
    allocation: [["PTMK", 0.3], ["NWND", 0.08], ["CSCD", 0.06], ["BRLN", 0.06], ["GHFAX", 0.12], ["RIMAX", 0.3], ["SREIX", 0.08]],
  },
  {
    id: "ACC-2208",
    ownerClientId: "CL-1",
    accountNumber: "586-02208-1-7",
    nickname: "Simran's Traditional IRA",
    type: "traditional_ira",
    registration: "Traditional IRA — Simran Kaur",
    objective: "Balanced growth",
    isAdvisory: false,
    beneficiaryName: "Arjun Singh (primary)",
    openedOn: "2021-02-03",
    targetValue: 412_880,
    cashBalance: 6_215.4,
    volatility: 0.0065,
    allocation: [["MGRFX", 0.25], ["LCVAX", 0.18], ["GHFAX", 0.12], ["EMOAX", 0.05], ["HCBAX", 0.25], ["UST31", 0.1], ["SREIX", 0.05]],
  },
  {
    id: "ACC-2215",
    ownerClientId: "CL-1",
    accountNumber: "586-02215-1-4",
    nickname: "Simran's Roth IRA",
    type: "roth_ira",
    registration: "Roth IRA — Simran Kaur",
    objective: "Long-term growth",
    isAdvisory: false,
    beneficiaryName: "Arjun Singh (primary)",
    openedOn: "2020-10-01",
    targetValue: 68_940,
    cashBalance: 1_412.33,
    volatility: 0.0105,
    allocation: [["MGRFX", 0.45], ["PTMK", 0.28], ["EMOAX", 0.1], ["GHFAX", 0.17]],
  },
  {
    id: "ACC-3092",
    ownerClientId: "CL-2",
    accountNumber: "586-03092-1-9",
    nickname: "Arjun's Roth IRA",
    type: "roth_ira",
    registration: "Roth IRA — Arjun Singh",
    objective: "Long-term growth",
    isAdvisory: false,
    beneficiaryName: "Simran Kaur (primary)",
    openedOn: "2020-10-01",
    targetValue: 54_310,
    cashBalance: 2_088.91,
    volatility: 0.0112,
    allocation: [["PTMK", 0.52], ["BRLN", 0.1], ["GHFAX", 0.2], ["HCBAX", 0.18]],
  },
  {
    id: "ACC-5530",
    ownerClientId: "CL-1",
    accountNumber: "586-05530-1-1",
    nickname: "Maya's 529 Education Savings",
    type: "education_529",
    registration: "529 plan — owner Simran Kaur, beneficiary Maya Singh",
    objective: "Age-based (enrollment 2032)",
    isAdvisory: false,
    beneficiaryName: "Maya Singh (plan beneficiary)",
    openedOn: "2021-01-11",
    targetValue: 38_760,
    cashBalance: 645.02,
    volatility: 0.0068,
    allocation: [["EDGRX", 0.57], ["EDBLX", 0.43]],
  },
];

export const seedBanks = [
  { id: "BANK-6612", bankName: "Lakeside Credit Union", accountKind: "Checking", lastFour: "6612", verifiedOn: "2020-09-21" },
  { id: "BANK-0937", bankName: "Cascade Federal Savings", accountKind: "Savings", lastFour: "0937", verifiedOn: "2022-04-02" },
];

export const seedGoals = [
  {
    id: "GOAL-RET",
    name: "Retire at 66",
    type: "retirement" as const,
    targetAmount: 1_850_000,
    targetDate: "2041-06-30",
    monthlyContribution: 1_500,
    assumedReturn: 0.06,
    accountIds: ["ACC-2208", "ACC-2215", "ACC-3092", "ACC-4471"],
  },
  {
    id: "GOAL-EDU",
    name: "Maya's college",
    type: "education" as const,
    targetAmount: 140_000,
    targetDate: "2032-08-15",
    monthlyContribution: 300,
    assumedReturn: 0.055,
    accountIds: ["ACC-5530"],
  },
];

export interface SeedMessage {
  sender: "client" | "branch";
  author: string;
  body: string;
  daysAgo: number;
  unread?: boolean;
}

export const seedThreads: Array<{ id: string; subject: string; messages: SeedMessage[] }> = [
  {
    id: "MT-1003",
    subject: "Year-end planning checklist",
    messages: [
      {
        sender: "branch",
        author: "Grace Lindqvist",
        daysAgo: 2,
        unread: true,
        body:
          "Hi Simran and Arjun,\n\nAs we head into the last weeks of the year, here are a few items worth a look:\n\n" +
          "• Retirement contributions: if you plan to add more to your IRAs for this year, let me know and we can schedule it.\n" +
          "• The joint account has a few positions with losses we could harvest against this year's gains.\n" +
          "• Maya's 529 contributions may qualify for the Oregon state tax credit.\n\n" +
          "Happy to set up a short call. Just reply here.\n\nGrace",
      },
    ],
  },
  {
    id: "MT-1002",
    subject: "Annual review follow-up",
    messages: [
      {
        sender: "branch",
        author: "Grace Lindqvist",
        daysAgo: 23,
        body:
          "Thank you both for coming in for your annual review. As discussed, we rebalanced the Traditional IRA back to its 60/40 target and " +
          "increased the monthly 529 contribution to $300. Your retirement goal remains on track at the current savings rate.",
      },
      {
        sender: "client",
        author: "Simran Kaur",
        daysAgo: 22,
        body: "Thanks, Grace. Could you remind us when the next 529 contribution comes out of our checking account?",
      },
      {
        sender: "branch",
        author: "Erin Matsuda",
        daysAgo: 21,
        body: "Hi Simran, the 529 contribution runs on the 15th of each month from Lakeside Credit Union checking ending in 6612. You can see it under Transfers.",
      },
    ],
  },
  {
    id: "MT-1001",
    subject: "Rollover paperwork received",
    messages: [
      {
        sender: "branch",
        author: "Erin Matsuda",
        daysAgo: 610,
        body:
          "We received the rollover check from your former employer's retirement plan and deposited it to your Traditional IRA. " +
          "Grace will invest it according to the allocation you agreed on.",
      },
    ],
  },
];

export const seedLetters = [
  { title: "Annual privacy notice", daysAgo: 48, pages: 4 },
  { title: "Updated advisory fee schedule", daysAgo: 132, pages: 3 },
  { title: "Beneficiary review reminder", daysAgo: 260, pages: 1 },
];
