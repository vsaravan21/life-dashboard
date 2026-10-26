import { useEffect, useRef, useState } from "react";

/** Little pep talks from Sprout, the mascot. */
export const PEP = [
  "Hey there, you're doing great!",
  "Proud of you for showing up today.",
  "Drink some water, superstar.",
  "One small step still counts as a step.",
  "You've got this. Like, really got this.",
  "Remember to take a deep breath.",
  "Look how far you've come!",
  "Your future self says thank you.",
  "Be kind to yourself today.",
  "Tiny progress is still progress.",
  "You make hard things look easy.",
  "Go stretch for a second. I'll wait.",
  "Today's a good day to be brave.",
  "Sending you a big orange hug!",
  "Keep going, you're glowing.",
];

const MUTE_KEY = "life-dashboard:sprout-muted";
const readMuted = () => { try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; } };

/** A bright, friendly English voice if the device has one. */
function pickVoice() {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const en = voices.filter(v => v.lang.toLowerCase().startsWith("en"));
  const liked = ["Samantha", "Karen", "Moira", "Tessa", "Google US English", "Microsoft Aria", "Microsoft Jenny", "Zira"];
  return liked.map(n => en.find(v => v.name.includes(n))).find(Boolean) ?? en[0];
}

function say(text: string) {
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) u.voice = voice;
  u.pitch = 1.35;
  u.rate = 1.02;
  synth.speak(u);
}

/** The big mascot on the home page: tap it for a pep talk, read aloud unless muted. */
export function Sprout() {
  const [msg, setMsg] = useState<string | null>(null);
  const [muted, setMuted] = useState(readMuted);
  const [bounce, setBounce] = useState(0);
  const last = useRef(-1);
  const timer = useRef<number>();
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    // Some browsers load voices late; asking once warms the list up.
    window.speechSynthesis?.getVoices();
    return () => { window.clearTimeout(timer.current); window.speechSynthesis?.cancel(); };
  }, []);

  const tap = () => {
    let i = Math.floor(Math.random() * PEP.length);
    if (i === last.current) i = (i + 1) % PEP.length;
    last.current = i;
    setMsg(PEP[i]);
    setBounce(b => b + 1);
    if (!muted) say(PEP[i]);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 6000);
  };
  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    try { localStorage.setItem(MUTE_KEY, m ? "1" : "0"); } catch { /* fine */ }
    if (m) window.speechSynthesis?.cancel();
    else if (msg) say(msg);
  };

  return (
    <div className="sprout">
      {msg && (
        <div className="sprout-bubble" role="status" key={msg}>
          <span>{msg}</span>
          {canSpeak && (
            <button className="sprout-mute" onClick={toggleMute} aria-pressed={!muted} aria-label={muted ? "Turn Sprout's voice on" : "Mute Sprout"} title={muted ? "Voice off" : "Voice on"}>
              <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4Z" fill="currentColor" />
                {muted ? <path d="m16 9.5 5 5m0-5-5 5" /> : <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />}
              </svg>
            </button>
          )}
        </div>
      )}
      <button className="sprout-btn" onClick={tap} aria-label="Tap Sprout for a pep talk" title="Tap me!">
        <img key={bounce} className={"mascot lg" + (bounce ? " hop" : "")} src="/mascot.svg" alt="" />
      </button>
    </div>
  );
}
