// Shared by server and client components (no database access here).

// "9月 2026" — month in Chinese, then the year. Falls back to the year alone.
export function formatRollTime(roll: {
  year: number | null;
  month: number | null;
}) {
  if (roll.year === null) return "";
  if (roll.month === null) return String(roll.year);
  return `${roll.month}月 ${roll.year}`;
}

// Value for <input type="month"> ("2026-09").
export function rollMonthInputValue(roll: {
  year: number | null;
  month: number | null;
}) {
  if (roll.year === null) return "";
  if (roll.month === null) return String(roll.year);
  return `${roll.year}-${String(roll.month).padStart(2, "0")}`;
}

export function rollNumber(index: number) {
  return String(index).padStart(3, "0");
}
