"use client";

import { useState, useEffect } from "react";
import StepTelegram from "@/app/setup/steps/StepTelegram";
import StepGithub from "@/app/setup/steps/StepGithub";
import StepEmail from "@/app/setup/steps/StepEmail";
import StepGemini from "@/app/setup/steps/StepGemini";
import StepAnthropic from "@/app/setup/steps/StepAnthropic";

type SettingKey = "telegram" | "github" | "email" | "gemini" | "anthropic" | null;

interface SettingItem {
  key: SettingKey & string;
  icon: string;
  iconBg: string;
  title: string;
  description: string;
}

const SETTINGS: SettingItem[] = [
  { key: "telegram", icon: "💬", iconBg: "#0088cc22", title: "Telegram", description: "Bot connection for messaging" },
  { key: "github", icon: "🐙", iconBg: "#6e40c922", title: "GitHub", description: "Code access, repos, and custom tools" },
  { key: "email", icon: "📧", iconBg: "#ea443422", title: "Email", description: "Inbox, agent actions, and triage" },
  { key: "gemini", icon: "🎨", iconBg: "#4285f422", title: "Gemini", description: "Image generation API key" },
  { key: "anthropic", icon: "🧠", iconBg: "#d4a57422", title: "Claude", description: "Subscription and compute" },
];

export function SettingsPage() {
  const [active, setActive] = useState<SettingKey>(null);
  const [state, setState] = useState<Record<string, string>>({});
  const [configured, setConfigured] = useState<Record<string, boolean>>({});

  // Load current setup state
  useEffect(() => {
    fetch("/api/setup/state")
      .then((r) => r.json())
      .then((data) => {
        setState(data);
        setConfigured({
          telegram: !!data.telegramBotToken,
          github: !!data.ghConfigured,
          email: !!data.emailConfigured,
          gemini: !!data.geminiConfigured,
          anthropic: !!data.anthropicToken || !!data.complete,
        });
      })
      .catch(() => {});
  }, [active]); // re-fetch when returning to list

  const accent = state.accentColor || "#00E5CC";
  const assistantName = state.shortName || state.assistantName || "Am";

  const goBack = () => setActive(null);

  // Render the active setting's component
  if (active) {
    return (
      <div className="flex flex-col h-full">
        <div
          className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800 flex-shrink-0"
        >
          <button
            onClick={goBack}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ← Settings
          </button>
          <span className="text-sm text-zinc-600">/</span>
          <span className="text-sm text-zinc-300 font-medium">
            {SETTINGS.find((s) => s.key === active)?.title}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto flex items-start justify-center px-4 py-12">
          <div className="w-full max-w-xl step-enter">
            {active === "telegram" && (
              <StepTelegram
                botUsername={state.telegramBotUsername || ""}
                botToken={state.telegramBotToken || ""}
                chatId={state.telegramChatId || ""}
                assistantName={assistantName}
                onChange={() => {}}
                onNext={goBack}
                onBack={goBack}
                accent={accent}
              />
            )}
            {active === "github" && (
              <StepGithub
                ghToken=""
                assistantName={assistantName}
                onChange={() => {}}
                onNext={goBack}
                onBack={goBack}
                accent={accent}
              />
            )}
            {active === "email" && (
              <StepEmail
                email={state.emailAddress || ""}
                appPassword=""
                onChange={() => {}}
                onNext={goBack}
                onBack={goBack}
                accent={accent}
              />
            )}
            {active === "gemini" && (
              <StepGemini
                apiKey=""
                onChange={() => {}}
                onNext={goBack}
                onBack={goBack}
                accent={accent}
              />
            )}
            {active === "anthropic" && (
              <StepAnthropic
                setupToken=""
                onChange={() => {}}
                onNext={goBack}
                onBack={goBack}
                accent={accent}
                assistantName={assistantName}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Settings list
  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800 flex-shrink-0"
      >
        <span className="text-sm font-semibold text-zinc-300">Settings</span>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-xl mx-auto settings-grid">
          {SETTINGS.map((item) => (
            <button
              key={item.key}
              onClick={() => setActive(item.key)}
              className="settings-item"
            >
              <div
                className="settings-item-icon"
                style={{ background: item.iconBg }}
              >
                {item.icon}
              </div>
              <div className="settings-item-info">
                <div className="settings-item-title">{item.title}</div>
                <div className="settings-item-desc">{item.description}</div>
              </div>
              <span
                className={`settings-item-status ${
                  configured[item.key] ? "configured" : "not-configured"
                }`}
              >
                {configured[item.key] ? "Configured" : "Not set"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
