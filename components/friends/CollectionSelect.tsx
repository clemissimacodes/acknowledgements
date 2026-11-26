import { COLLECTION_YEARS, SEASONS } from "@/lib/friend-types";

type Props = { name: string; defaultValue?: string; required?: boolean };

/* "Fall 2024" etc., newest first, with a season-less fallback per year. */
export function CollectionSelect({ name, defaultValue = "", required }: Props) {
  return (
    <select name={name} defaultValue={defaultValue} required={required}>
      <option value="">—</option>
      {COLLECTION_YEARS.map((year) => (
        <optgroup key={year} label={String(year)}>
          {[...SEASONS].reverse().map((season) => (
            <option key={season.handle} value={`${season.handle}-${year}`}>
              {season.label} {year}
            </option>
          ))}
          <option value={String(year)}>{year} (season a blur)</option>
        </optgroup>
      ))}
    </select>
  );
}
