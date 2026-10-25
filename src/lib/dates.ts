const pad = (n: number) => String(n).padStart(2, "0");

/** A Date as a local "YYYY-MM-DD" string. */
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Parse "YYYY-MM-DD" as local midnight (not UTC, which shifts the day in some time zones). */
export const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

export const today = () => iso(new Date());

/**
 * "HH:MM" on a 12-hour clock: "09:30" → "9:30 AM", "13:00" → "1:00 PM".
 * The short form fits small spaces like the month grid: "9:30am", "1pm".
 */
export const clock = (time: string, short = false) => {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h)) return time;
  const hour = h % 12 || 12, ampm = h < 12 ? "AM" : "PM";
  if (short) return `${hour}${m ? `:${pad(m)}` : ""}${ampm.toLowerCase()}`;
  return `${hour}:${pad(m || 0)} ${ampm}`;
};

/** Whole days from a to b (positive when b is later). */
export const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);

export const fmt = (s: string | undefined, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) =>
  s ? parse(s).toLocaleDateString(undefined, opts) : "";

export const dayOfYear = (d: Date) => Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86_400_000) + 1;

export const daysInYear = (y: number) => ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365);

/** ISO 8601 week number (weeks start Monday; week 1 holds the year's first Thursday). */
export const isoWeek = (d: Date) => {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const jan4 = new Date(t.getFullYear(), 0, 4);
  return 1 + Math.round(((t.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
};

/** Comparator over string fields; missing or empty values sort last. */
export const by = <T,>(...keys: (keyof T)[]) => (a: T, b: T) => {
  for (const k of keys) {
    const x = String(a[k] || "￿"), y = String(b[k] || "￿");
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
};
