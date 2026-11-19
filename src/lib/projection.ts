/** Future value of today's balance plus level monthly contributions, compounded monthly. */
export function projectValue(current: number, monthly: number, annualReturn: number, months: number) {
  if (months <= 0) return current;
  const r = annualReturn / 12;
  if (r === 0) return current + monthly * months;
  const growth = (1 + r) ** months;
  return current * growth + monthly * ((growth - 1) / r);
}
