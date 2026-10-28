import { useEffect, useState } from "react";
import { AddForm, DateField, Empty, Panel, Remove } from "../components/ui";
import { fmt } from "../lib/dates";
import { shrinkPhoto } from "../lib/image";
import type { Entry } from "../lib/types";
import type { Dashboard } from "../lib/useDashboard";

function Photo({ dash, entry }: { dash: Dashboard; entry: Entry<"journal"> }) {
  const [src, setSrc] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);
  const ref = entry.data.photos?.[0] ?? entry.data.photo;
  useEffect(() => {
    let live = true;
    if (ref) dash.store.photoUrl(ref).then(u => live && setSrc(u));
    return () => { live = false; };
  }, [dash.store, ref]);
  return (
    <div className="img">
      {ref && src && !broken
        ? <img src={src} alt={entry.data.caption} loading="lazy" onError={() => setBroken(true)} />
        : ref && broken ? "photo unavailable" : fmt(entry.data.date, { month: "short", day: "numeric" })}
    </div>
  );
}

export function Journal({ dash, notify }: { dash: Dashboard; notify: (m: string) => void }) {
  const list = [...dash.entries.journal].sort((a, b) => b.data.date.localeCompare(a.data.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 12);

  return (
    <Panel id="p-journal" title="Photo journal" cover="c-journal" label="Moments" addLabel="Add moment"
      form={close => (
        <AddForm onClose={close} onSave={async (v, form) => {
          const file = (form.elements.namedItem("photo") as HTMLInputElement).files?.[0];
          let photo: string | undefined;
          if (file) {
            if (!file.type.startsWith("image/")) { notify("Choose a photo file (JPG, PNG, WebP or HEIC)."); return false; }
            try { photo = await dash.store.uploadPhoto(await shrinkPhoto(file)); }
            catch { notify("The photo didn't upload. Try again."); return false; }
          }
          await dash.add("journal", { caption: v.caption.trim(), date: v.date, photos: photo ? [photo] : [] });
        }}>
          <input className="grow" name="caption" placeholder="Caption" required aria-label="Caption" />
          <DateField name="date" label="Date" />
          <input type="file" name="photo" accept="image/*" aria-label="Photo" />
        </AddForm>
      )}>
      {list.length === 0 ? <Empty>Add a photo and a line about the day.</Empty> : (
        <div className="photos">
          {list.map(j => (
            <figure className="photo" key={j.id}>
              <Photo dash={dash} entry={j} />
              <figcaption className="cap">
                <span className="t">{j.data.caption}</span>
                <span className="meta">{fmt(j.data.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
              </figcaption>
              <Remove label={j.data.caption} onClick={() => dash.remove(j)} />
            </figure>
          ))}
        </div>
      )}
    </Panel>
  );
}
