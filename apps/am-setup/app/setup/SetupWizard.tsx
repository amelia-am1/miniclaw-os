"use client";

import { useState, useCallback } from "react";
import StepWelcome from "./steps/StepWelcome";
import StepName from "./steps/StepName";
import StepColor from "./steps/StepColor";
import StepPersona from "./steps/StepPersona";
import StepEmail from "./steps/StepEmail";
import StepGemini from "./steps/StepGemini";
import StepInstalling from "./steps/StepInstalling";
import StepDone from "./steps/StepDone";

export type WizardState = {
  assistantName: string;
  accentColor: string;
  pronouns: string;
  personaBlurb: string;
  emailAddress: string;
  appPassword: string;
  geminiKey: string;
};

const STEPS = [
  "welcome",
  "name",
  "color",
  "persona",
  "email",
  "gemini",
  "installing",
  "done",
] as const;
type Step = (typeof STEPS)[number];

const TOTAL_STEPS = 6; // excludes welcome, installing, done

export default function SetupWizard() {
  const [step, setStep] = useState<Step>("welcome");
  const [state, setState] = useState<WizardState>({
    assistantName: "AM",
    accentColor: "#00E5CC",
    pronouns: "she/her",
    personaBlurb: "",
    emailAddress: "",
    appPassword: "",
    geminiKey: "",
  });

  const next = useCallback(() => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  }, [step]);

  const back = useCallback(() => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }, [step]);

  const update = useCallback((patch: Partial<WizardState>) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  const stepNum = ((): number => {
    const map: Partial<Record<Step, number>> = {
      name: 1, color: 2, persona: 3, email: 4, gemini: 5,
    };
    return map[step] ?? 0;
  })();

  const accentStyle = { "--user-accent": state.accentColor } as React.CSSProperties;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={accentStyle}>
      {/* Progress indicator */}
      {stepNum > 0 && step !== "installing" && step !== "done" && (
        <div className="mb-8 flex gap-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all duration-500"
              style={{
                width: i < stepNum ? "32px" : "12px",
                background: i < stepNum ? state.accentColor : "rgba(255,255,255,0.15)",
              }}
            />
          ))}
        </div>
      )}

      {/* Step content */}
      <div className="w-full max-w-md step-enter" key={step}>
        {step === "welcome" && <StepWelcome onNext={next} accent={state.accentColor} />}
        {step === "name" && (
          <StepName
            value={state.assistantName}
            onChange={(v) => update({ assistantName: v })}
            onNext={next}
            onBack={back}
            accent={state.accentColor}
          />
        )}
        {step === "color" && (
          <StepColor
            value={state.accentColor}
            name={state.assistantName}
            onChange={(v) => update({ accentColor: v })}
            onNext={next}
            onBack={back}
          />
        )}
        {step === "persona" && (
          <StepPersona
            pronouns={state.pronouns}
            blurb={state.personaBlurb}
            onChange={(p) => update(p)}
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
        {step === "installing" && (
          <StepInstalling state={state} onDone={next} accent={state.accentColor} />
        )}
        {step === "done" && (
          <StepDone name={state.assistantName} accent={state.accentColor} />
        )}
      </div>
    </div>
  );
}
