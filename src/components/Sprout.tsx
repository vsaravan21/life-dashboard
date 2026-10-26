import { useEffect, useState } from "react";

let ctx: AudioContext | null = null;
const audio = () => {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
};

/** One soft blip: a sine that glides from `from` to `to` Hz. */
function blip(a: AudioContext, at: number, from: number, to: number, len: number, vol = 0.18, type: OscillatorType = "sine") {
  const osc = a.createOscillator(), gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(to, at + len);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(vol, at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + len);
  osc.connect(gain).connect(a.destination);
  osc.start(at);
  osc.stop(at + len + 0.02);
}

/** Sprout's two noises, made on the fly so there are no sound files to load. `k` nudges the pitch so no two taps sound quite alike. */
const NOISES: ((a: AudioContext, t: number, k: number) => void)[] = [
  // boop
  (a, t, k) => blip(a, t, 520 * k, 880 * k, 0.16),
  // giggle
  (a, t, k) => [0, 0.07, 0.14, 0.21].forEach((d, i) => blip(a, t + d, (900 + i * 90) * k, (1150 + i * 90) * k, 0.06, 0.12, "triangle")),
];

/** The big mascot on the home page: tap it and it hops and giggles or boops. */
export function Sprout() {
  const [hop, setHop] = useState(0);
  useEffect(() => () => { void ctx?.suspend(); }, []);

  const tap = () => {
    setHop(h => h + 1);
    const a = audio();
    if (!a) return;
    const noise = NOISES[Math.floor(Math.random() * NOISES.length)];
    noise(a, a.currentTime + 0.01, 0.9 + Math.random() * 0.2);
  };

  return (
    <button className="sprout-btn" onClick={tap} aria-label="Boop Sprout" title="Boop!">
      <img key={hop} className={"mascot lg" + (hop ? " hop" : "")} src="/mascot.svg" alt="" />
    </button>
  );
}
