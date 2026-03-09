"use client";

interface Props {
  onNext: () => void;
  accent: string;
}

export default function StepWelcome({ onNext, accent }: Props) {
  return (
    <div className="text-center flex flex-col items-center gap-8">
      {/* AM Logo / wordmark */}
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold"
          style={{ background: `${accent}22`, border: `2px solid ${accent}` }}
        >
          <span style={{ color: accent }}>AM</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-white">
          Meet your AM
        </h1>
      </div>

      <p className="text-lg text-[#aaaaaa] max-w-sm leading-relaxed">
        She is about to become yours. In just a few steps, your personal AI
        assistant will be ready to handle your inbox, manage your day, and
        learn what matters to you.
      </p>

      <div className="flex flex-col gap-3 text-sm text-[#666] max-w-xs">
        <div className="flex items-center gap-3">
          <span style={{ color: accent }}>✦</span>
          <span>No technical knowledge required</span>
        </div>
        <div className="flex items-center gap-3">
          <span style={{ color: accent }}>✦</span>
          <span>Runs entirely on your device</span>
        </div>
        <div className="flex items-center gap-3">
          <span style={{ color: accent }}>✦</span>
          <span>Setup takes about 2 minutes</span>
        </div>
      </div>

      <button
        onClick={onNext}
        className="w-full max-w-xs py-4 rounded-xl font-semibold text-base transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
        style={{ background: accent, color: "#0f0f0f" }}
      >
        Let&apos;s begin →
      </button>
    </div>
  );
}
