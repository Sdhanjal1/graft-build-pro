import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { VoiceMic, VoiceMicWave, VoiceWaveform } from "@/components/icons/VoiceIcons";

export const Route = createFileRoute("/icon-options")({
  component: IconOptionsPage,
  head: () => ({ meta: [{ title: "Voice icon options" }, { name: "robots", content: "noindex" }] }),
});

const OPTIONS = [
  {
    id: "mic",
    name: "Option 1 — Capsule mic",
    note: "Distinctive bolder mic, branded silhouette.",
    Icon: VoiceMic,
  },
  {
    id: "mic-wave",
    name: "Option 2 — Mic + sound waves",
    note: "Mic with radiating waves — dynamic, voice-first.",
    Icon: VoiceMicWave,
  },
  {
    id: "waveform",
    name: "Option 3 — Waveform bars",
    note: "Pure audio motif — modern, premium.",
    Icon: VoiceWaveform,
  },
] as const;

function IconOptionsPage() {
  const [picked, setPicked] = useState<string>("mic");

  return (
    <div className="min-h-screen bg-paper text-ink pb-24">
      <header className="bg-ink text-paper px-5 pt-8 pb-6 rounded-b-[1.5rem]">
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-lime">Pick one</p>
        <h1
          className="mt-2 text-paper leading-[0.85]"
          style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2.5rem" }}
        >
          Voice quote icon
        </h1>
        <p className="mt-3 text-sm text-paper/70 max-w-md">
          Three options for the primary voice-quote action. Each is shown at the
          hero button size and in the bottom-nav size, on both lime and ink.
        </p>
      </header>

      <div className="px-5 mt-6 space-y-5">
        {OPTIONS.map((opt) => {
          const active = picked === opt.id;
          const Icon = opt.Icon;
          return (
            <button
              key={opt.id}
              onClick={() => setPicked(opt.id)}
              className={`block w-full text-left rounded-2xl p-5 transition border ${
                active
                  ? "bg-ink text-paper border-ink shadow-[0_12px_28px_-14px_rgba(0,0,0,0.45)]"
                  : "bg-card text-ink border-border"
              }`}
              aria-pressed={active}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className="leading-none"
                    style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.5rem" }}
                  >
                    {opt.name}
                  </p>
                  <p className={`mt-1 text-xs ${active ? "text-paper/65" : "text-muted-foreground"}`}>
                    {opt.note}
                  </p>
                </div>
                {active && (
                  <span className="pill bg-lime text-ink shrink-0">Selected</span>
                )}
              </div>

              {/* Previews */}
              <div className="mt-5 grid grid-cols-2 gap-3">
                {/* Hero button — lime on ink */}
                <div className={`rounded-2xl p-5 flex flex-col items-center justify-center gap-2 ${active ? "bg-paper/[0.06]" : "bg-ink"}`}>
                  <span className="h-24 w-24 rounded-full bg-lime flex items-center justify-center shadow-[0_16px_32px_-12px_rgba(200,224,74,0.65)]">
                    <Icon size={56} style={{ color: "var(--ink)" }} />
                  </span>
                  <span className={`text-[10px] uppercase tracking-[0.18em] font-bold ${active ? "text-paper/55" : "text-paper/55"}`}>
                    Hero · 96px
                  </span>
                </div>

                {/* Nav button — small on ink pill */}
                <div className={`rounded-2xl p-5 flex flex-col items-center justify-center gap-3 ${active ? "bg-paper/[0.06]" : "bg-ink"}`}>
                  <span className="h-12 px-4 rounded-full bg-lime flex items-center gap-2">
                    <Icon size={18} style={{ color: "var(--ink)" }} />
                    <span className="text-[13px] font-bold text-ink">Speak</span>
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-paper/55">
                    Nav · 18px
                  </span>
                </div>
              </div>

              {/* Inline mono row at three sizes on paper */}
              <div className="mt-3 rounded-xl bg-paper/60 border border-border px-4 py-3 flex items-center justify-around">
                <Icon size={16} style={{ color: "var(--ink)" }} />
                <Icon size={24} style={{ color: "var(--ink)" }} />
                <Icon size={36} style={{ color: "var(--ink)" }} />
                <Icon size={48} style={{ color: "var(--ink)" }} />
              </div>
            </button>
          );
        })}

        <div className="rounded-2xl bg-lime/15 border border-lime/40 px-4 py-3 text-xs text-ink/80">
          Tap a card to mark your pick. Tell me which option ID you want — <span className="font-bold">mic</span>, <span className="font-bold">mic-wave</span>, or <span className="font-bold">waveform</span> — and I'll wire it into the Home mic CTA and the floating Speak button.
        </div>
      </div>
    </div>
  );
}
