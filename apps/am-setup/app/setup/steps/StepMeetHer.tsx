"use client";

import { useState, useRef } from "react";
import Image from "next/image";

interface Props {
  name: string;
  shortName: string;
  pronouns: string;
  visualDescription: string;
  onChange: (p: {
    assistantName?: string;
    shortName?: string;
    pronouns?: string;
    visualDescription?: string;
  }) => void;
  onNext: () => void;
  accent: string;
}

const PRONOUN_OPTIONS = ["she/her", "he/him", "they/them", "it/its"];

export default function StepMeetHer({
  name,
  shortName,
  pronouns,
  visualDescription,
  onChange,
  onNext,
  accent,
}: Props) {
  const [nameInput, setNameInput] = useState(name);
  const [shortInput, setShortInput] = useState(shortName);
  const [selectedPronouns, setSelectedPronouns] = useState(pronouns);
  const [descInput, setDescInput] = useState(visualDescription);
  const [photoSrc, setPhotoSrc] = useState("/amelia.png");
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPhotoSrc(url);
    }
  };

  const handleNext = () => {
    onChange({
      assistantName: nameInput.trim() || "Amelia",
      shortName: shortInput.trim() || "Am",
      pronouns: selectedPronouns,
      visualDescription: descInput,
    });
    onNext();
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Photo */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={() => fileRef.current?.click()}
          className="relative w-32 h-32 rounded-full overflow-hidden border-2 group cursor-pointer"
          style={{ borderColor: accent }}
        >
          <Image
            src={photoSrc}
            alt="Assistant photo"
            width={128}
            height={128}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-white text-xs font-medium">Change</span>
          </div>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoUpload}
          className="hidden"
        />
        <h2 className="text-3xl font-bold text-white">Meet your AM</h2>
      </div>

      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#aaa] font-medium">Name</label>
        <input
          type="text"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="Amelia"
          maxLength={32}
          className="w-full px-4 py-3 rounded-xl bg-[#1a1a1a] border text-white text-lg font-medium placeholder-[#444] focus:outline-none transition-all"
          style={{ borderColor: nameInput ? accent : "rgba(255,255,255,0.1)" }}
          autoFocus
        />
      </div>

      {/* Short name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#aaa] font-medium">Nickname</label>
        <input
          type="text"
          value={shortInput}
          onChange={(e) => setShortInput(e.target.value)}
          placeholder="Am"
          maxLength={8}
          className="w-full px-4 py-3 rounded-xl bg-[#1a1a1a] border text-white text-lg font-medium placeholder-[#444] focus:outline-none transition-all"
          style={{ borderColor: shortInput ? accent : "rgba(255,255,255,0.1)" }}
        />
      </div>

      {/* Pronouns */}
      <div className="flex flex-col gap-1.5">
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

      {/* Visual description */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#aaa] font-medium">
          Visual description{" "}
          <span className="text-[#555]">(for image generation)</span>
        </label>
        <textarea
          value={descInput}
          onChange={(e) => setDescInput(e.target.value)}
          rows={3}
          maxLength={500}
          className="w-full px-4 py-3 rounded-xl bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] text-white text-sm placeholder-[#444] focus:outline-none resize-none transition-all"
          style={{ borderColor: descInput ? `${accent}66` : undefined }}
        />
        <p className="text-xs text-[#555]">
          {descInput.length}/500 — used by mc-designer when generating images of her
        </p>
      </div>

      <button
        onClick={handleNext}
        className="w-full py-4 rounded-xl font-semibold text-base transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
        style={{ background: accent, color: "#0f0f0f" }}
      >
        Continue →
      </button>
    </div>
  );
}
