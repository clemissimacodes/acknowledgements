const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function parseDay(value?: string): Date | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    return new Date(year, month, day);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Conversation-list time, iMessage-short. */
export function listTime(value?: string): string {
  const date = parseDay(value);
  if (!date) return "";
  return `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear()).slice(2)}`;
}

/** Long date on the contact card. */
export function cardDate(value?: string): string {
  const date = parseDay(value);
  if (!date) return "";
  return `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** Centered thread crumb. Place joins the date when present. */
export function threadStamp(dateValue?: string, place?: string): string {
  const date = parseDay(dateValue);
  const datePart = date
    ? `${WEEKDAYS_SHORT[date.getDay()]}, ${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
    : "";
  return [place, datePart].filter(Boolean).join(" · ");
}

export function initialsFor(name: string): string {
  const scene = /^the\s+/i.test(name);
  const cleaned = name.replace(/^the\s+/i, "").trim();
  const words = cleaned.split(/\s+/).filter((word) => !/^(with|and|of|the|a|an)$/i.test(word));
  if (scene && words.length >= 2) {
    const last = words[words.length - 1];
    const prev = words[words.length - 2];
    return (prev[0] + last[0]).toUpperCase();
  }
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  return cleaned.slice(0, 1).toUpperCase() || "?";
}
