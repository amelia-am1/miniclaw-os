"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import InstallOverlay from "./InstallOverlay";
import StepMeetHer from "./steps/StepMeetHer";
import StepTelegram from "./steps/StepTelegram";
import StepGithub from "./steps/StepGithub";
import StepAnthropic from "./steps/StepAnthropic";
import StepEmail from "./steps/StepEmail";
import StepGemini from "./steps/StepGemini";
import StepInstalling from "./steps/StepInstalling";
import StepDone from "./steps/StepDone";

export type WizardState = {
  assistantName: string;
  shortName: string;
  pronouns: string;
  accentColor: string;
  personaBlurb: string;
  anthropicToken: string;
  emailAddress: string;
  appPassword: string;
  geminiKey: string;
  ghToken: string;
  telegramBotUsername: string;
  telegramBotToken: string;
  telegramChatId: string;
};

const STEPS = [
  "meet",
  "telegram",
  "github",
  "email",
  "gemini",
  "anthropic",
  "installing",
  "done",
] as const;
type Step = (typeof STEPS)[number];

const NUMBERED_STEPS = ["meet", "telegram", "github", "email", "gemini", "anthropic"] as const;

function stepFromPath(pathname: string): Step {
  const seg = pathname.split("/").pop() || "";
  if (STEPS.includes(seg as Step)) return seg as Step;
  return "meet";
}

export default function SetupWizard() {
  const router = useRouter();
  const pathname = usePathname();
  const [step, setStepState] = useState<Step>(() => stepFromPath(pathname));
  const [state, setState] = useState<WizardState>(() => {
    const defaults: WizardState = {
      assistantName: "",
      shortName: "",
      pronouns: "she/her",
      accentColor: "#00E5CC",
      personaBlurb: "",
      anthropicToken: "",
      emailAddress: "",
      appPassword: "",
      geminiKey: "",
      ghToken: "",
      telegramBotUsername: "",
      telegramBotToken: "",
      telegramChatId: "",
    };
    if (typeof window === "undefined") return defaults;
    try {
      const saved = sessionStorage.getItem("mc-wizard-state");
      if (saved) return { ...defaults, ...JSON.parse(saved) };
    } catch {}
    return defaults;
  });

  // Persist wizard state to sessionStorage on every change
  useEffect(() => {
    try { sessionStorage.setItem("mc-wizard-state", JSON.stringify(state)); } catch {}
  }, [state]);

  // Sync step from URL on pathname change
  useEffect(() => {
    const s = stepFromPath(pathname);
    setStepState(s);
  }, [pathname]);

  const setStep = useCallback(
    (s: Step) => {
      setStepState(s);
      router.push(`/setup/${s}`);
    },
    [router],
  );

  const next = useCallback(() => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  }, [step, setStep]);

  const back = useCallback(() => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }, [step, setStep]);

  const update = useCallback((patch: Partial<WizardState>) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  const stepNum = NUMBERED_STEPS.indexOf(step as (typeof NUMBERED_STEPS)[number]) + 1;

  // Splash screen — only on very first load (persisted via sessionStorage)
  const [splash, setSplash] = useState(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem("mc-splash-shown");
  });
  const [splashFade, setSplashFade] = useState(false);
  const [splashLine, setSplashLine] = useState(0);
  useEffect(() => {
    if (!splash) return;
    sessionStorage.setItem("mc-splash-shown", "1");
    const t1 = setTimeout(() => setSplashLine(1), 800);
    const t2 = setTimeout(() => setSplashLine(2), 1800);
    const t3 = setTimeout(() => setSplashLine(3), 2800);
    const fade = setTimeout(() => setSplashFade(true), 4000);
    const hide = setTimeout(() => setSplash(false), 4700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(fade); clearTimeout(hide); };
  }, [splash]);

  const accentStyle = {
    "--user-accent": state.accentColor,
  } as React.CSSProperties;

  if (splash) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center"
        style={{
          background: "#0f0f0f",
          opacity: splashFade ? 0 : 1,
          transition: "opacity 0.7s ease-out",
        }}
      >
        <Image
          src="/miniclaw-logo.png"
          alt="MiniClaw"
          width={160}
          height={160}
          priority
          style={{ animation: "splashPulse 2s ease-in-out infinite" }}
        />
        <div style={{ marginTop: 28, textAlign: "center", fontSize: 18, display: "flex", gap: 8, justifyContent: "center" }}>
          {splashLine >= 1 && <span style={{ color: "#ccc", animation: "fadeUp 0.6s ease-out forwards" }}>Your own AI.</span>}
          {splashLine >= 2 && <span style={{ color: "#aaa", animation: "fadeUp 0.6s ease-out forwards" }}>Your Mac.</span>}
          {splashLine >= 3 && <span style={{ color: "#888", animation: "fadeUp 0.6s ease-out forwards" }}>Your data.</span>}
        </div>
        <style>{`
          @keyframes splashPulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.9; }
          }
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={accentStyle}
    >

      {/* Install overlay — floating pill + draggable log window */}
      <InstallOverlay accent={state.accentColor} />

      {/* Progress indicator */}
      {stepNum > 0 && step !== "installing" && step !== "done" && (
        <div className="mb-8 flex items-center gap-2">
          <span className="text-xs text-[#666] mr-1">
            {stepNum}/{NUMBERED_STEPS.length}
          </span>
          {NUMBERED_STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all duration-500"
              style={{
                width: i < stepNum ? "32px" : "12px",
                background:
                  i < stepNum
                    ? state.accentColor
                    : "rgba(255,255,255,0.15)",
              }}
            />
          ))}
        </div>
      )}

      {/* Step content */}
      <div className="w-full max-w-xl step-enter" key={step}>
        {step === "meet" && (
          <StepMeetHer
            name={state.assistantName}
            shortName={state.shortName}
            pronouns={state.pronouns}
            accentColor={state.accentColor}
            onChange={(p) => update(p)}
            onNext={next}
          />
        )}
        {step === "telegram" && (
          <StepTelegram
            botUsername={state.telegramBotUsername}
            botToken={state.telegramBotToken}
            chatId={state.telegramChatId}
            assistantName={state.shortName || state.assistantName}
            onChange={(p) => update(p)}
            onNext={next}
            onBack={back}
            accent={state.accentColor}
          />
        )}
        {step === "github" && (
          <StepGithub
            ghToken={state.ghToken}
            assistantName={state.shortName || state.assistantName}
            onChange={(v) => update({ ghToken: v })}
            onNext={next}
            onBack={back}
            accent={state.accentColor}
          />
        )}
        {step === "email" && (
          <StepEmail
            email={state.emailAddress}
            appPassword={state.appPassword}
            onChange={(p) => update(p)}
            onNext={next}
            onBack={back}
            accent={state.accentColor}
          />
        )}
        {step === "gemini" && (
          <StepGemini
            apiKey={state.geminiKey}
            onChange={(v) => update({ geminiKey: v })}
            onNext={next}
            onBack={back}
            accent={state.accentColor}
          />
        )}
        {step === "anthropic" && (
          <StepAnthropic
            setupToken={state.anthropicToken}
            onChange={(v) => update({ anthropicToken: v })}
            onNext={next}
            onBack={back}
            accent={state.accentColor}
            assistantName={state.shortName || state.assistantName}
          />
        )}
        {step === "installing" && (
          <StepInstalling state={state} onDone={next} accent={state.accentColor} />
        )}
        {step === "done" && (
          <StepDone
            name={state.shortName || state.assistantName}
            accent={state.accentColor}
          />
        )}
      </div>
    </div>
  );
}
