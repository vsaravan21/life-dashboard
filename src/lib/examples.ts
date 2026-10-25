import { addDays, iso } from "./dates";
import type { DataByKind, Kind } from "./types";

type Example = { [K in Kind]: [K, DataByKind[K]] }[Kind];

const d = (n: number) => iso(addDays(new Date(), n));
const month = (day: number) => {
  const now = new Date();
  return iso(new Date(now.getFullYear(), now.getMonth(), Math.min(day, now.getDate())));
};

/** Sample entries shown until the first real ones are added, so every section shows how it works. */
export const EXAMPLES: Example[] = [
  ["events", { title: "Coffee with a friend", date: d(0), time: "11:00" }],
  ["events", { title: "Dentist appointment", date: d(2), time: "09:30" }],
  ["events", { title: "Team offsite", date: d(5), time: "" }],
  ["todos", { text: "Renew passport", due: d(-1), done: false }],
  ["todos", { text: "Book flights for December", due: d(4), done: false }],
  ["todos", { text: "Call the bank about the card", done: false }],
  ["todos", { text: "Water the plants", done: true, doneAt: Date.now() }],
  ["money", { label: "Salary", amount: 4200, kind: "income", category: "Salary", date: month(1) }],
  ["money", { label: "Rent", amount: 1500, kind: "expense", category: "Rent", date: month(2) }],
  ["money", { label: "Weekly groceries", amount: 140, kind: "expense", category: "Groceries", date: month(20) }],
  ["money", { label: "Dinner out", amount: 65, kind: "expense", category: "Eating out", date: month(23) }],
  ["goals", { title: "Run a half marathon", target: d(170), progress: 40 }],
  ["goals", { title: "Save an emergency fund", target: d(67), progress: 70 }],
  ["trips", { place: "Lisbon", start: d(54), end: d(62), note: "Flight TBD" }],
  ["books", { title: "Tomorrow, and Tomorrow, and Tomorrow", author: "Gabrielle Zevin", status: "reading", progress: 60 }],
  ["books", { title: "Atomic Habits", author: "James Clear", status: "want", progress: 0 }],
  ["books", { title: "Project Hail Mary", author: "Andy Weir", status: "done", progress: 100, finished: d(-41) }],
  ["journal", { caption: "Sunday walk by the water", date: d(-6) }],
  ["journal", { caption: "First try at homemade pasta", date: d(-14) }],
  ["wins", { title: "Finished a 10K", date: d(-13), note: "Under an hour" }],
  ["wins", { title: "Paid off the credit card", date: d(-56) }],
];
