"use client";

import { useState } from "react";

interface Props {
  email: string;
  appPassword: string;
  onChange: (p: { emailAddress?: string; appPassword?: string }) => void;
  onNext: () => void;
  onBack: () => void;
  accent: string;
}

type Status = "idle" | "checking" | "ok" | "error";

export default function StepEmail({ email, appPassword, onChange, onNext, onBack, accent }: Props) {
  const [emailInput, setEmailInput] = useState(email);
  const [passwordInput, setPasswordInput] = useState(appPassword);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);

  const handleVerify = async () => {
    if (!emailInput.trim() || !passwordInput.trim()) {
      setErrorMsg("Both fields are required");
      return;
    }
    setStatus("checking");
    setErrorMsg("");

    try {
      const res = await fetch("/api/setup/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput.trim(), appPassword: passwordInput.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        onChange({ emailAddress: emailInput.trim(), appPassword: passwordInput.trim() });
        setStatus("ok");
        setTimeout(onNext, 800);
      } else {
        setStatus("error");
        setErrorMsg(data.error || "Verification failed");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network error — are you connected?");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Email setup</h2>
        <p className="text-[#888]">
          Required. Your assistant reads and manages your Gmail inbox.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm text-[#aaa] font-medium">Gmail address</label>
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="you@gmail.com"
            className="w-full px-4 py-3 rounded-xl bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] text-white placeholder-[#444] focus:outline-none transition-all"
            style={{ borderColor: emailInput ? `${accent}66` : undefined }}
            disabled={status === "checking" || status === "ok"}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <label className="text-sm text-[#aaa] font-medium">App password</label>
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="text-xs transition-colors"
              style={{ color: accent }}
            >
              {showInstructions ? "Hide instructions" : "How to create one?"}
            </button>
          </div>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
            placeholder="xxxx xxxx xxxx xxxx"
            className="w-full px-4 py-3 rounded-xl bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] text-white placeholder-[#444] focus:outline-none transition-all font-mono"
            style={{ borderColor: passwordInput ? `${accent}66` : undefined }}
            disabled={status === "checking" || status === "ok"}
          />
        </div>
      </div>

      {/* Instructions panel */}
      {showInstructions && (
        <div className="rounded-xl p-4 bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] text-sm text-[#aaa] flex flex-col gap-2">
          <p className="font-semibold text-white">Creating a Google App Password:</p>
          <ol className="list-decimal list-inside flex flex-col gap-1.5">
            <li>Go to <span className="text-white">myaccount.google.com</span></li>
            <li>Select <span className="text-white">Security → 2-Step Verification</span></li>
            <li>Scroll down to <span className="text-white">App passwords</span></li>
            <li>Create a new app password — name it <span className="text-white">&quot;AM Assistant&quot;</span></li>
            <li>Copy the 16-character code and paste it above</li>
          </ol>
          <p className="text-xs text-[#555] mt-1">
            Note: 2-Step Verification must be enabled on your account first.
          </p>
        </div>
      )}

      {/* Status feedback */}
      {status === "error" && (
        <div className="rounded-xl px-4 py-3 bg-[#FF525222] border border-[#FF525244] text-sm text-[#FF8080]">
          {errorMsg}
        </div>
      )}
      {status === "ok" && (
        <div className="rounded-xl px-4 py-3 bg-[#00E5CC22] border border-[#00E5CC44] text-sm" style={{ color: accent }}>
          ✓ Email verified — continuing...
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={status === "checking" || status === "ok"}
          className="flex-1 py-3 rounded-xl border border-[rgba(255,255,255,0.1)] text-[#888] font-medium hover:text-white transition-all disabled:opacity-40"
        >
          ← Back
        </button>
        <button
          onClick={handleVerify}
          disabled={status === "checking" || status === "ok"}
          className="flex-[2] py-3 rounded-xl font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
          style={{ background: accent, color: "#0f0f0f" }}
        >
          {status === "checking" ? "Verifying..." : status === "ok" ? "✓ Verified" : "Verify & continue →"}
        </button>
      </div>
    </div>
  );
}
