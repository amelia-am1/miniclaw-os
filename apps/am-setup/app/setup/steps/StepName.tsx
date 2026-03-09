"use client";

import { useState } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
  accent: string;
}

export default function StepName({ value, onChange, onNext, onBack, accent }: Props) {
  const [input, setInput] = useState(value);

  const handleNext = () => {
    const name = input.trim() || "AM";
    onChange(name);
    onNext();
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Name your assistant</h2>
        <p className="text-[#888]">
          She&apos;ll answer to this name. Short for Amelia, but make her yours.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <label className="text-sm text-[#aaa] font-medium">Assistant name</label>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleNext()}
          placeholder="AM"
          maxLength={32}
          className="w-full px-4 py-3 rounded-xl bg-[#1a1a1a] border text-white text-lg font-medium placeholder-[#444] focus:outline-none transition-all"
          style={{ borderColor: input ? accent : "rgba(255,255,255,0.1)" }}
          autoFocus
        />
        <p className="text-xs text-[#555]">
          Leave blank to keep the default &ldquo;AM&rdquo;
        </p>
      </div>

      {/* Live preview */}
      <div
        className="rounded-xl p-4 flex items-center gap-3"
        style={{ background: `${accent}11`, border: `1px solid ${accent}33` }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
          style={{ background: `${accent}33`, color: accent }}
        >
          {(input.trim() || "AM").slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{input.trim() || "AM"}</div>
          <div className="text-xs text-[#666]">Your personal assistant</div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl border border-[rgba(255,255,255,0.1)] text-[#888] font-medium hover:text-white hover:border-[rgba(255,255,255,0.2)] transition-all"
        >
          ← Back
        </button>
        <button
          onClick={handleNext}
          className="flex-[2] py-3 rounded-xl font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: accent, color: "#0f0f0f" }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
