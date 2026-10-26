/** Book covers from Open Library, looked up by title and author in the browser. */
export const NO_COVER = "none";

export async function findCover(title: string, author?: string, f: typeof fetch = fetch): Promise<string> {
  const q = new URLSearchParams({ title, limit: "5", fields: "cover_i,title" });
  if (author) q.set("author", author);
  const res = await f(`https://openlibrary.org/search.json?${q}`);
  if (!res.ok) throw new Error(`Open Library answered ${res.status}`);
  const { docs = [] } = await res.json() as { docs?: { cover_i?: number }[] };
  const id = docs.find(d => d.cover_i)?.cover_i;
  return id ? `https://covers.openlibrary.org/b/id/${id}-L.jpg` : NO_COVER;
}

/** Whether a cover is a web address (rather than a photo kept in the dashboard's store). */
export const isWebCover = (c: string) => /^https?:\/\//.test(c);
