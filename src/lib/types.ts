import type {
  AccountType,
  ActivityType,
  AlertSettings,
  AssetClass,
  DocumentCategory,
  Frequency,
  MovementKind,
  MovementStatus,
} from "./domain";

export interface Advisor {
  id: string;
  name: string;
  title: string;
  branch: string;
  addressLine: string;
  city: string;
  state: string;
  phone: string;
  email: string;
}

export interface ServiceTeamMember {
  name: string;
  role: string;
  phone: string;
}

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  addressLine: string;
  city: string;
  state: string;
  postalCode: string;
  isPrimary: boolean;
}

export interface Household {
  id: string;
  name: string;
  segment: string;
  clientSince: string;
  advisor: Advisor;
  serviceTeam: ServiceTeamMember[];
  clients: Client[];
}

export interface AccountSummary {
  id: string;
  nickname: string;
  type: AccountType;
  accountNumber: string;
  maskedNumber: string;
  registration: string;
  objective: string;
  isAdvisory: boolean;
  beneficiaryName: string | null;
  ownerClientId: string | null;
  ownerName: string | null;
  openedOn: string;
  marketValue: number;
  cashBalance: number;
  costBasis: number;
  unrealizedGain: number;
  dayChange: number;
  dayChangePercent: number;
}

export interface Holding {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  securityType: string;
  quantity: number;
  price: number;
  previousClose: number;
  marketValue: number;
  costBasis: number;
  gain: number;
  gainPercent: number;
  dayChange: number;
  weight: number;
}

export interface AllocationSlice {
  assetClass: AssetClass;
  value: number;
  weight: number;
}

export interface AccountDetail extends AccountSummary {
  holdings: Holding[];
  allocation: AllocationSlice[];
}

export interface HistoryPoint {
  date: string;
  value: number;
}

export interface ValueHistory {
  points: HistoryPoint[];
  startValue: number;
  endValue: number;
  change: number;
  changePercent: number;
}

export interface ActivityItem {
  id: string;
  accountId: string;
  accountName: string;
  tradeDate: string;
  settleDate: string;
  type: ActivityType;
  description: string;
  symbol: string | null;
  quantity: number | null;
  price: number | null;
  amount: number;
  taxYear: number | null;
}

export interface ActivityPage {
  items: ActivityItem[];
  total: number;
  inflows: number;
  outflows: number;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountKind: string;
  lastFour: string;
  label: string;
}

export interface Movement {
  id: string;
  kind: MovementKind;
  fromAccountId: string | null;
  toAccountId: string | null;
  bankAccountId: string | null;
  fromLabel: string;
  toLabel: string;
  amount: number;
  frequency: Frequency;
  scheduledFor: string;
  status: MovementStatus;
  memo: string | null;
  requestedBy: string;
  createdAt: string;
  cancelledAt: string | null;
}

export interface DocumentItem {
  id: string;
  category: DocumentCategory;
  title: string;
  accountId: string | null;
  accountName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  taxYear: number | null;
  issuedOn: string;
  pageCount: number;
  viewed: boolean;
}

export interface StatementLine {
  accountId: string;
  accountName: string;
  beginningValue: number;
  endingValue: number;
  netContributions: number;
  income: number;
  fees: number;
  investmentChange: number;
}

export type DocumentContent =
  | { kind: "statement" | "report"; lines: StatementLine[]; totals: Omit<StatementLine, "accountId" | "accountName"> }
  | { kind: "form1099"; ordinaryDividends: number; interestIncome: number; grossProceeds: number }
  | {
      kind: "form5498";
      accountType: AccountType;
      contributions: number;
      rothContributions: number;
      rolloverContributions: number;
      fairMarketValue: number;
    }
  | { kind: "confirmation"; trade: ActivityItem | null }
  | { kind: "letter"; paragraphs: string[] };

export interface DocumentDetail extends DocumentItem {
  household: { name: string; clients: string[]; addressLine: string; cityLine: string };
  content: DocumentContent;
}

export interface Goal {
  id: string;
  name: string;
  type: "retirement" | "education" | "major_purchase";
  targetAmount: number;
  targetDate: string;
  monthlyContribution: number;
  assumedReturn: number;
  accountIds: string[];
  accountNames: string[];
  currentValue: number;
  projectedValue: number;
  progress: number;
  onTrack: boolean;
  monthsRemaining: number;
}

export interface ThreadSummary {
  id: string;
  subject: string;
  lastMessageAt: string;
  preview: string;
  lastAuthor: string;
  unreadCount: number;
  messageCount: number;
}

export interface Message {
  id: string;
  sender: "client" | "branch";
  authorName: string;
  body: string;
  sentAt: string;
  read: boolean;
}

export interface Thread extends ThreadSummary {
  messages: Message[];
}

export interface Preferences {
  paperlessStatements: boolean;
  paperlessTaxDocuments: boolean;
  paperlessConfirmations: boolean;
  alerts: AlertSettings;
  updatedAt: string;
}

export interface Overview {
  household: Household;
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  accounts: AccountSummary[];
  allocation: AllocationSlice[];
  recentActivity: ActivityItem[];
  goals: Goal[];
  upcomingMovements: Movement[];
  unreadMessages: number;
  newDocuments: number;
}
