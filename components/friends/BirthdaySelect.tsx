import { MONTHS } from "@/lib/friend-types";

type Props = { name: string; defaultValue?: string };

/* Month + day selects; the server action joins them into "MM-DD". */
export function BirthdaySelect({ name, defaultValue = "" }: Props) {
  const [month, day] = defaultValue ? defaultValue.split("-").map(Number) : [0, 0];
  return (
    <span className="admin-birthday">
      <select name={`${name}-month`} defaultValue={month || ""}>
        <option value="">Month</option>
        {MONTHS.map((label, i) => (
          <option key={label} value={i + 1}>
            {label}
          </option>
        ))}
      </select>
      <select name={`${name}-day`} defaultValue={day || ""}>
        <option value="">Day</option>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
    </span>
  );
}
