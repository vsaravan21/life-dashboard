export const KINDS = ["events", "todos", "money", "goals", "trips", "books", "journal", "wins"] as const;
export type Kind = (typeof KINDS)[number];

/** Dates are local calendar days as "YYYY-MM-DD"; times are "HH:MM". */
export interface EventData { title: string; date: string; time?: string }
export interface TodoData { text: string; due?: string; done: boolean; doneAt?: number | null }
export interface MoneyData { label: string; amount: number; kind: "expense" | "income"; category?: string; date: string }
export interface GoalData { title: string; target?: string; progress: number }
export interface TripData { place: string; start: string; end: string; note?: string }
export interface BookData { title: string; author?: string; status: "reading" | "want" | "done"; progress: number; finished?: string }
export interface JournalData { caption: string; date: string; photo?: string }
export interface WinData { title: string; date: string; note?: string }

export interface DataByKind {
  events: EventData;
  todos: TodoData;
  money: MoneyData;
  goals: GoalData;
  trips: TripData;
  books: BookData;
  journal: JournalData;
  wins: WinData;
}

export interface Entry<K extends Kind = Kind> {
  id: string;
  kind: K;
  data: DataByKind[K] & { example?: boolean };
  createdAt: string;
}

export type EntriesByKind = { [K in Kind]: Entry<K>[] };

export interface Prefs { currency: string }
