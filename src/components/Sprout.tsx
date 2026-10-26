import { useEffect, useRef, useState } from "react";

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

/** Sprout's little noises, made on the fly so there are no sound files to load. */
const NOISES: ((a: AudioContext, t: number) => void)[] = [
  // boop
  (a, t) => blip(a, t, 520, 880, 0.16),
  // squeak
  (a, t) => blip(a, t, 1200, 1900, 0.09, 0.12, "triangle"),
  // boing
  (a, t) => { blip(a, t, 300, 700, 0.12); blip(a, t + 0.11, 700, 420, 0.18, 0.14); },
  // giggle
  (a, t) => [0, 0.07, 0.14, 0.21].forEach((d, i) => blip(a, t + d, 900 + i * 90, 1150 + i * 90, 0.06, 0.12, "triangle")),
  // pop
  (a, t) => blip(a, t, 1600, 220, 0.07, 0.2),
  // happy chirp
  (a, t) => { blip(a, t, 660, 990, 0.08, 0.14); blip(a, t + 0.09, 880, 1320, 0.1, 0.14); },
  // sleepy yawn
  (a, t) => blip(a, t, 700, 260, 0.38, 0.12),
  // ding-ding
  (a, t) => { blip(a, t, 1318, 1318, 0.14, 0.1); blip(a, t + 0.12, 1760, 1760, 0.2, 0.1); },
];

/** The big mascot on the home page: tap it and it hops and makes a cute noise. */
export function Sprout() {
  const [hop, setHop] = useState(0);
  const last = useRef(-1);
  useEffect(() => () => { void ctx?.suspend(); }, []);

  const tap = () => {
    setHop(h => h + 1);
    const a = audio();
    if (!a) return;
    let i = Math.floor(Math.random() * NOISES.length);
    if (i === last.current) i = (i + 1) % NOISES.length;
    last.current = i;
    NOISES[i](a, a.currentTime + 0.01);
  };

  return (
    <button className="sprout-btn" onClick={tap} aria-label="Boop Sprout" title="Boop!">
      <img key={hop} className={"mascot lg" + (hop ? " hop" : "")} src="/mascot.svg" alt="" />
    </button>
  );
}
