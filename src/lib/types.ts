export const KINDS = ["events", "todos", "money", "goals", "trips", "books", "journal", "wins", "notes", "lists"] as const;
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
export interface TripData { place: string; start: string; end: string; note?: string }
export interface BookData { title: string; author?: string; status: "reading" | "want" | "done"; progress: number; finished?: string }
export interface JournalData { caption: string; date: string; photo?: string }
export interface WinData { title: string; date: string; note?: string }
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
}

export interface Entry<K extends Kind = Kind> {
  id: string;
  kind: K;
  data: DataByKind[K];
  createdAt: string;
}

export type EntriesByKind = { [K in Kind]: Entry<K>[] };

export interface Prefs { currency: string }
