import { useEffect, useState } from "react";
import type { Store } from "./store";

const TRIES = 3;

/**
 * A stored photo's displayable URL. If getting the link fails, or the image itself won't load
 * (call `onError` from the <img>), it asks for a fresh link and tries again, a few times with a pause.
 */
export function useStoredUrl(store: Store, ref: string | null | undefined) {
  const [src, setSrc] = useState<string | null>(null);
  const [tries, setTries] = useState({ ref, n: 0 });
  const [gaveUp, setGaveUp] = useState<string | null | undefined>(null);
  const n = tries.ref === ref ? tries.n : 0;
  useEffect(() => {
    if (!ref) return setSrc(null);
    let live = true, timer = 0;
    store.photoUrl(ref, n > 0).then(u => {
      if (!live) return;
      if (u) setSrc(u);
      else if (n < TRIES) timer = window.setTimeout(() => setTries({ ref, n: n + 1 }), 700 * 2 ** n);
    }, () => live && n < TRIES && setTries({ ref, n: n + 1 }));
    return () => { live = false; clearTimeout(timer); };
  }, [store, ref, n]);
  // Forget the old photo's link right away, so a reused component doesn't flash it.
  useEffect(() => setSrc(null), [ref]);
  const onError = () => {
    if (n < TRIES) window.setTimeout(() => setTries({ ref, n: n + 1 }), 400 * 2 ** n);
    else setGaveUp(ref);
  };
  // `attempt` goes in the image's key, so a retry reloads it even when the link is unchanged.
  return { src, onError, attempt: n, failed: !!ref && (gaveUp === ref || (n >= TRIES && !src)) };
}
