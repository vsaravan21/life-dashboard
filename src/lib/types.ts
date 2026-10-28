export const KINDS = ["events", "todos", "money", "goals", "trips", "books", "journal", "wins", "notes", "lists", "goalyears", "goalcats", "lookback", "flights", "gratitude", "projects"] as const;
export type Kind = (typeof KINDS)[number];

/** Dates are local calendar days as "YYYY-MM-DD"; times are "HH:MM". */
export interface EventData {
  title: string;
  date: string;
  /** "" for all-day events. */
  time?: string;
  allDay?: boolean;
  /** Last day (inclusive) and end time; older events have neither. */
  endDate?: string;
  endTime?: string;
  location?: string;
  description?: string;
}
export interface TodoData { text: string; due?: string; done: boolean; doneAt?: number | null; /** The to-do list it belongs to; none for loose tasks. */ listId?: string }
/** A named, colored to-do list on the To-do page. `created` is a local day. */
export interface ListData { title: string; color: string; created: string; /** The one list shown on the home page. */ starred?: boolean }
export interface MoneyData { label: string; amount: number; kind: "expense" | "income"; category?: string; date: string }
export interface GoalData { title: string; target?: string; progress: number }
/** One line in an outline: a goal (with a check) or a Looking Back item. `depth` 1 or 2 makes it a sub-item. */
export interface OutlineItem { id: string; text: string; depth?: number; done?: boolean }
/** A year on the Goals page. */
export interface GoalYearData { year: number }
/** A category of goals (Health, Career, ...) within a year. */
export interface GoalCatData { year: number; title: string; color: string; items: OutlineItem[] }
/** One month on the Looking Back page: titled sections of items. */
export interface LookbackData { year: number; month: number; sections: { id: string; title: string; items: OutlineItem[] }[] }
export interface TripData {
  place: string; start: string; end: string; note?: string;
  /** Card color on the Travel page, and the trip's photo slides (store refs) in order. */
  color?: string; photos?: string[];
  /** A short note on each photo, by its ref. */
  notes?: Record<string, string>;
}
/**
 * A flight on the Travel page. `date` is "YYYY-MM-DD", or "YYYY-MM" when only the month is known.
 * `from` and `to` are cities or airport codes; `note` marks a first or anything memorable.
 */
export interface FlightData { date: string; from: string; to: string; reason?: string; note?: string; airline?: string; number?: string }
/**
 * `finished` is the day ("YYYY-MM-DD") or just the year ("YYYY") a book was finished.
 * `cover` is an image URL or a stored photo ref; "none" means no cover was found to look up again.
 */
export interface BookData { title: string; author?: string; status: "reading" | "want" | "done"; progress: number; finished?: string; cover?: string; thoughts?: string }
/**
 * A highlight in the Photo journal: a title (caption), a date and its photos.
 * Older entries hold a single `photo`; newer ones keep a list in `photos`.
 */
export interface JournalData {
  caption: string; date: string; photo?: string;
  photos?: string[]; note?: string; color?: string;
  notes?: Record<string, string>;
}
export interface WinData { title: string; date: string; note?: string }
/** A card inside a project: a title, some text, photos or videos, and files. */
export interface ProjectCard {
  id: string; title: string; text: string;
  media: string[];
  files: { ref: string; name: string; size: number; type: string }[];
}
/** One tab on the Projects page. */
export interface ProjectData {
  name: string; color: string;
  status: "idea" | "active" | "paused" | "done";
  start?: string; end?: string;
  cards: ProjectCard[];
}

/** A sticky note on the Gratitude Board. `at` is when it was written, in ms. */
export interface GratitudeData { text: string; color: string; at: number }

export interface NoteData { title: string; body: string; pinned: boolean; updatedAt: number }

export interface DataByKind {
  events: EventData;
  todos: TodoData;
  money: MoneyData;
  goals: GoalData;
  trips: TripData;
  books: BookData;
  journal: JournalData;
  wins: WinData;
  notes: NoteData;
  lists: ListData;
  goalyears: GoalYearData;
  goalcats: GoalCatData;
  lookback: LookbackData;
  flights: FlightData;
  gratitude: GratitudeData;
  projects: ProjectData;
}

export interface Entry<K extends Kind = Kind> {
  id: string;
  kind: K;
  data: DataByKind[K];
  createdAt: string;
}

export type EntriesByKind = { [K in Kind]: Entry<K>[] };

export interface Prefs { currency: string }
