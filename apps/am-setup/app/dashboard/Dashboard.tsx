"use client";

import type { SetupState } from "@/lib/setup-state";
import { useState, useEffect } from "react";

interface Props {
  state: SetupState;
}

interface HealthData {
  ok: boolean;
  emailConfigured: boolean;
  geminiConfigured: boolean;
  timestamp: string;
}

export default function Dashboard({ state }: Props) {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [now, setNow] = useState(new Date());

  const accent = state.accentColor || "#00E5CC";

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => {});

    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const greeting = () => {
    const h = now.getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const dayStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className="min-h-screen"
      style={{ ["--user-accent" as string]: accent }}
    >
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between border-b border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
            style={{ background: `${accent}22`, color: accent }}
          >
            {state.assistantName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{state.assistantName}</div>
            <div className="text-xs flex items-center gap-1" style={{ color: accent }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: accent }} />
              Online
            </div>
          </div>
        </div>
        <div className="text-sm text-[#555]">{dayStr}</div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-8">
        {/* Greeting */}
        <div>
          <h1 className="text-3xl font-bold text-white">
            {greeting()}.
          </h1>
          <p className="text-[#666] mt-1">
            {state.assistantName} is running and watching your inbox.
          </p>
        </div>

        {/* Today summary card */}
        <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ background: `${accent}0d`, border: `1px solid ${accent}22` }}>
          <div className="flex items-center gap-2">
            <span style={{ color: accent }}>✦</span>
            <span className="text-sm font-semibold text-white uppercase tracking-wide">Today</span>
          </div>
          <p className="text-[#888] text-sm leading-relaxed">
            {state.assistantName} started monitoring your inbox at setup. Email triage runs every 2 hours
            from 7 AM to 11 PM. Your first digest will arrive later today.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Emails checked" value="—" accent={accent} />
            <Stat label="Tasks queued" value="0" accent={accent} />
            <Stat label="Alerts sent" value="0" accent={accent} />
          </div>
        </div>

        {/* Email status */}
        <div className="rounded-2xl p-6 flex flex-col gap-4 bg-[#1a1a1a] border border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[#888] text-sm font-semibold uppercase tracking-wide">Email</span>
            </div>
            <StatusPill ok={state.emailConfigured} accent={accent} />
          </div>
          <div className="text-sm text-[#666]">
            {state.emailConfigured ? (
              <span>Connected as <span className="text-[#aaa]">{state.emailAddress}</span></span>
            ) : (
              <span>Not configured</span>
            )}
          </div>
        </div>

        {/* System health */}
        <div className="rounded-2xl p-6 flex flex-col gap-4 bg-[#1a1a1a] border border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center justify-between">
            <span className="text-[#888] text-sm font-semibold uppercase tracking-wide">System health</span>
            <StatusPill ok={health?.ok ?? true} accent={accent} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <HealthItem label="AM server" ok={health?.ok ?? true} accent={accent} />
            <HealthItem label="Email access" ok={state.emailConfigured} accent={accent} />
            <HealthItem label="Vault" ok={true} accent={accent} />
            <HealthItem label="Vision (Gemini)" ok={state.geminiConfigured} accent={accent} optional />
          </div>
        </div>

        {/* Quick actions */}
        <div className="rounded-2xl p-6 flex flex-col gap-4 bg-[#1a1a1a] border border-[rgba(255,255,255,0.06)]">
          <span className="text-[#888] text-sm font-semibold uppercase tracking-wide">Quick actions</span>
          <div className="flex flex-wrap gap-3">
            <ActionButton label="Check inbox now" accent={accent} />
            <ActionButton label="View task queue" accent={accent} />
            <ActionButton label="Open brain board" accent={accent} href="http://localhost:4220" />
            <ActionButton label="Settings" accent={accent} />
          </div>
        </div>

        <p className="text-xs text-center text-[#333]">
          {state.assistantName} runs locally on your device · No data leaves your machine
        </p>
      </main>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl p-3 bg-[rgba(0,0,0,0.2)] flex flex-col gap-1">
      <div className="text-xl font-bold" style={{ color: accent }}>{value}</div>
      <div className="text-xs text-[#666]">{label}</div>
    </div>
  );
}

function StatusPill({ ok, accent }: { ok: boolean; accent: string }) {
  return (
    <div
      className="px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5"
      style={{
        background: ok ? `${accent}22` : "rgba(255,82,82,0.15)",
        color: ok ? accent : "#FF5252",
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: ok ? accent : "#FF5252" }} />
      {ok ? "Online" : "Offline"}
    </div>
  );
}

function HealthItem({ label, ok, accent, optional }: { label: string; ok: boolean; accent: string; optional?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span style={{ color: ok ? accent : optional ? "#444" : "#FF5252" }}>
        {ok ? "✓" : optional ? "○" : "✗"}
      </span>
      <span className={ok ? "text-[#aaa]" : optional ? "text-[#555]" : "text-[#888]"}>{label}</span>
    </div>
  );
}

function ActionButton({ label, accent, href }: { label: string; accent: string; href?: string }) {
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80"
        style={{ background: `${accent}22`, color: accent }}
      >
        {label} ↗
      </a>
    );
  }
  return (
    <button
      className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80"
      style={{ background: "rgba(255,255,255,0.06)", color: "#888" }}
    >
      {label}
    </button>
  );
}
