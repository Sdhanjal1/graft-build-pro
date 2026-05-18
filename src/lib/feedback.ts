// Lightweight haptics + sound feedback helpers.
// Safe no-ops on unsupported browsers.

const KEY = "quottr.feedback";

type Prefs = { haptics: boolean; sound: boolean };

function read(): Prefs {
  if (typeof window === "undefined") return { haptics: true, sound: true };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { haptics: true, sound: true };
    return { haptics: true, sound: true, ...JSON.parse(raw) };
  } catch {
    return { haptics: true, sound: true };
  }
}

export function getFeedbackPrefs(): Prefs {
  return read();
}

export function setFeedbackPrefs(patch: Partial<Prefs>) {
  if (typeof window === "undefined") return;
  const next = { ...read(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function haptic(pattern: "tap" | "success" | "warn" | "error" = "tap") {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  if (!read().haptics) return;
  const map: Record<string, number | number[]> = {
    tap: 10,
    success: [12, 40, 18],
    warn: [20, 60, 20],
    error: [40, 60, 40, 60, 40],
  };
  try {
    navigator.vibrate(map[pattern]);
  } catch {
    // ignore
  }
}

let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

type Tone = { freq: number; dur: number; type?: OscillatorType; gain?: number };

function play(tones: Tone[]) {
  if (!read().sound) return;
  const ac = getCtx();
  if (!ac) return;
  let t = ac.currentTime;
  for (const tone of tones) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = tone.type ?? "sine";
    osc.frequency.value = tone.freq;
    const peak = tone.gain ?? 0.08;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + tone.dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + tone.dur + 0.02);
    t += tone.dur;
  }
}

export function sound(kind: "tap" | "success" | "warn" | "error" = "tap") {
  switch (kind) {
    case "success":
      return play([
        { freq: 660, dur: 0.08 },
        { freq: 880, dur: 0.12 },
      ]);
    case "warn":
      return play([{ freq: 440, dur: 0.18, type: "triangle" }]);
    case "error":
      return play([
        { freq: 280, dur: 0.1, type: "sawtooth", gain: 0.06 },
        { freq: 200, dur: 0.18, type: "sawtooth", gain: 0.06 },
      ]);
    case "tap":
    default:
      return play([{ freq: 720, dur: 0.05, gain: 0.05 }]);
  }
}

export function feedback(kind: "tap" | "success" | "warn" | "error" = "tap") {
  haptic(kind);
  sound(kind);
}
