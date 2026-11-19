-- Edward Jones Client Portal schema. Every person, account, security, and figure stored here is synthetic.

create table advisors (
  id text primary key,
  name text not null,
  title text not null,
  branch text not null,
  address_line text not null,
  city text not null,
  state text not null,
  phone text not null,
  email text not null
);

create table households (
  id text primary key,
  name text not null,
  advisor_id text not null references advisors(id),
  segment text not null,
  client_since date not null,
  service_team jsonb not null default '[]'::jsonb
);

create table clients (
  id text primary key,
  household_id text not null references households(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  date_of_birth date not null,
  email text not null,
  phone text not null,
  address_line text not null,
  city text not null,
  state text not null,
  postal_code text not null,
  is_primary boolean not null default false
);
create index clients_household_idx on clients(household_id);

create table securities (
  symbol text primary key,
  name text not null,
  asset_class text not null check (asset_class in ('us_equity', 'intl_equity', 'fixed_income', 'real_estate', 'cash')),
  security_type text not null check (security_type in ('stock', 'etf', 'mutual_fund', 'bond', 'money_market', 'portfolio')),
  price numeric(14, 4) not null,
  previous_close numeric(14, 4) not null,
  dividend_yield numeric(6, 4) not null default 0
);

create table accounts (
  id text primary key,
  household_id text not null references households(id) on delete cascade,
  owner_client_id text references clients(id),
  account_number text not null,
  nickname text not null,
  account_type text not null check (account_type in ('joint', 'individual', 'traditional_ira', 'roth_ira', 'education_529')),
  registration text not null,
  objective text not null,
  is_advisory boolean not null default false,
  beneficiary_name text,
  cash_balance numeric(14, 2) not null default 0,
  opened_on date not null,
  sort_order integer not null default 0
);
create index accounts_household_idx on accounts(household_id);

create table holdings (
  account_id text not null references accounts(id) on delete cascade,
  symbol text not null references securities(symbol),
  quantity numeric(16, 4) not null,
  cost_basis numeric(14, 2) not null,
  primary key (account_id, symbol)
);

create table account_values (
  account_id text not null references accounts(id) on delete cascade,
  as_of date not null,
  market_value numeric(14, 2) not null,
  primary key (account_id, as_of)
);

create table transactions (
  id text primary key,
  account_id text not null references accounts(id) on delete cascade,
  trade_date date not null,
  settle_date date not null,
  activity_type text not null check (
    activity_type in ('buy', 'sell', 'dividend', 'interest', 'contribution', 'withdrawal', 'transfer_in', 'transfer_out', 'fee', 'rollover')
  ),
  description text not null,
  symbol text references securities(symbol),
  quantity numeric(16, 4),
  price numeric(14, 4),
  amount numeric(14, 2) not null,
  -- Tax year an IRA or 529 contribution is reported for; null for every other activity.
  tax_year integer
);
create index transactions_account_date_idx on transactions(account_id, trade_date desc);

create table linked_bank_accounts (
  id text primary key,
  household_id text not null references households(id) on delete cascade,
  bank_name text not null,
  account_kind text not null,
  last_four text not null,
  verified_on date not null
);

create table money_movements (
  id text primary key,
  household_id text not null references households(id) on delete cascade,
  kind text not null check (kind in ('internal', 'deposit', 'withdrawal')),
  from_account_id text references accounts(id),
  to_account_id text references accounts(id),
  bank_account_id text references linked_bank_accounts(id),
  amount numeric(14, 2) not null check (amount > 0),
  frequency text not null check (frequency in ('once', 'monthly')),
  scheduled_for date not null,
  status text not null check (status in ('scheduled', 'processing', 'completed', 'cancelled')),
  memo text,
  requested_by text not null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);
create index money_movements_household_idx on money_movements(household_id, created_at desc);

create table documents (
  id text primary key,
  household_id text not null references households(id) on delete cascade,
  account_id text references accounts(id) on delete cascade,
  category text not null check (category in ('statement', 'tax', 'confirmation', 'report', 'letter')),
  title text not null,
  period_start date,
  period_end date,
  tax_year integer,
  issued_on date not null,
  page_count integer not null default 1,
  transaction_id text references transactions(id) on delete set null,
  viewed_at timestamptz
);
create index documents_household_idx on documents(household_id, issued_on desc);

create table goals (
  id text primary key,
  household_id text not null references households(id) on delete cascade,
  name text not null,
  goal_type text not null check (goal_type in ('retirement', 'education', 'major_purchase')),
  target_amount numeric(14, 2) not null,
  target_date date not null,
  monthly_contribution numeric(14, 2) not null default 0,
  assumed_return numeric(5, 4) not null default 0.05,
  account_ids text[] not null default '{}'
);

create table message_threads (
  id text primary key,
  household_id text not null references households(id) on delete cascade,
  subject text not null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index message_threads_household_idx on message_threads(household_id, last_message_at desc);

create table messages (
  id text primary key,
  thread_id text not null references message_threads(id) on delete cascade,
  sender text not null check (sender in ('client', 'branch')),
  author_name text not null,
  body text not null,
  sent_at timestamptz not null default now(),
  read_at timestamptz
);
create index messages_thread_idx on messages(thread_id, sent_at);

create table preferences (
  household_id text primary key references households(id) on delete cascade,
  paperless_statements boolean not null default true,
  paperless_tax_documents boolean not null default true,
  paperless_confirmations boolean not null default true,
  alerts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);