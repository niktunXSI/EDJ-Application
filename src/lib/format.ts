export const DISPLAY_TIME_ZONE = "America/New_York";
export const DISPLAY_TIME_ZONE_LABEL = "ET";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const currencyWhole = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const quantityFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });
const percentFormat = new Intl.NumberFormat("en-US", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Calendar dates (yyyy-mm-dd) are formatted in UTC so they never shift a day.
const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const shortDateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const monthYearFormatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: DISPLAY_TIME_ZONE,
});

export function formatCurrency(value: number, options: { whole?: boolean; signed?: boolean } = {}) {
  const text = (options.whole ? currencyWhole : currency).format(Math.abs(value));
  if (value < 0) return `-${text}`;
  if (options.signed && value > 0) return `+${text}`;
  return text;
}

export function formatCompactCurrency(value: number) {
  return compactCurrency.format(value);
}

export function formatQuantity(value: number) {
  return quantityFormat.format(value);
}

export function formatPercent(ratio: number, options: { signed?: boolean } = {}) {
  const text = percentFormat.format(Math.abs(ratio));
  if (ratio < 0) return `-${text}`;
  if (options.signed && ratio > 0) return `+${text}`;
  return text;
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return dateFormatter.format(toDate(value));
}

export function formatShortDate(value: string | Date) {
  return shortDateFormatter.format(toDate(value));
}

export function formatMonthYear(value: string | Date) {
  return monthYearFormatter.format(toDate(value));
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  return `${dateTimeFormatter.format(new Date(value))} ${DISPLAY_TIME_ZONE_LABEL}`;
}

export function formatRelative(value: string | Date, now: Date = new Date()) {
  const diff = now.getTime() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  const hours = Math.round(diff / 3600000);
  const days = Math.round(diff / 86400000);
  if (diff < 45000) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hr ago`;
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(new Date(value));
}

export function initials(name: string) {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count.toLocaleString("en-US")} ${count === 1 ? singular : plural}`;
}

/** "Morning", "afternoon" or "evening" in the display time zone. */
export function partOfDay(now: Date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: DISPLAY_TIME_ZONE }).format(now));
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function toDate(value: string | Date) {
  if (value instanceof Date) return value;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(value);
}
