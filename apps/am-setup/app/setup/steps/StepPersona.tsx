"use client";

import { useState } from "react";

interface Props {
  pronouns: string;
  blurb: string;
  onChange: (p: { pronouns?: string; personaBlurb?: string }) => void;
  onNext: () => void;
  onBack: () => void;
  accent: string;
}

const PRONOUN_OPTIONS = ["she/her", "he/him", "they/them", "it/its"];

export default function StepPersona({ pronouns, blurb, onChange, onNext, onBack, accent }: Props) {
  const [selectedPronouns, setSelectedPronouns] = useState(pronouns);
  const [personaText, setPersonaText] = useState(blurb);

  const handleNext = () => {
    onChange({ pronouns: selectedPronouns, personaBlurb: personaText });
    onNext();
  };

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Persona</h2>
        <p className="text-[#888]">
          Optional — help your assistant understand who she&apos;s working for.
        </p>
      </div>

      {/* Pronouns */}
      <div className="flex flex-col gap-3">
        <label className="text-sm text-[#aaa] font-medium">Pronouns</label>
        <div className="flex flex-wrap gap-2">
          {PRONOUN_OPTIONS.map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPronouns(p)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: selectedPronouns === p ? accent : "rgba(255,255,255,0.06)",
                color: selectedPronouns === p ? "#0f0f0f" : "#aaa",
                border: selectedPronouns === p ? "none" : "1px solid rgba(255,255,255,0.1)",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Persona blurb */}
      <div className="flex flex-col gap-3">
        <label className="text-sm text-[#aaa] font-medium">
          A note about you{" "}
          <span className="text-[#555]">(optional)</span>
        </label>
        <textarea
          value={personaText}
          onChange={(e) => setPersonaText(e.target.value)}
          placeholder="e.g. I'm a startup founder in Austin. I care about product, hiring, and staying on top of investor updates."
          rows={4}
          maxLength={500}
          className="w-full px-4 py-3 rounded-xl bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] text-white text-sm placeholder-[#444] focus:outline-none resize-none transition-all"
          style={{ borderColor: personaText ? `${accent}66` : undefined }}
        />
        <p className="text-xs text-[#555]">
          {personaText.length}/500 — used to personalize day-one context
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl border border-[rgba(255,255,255,0.1)] text-[#888] font-medium hover:text-white transition-all"
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
