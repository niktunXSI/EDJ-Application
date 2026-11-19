export const ACCOUNT_TYPES = ["joint", "individual", "traditional_ira", "roth_ira", "education_529"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  joint: "Joint account",
  individual: "Individual account",
  traditional_ira: "Traditional IRA",
  roth_ira: "Roth IRA",
  education_529: "529 education savings",
};

export const RETIREMENT_ACCOUNT_TYPES: readonly AccountType[] = ["traditional_ira", "roth_ira"];

export const ASSET_CLASSES = ["us_equity", "intl_equity", "fixed_income", "real_estate", "cash"] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  us_equity: "U.S. stocks",
  intl_equity: "International stocks",
  fixed_income: "Bonds",
  real_estate: "Real estate",
  cash: "Cash & money market",
};

export const ASSET_CLASS_COLORS: Record<AssetClass, string> = {
  us_equity: "#1d4a37",
  intl_equity: "#4f8a6e",
  fixed_income: "#b38b3d",
  real_estate: "#8a6f9e",
  cash: "#c9c2b0",
};

export const ACTIVITY_TYPES = [
  "buy",
  "sell",
  "dividend",
  "interest",
  "contribution",
  "withdrawal",
  "transfer_in",
  "transfer_out",
  "fee",
  "rollover",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  buy: "Buy",
  sell: "Sell",
  dividend: "Dividend",
  interest: "Interest",
  contribution: "Contribution",
  withdrawal: "Withdrawal",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
  fee: "Advisory fee",
  rollover: "Rollover",
};

export const ACTIVITY_RANGES = ["30d", "90d", "ytd", "12m", "all"] as const;
export type ActivityRange = (typeof ACTIVITY_RANGES)[number];

export const ACTIVITY_RANGE_LABELS: Record<ActivityRange, string> = {
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  ytd: "Year to date",
  "12m": "Last 12 months",
  all: "All activity",
};

export const HISTORY_RANGES = ["1m", "3m", "ytd", "1y", "3y"] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];

export const HISTORY_RANGE_LABELS: Record<HistoryRange, string> = {
  "1m": "1M",
  "3m": "3M",
  ytd: "YTD",
  "1y": "1Y",
  "3y": "3Y",
};

export const MOVEMENT_KINDS = ["internal", "deposit", "withdrawal"] as const;
export type MovementKind = (typeof MOVEMENT_KINDS)[number];

export const MOVEMENT_KIND_LABELS: Record<MovementKind, string> = {
  internal: "Between Edward Jones accounts",
  deposit: "From a linked bank",
  withdrawal: "To a linked bank",
};

export const MOVEMENT_STATUSES = ["scheduled", "processing", "completed", "cancelled"] as const;
export type MovementStatus = (typeof MOVEMENT_STATUSES)[number];

export const MOVEMENT_STATUS_LABELS: Record<MovementStatus, string> = {
  scheduled: "Scheduled",
  processing: "Processing",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const FREQUENCIES = ["once", "monthly"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  once: "One time",
  monthly: "Monthly",
};

export const DOCUMENT_CATEGORIES = ["statement", "tax", "confirmation", "report", "letter"] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  statement: "Statements",
  tax: "Tax documents",
  confirmation: "Trade confirmations",
  report: "Performance reports",
  letter: "Letters & notices",
};

export const GOAL_TYPE_LABELS = {
  retirement: "Retirement",
  education: "Education",
  major_purchase: "Major purchase",
} as const;

export const ALERT_KEYS = ["statements", "trade_confirmations", "money_movement", "messages", "large_withdrawals"] as const;
export type AlertKey = (typeof ALERT_KEYS)[number];

export const ALERT_LABELS: Record<AlertKey, { label: string; description: string }> = {
  statements: { label: "New statements and tax documents", description: "When a statement or tax form is ready to view." },
  trade_confirmations: { label: "Trade confirmations", description: "When a buy or sell in any account settles." },
  money_movement: { label: "Transfers and contributions", description: "When money you scheduled moves or completes." },
  messages: { label: "Messages from your branch", description: "When your financial advisor or branch team replies." },
  large_withdrawals: { label: "Withdrawals over $5,000", description: "A security alert for large withdrawals to a bank." },
};

export const ALERT_CHANNELS = ["email", "text"] as const;
export type AlertChannel = (typeof ALERT_CHANNELS)[number];

export type AlertSettings = Record<AlertKey, Record<AlertChannel, boolean>>;

export function labelFor<T extends string>(labels: Record<T, string>, value: string): string {
  return (labels as Record<string, string>)[value] ?? value;
}

export function isOneOf<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}
