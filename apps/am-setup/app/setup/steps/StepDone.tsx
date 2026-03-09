"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface Props {
  name: string;
  accent: string;
}

export default function StepDone({ name, accent }: Props) {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      router.push("/dashboard");
    }, 3000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="text-center flex flex-col items-center gap-8">
      {/* Celebration mark */}
      <div
        className="w-24 h-24 rounded-full flex items-center justify-center text-4xl"
        style={{ background: `${accent}22`, border: `2px solid ${accent}` }}
      >
        ✦
      </div>

      <div>
        <h2 className="text-4xl font-bold text-white mb-3">
          {name} is ready.
        </h2>
        <p className="text-[#888] text-lg">
          She&apos;s been set up on your device and is already at work.
          Taking you to your dashboard now.
        </p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div
          className="h-1 rounded-full overflow-hidden w-48"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              background: accent,
              width: "100%",
              animation: "grow-bar 3s linear forwards",
            }}
          />
        </div>
        <p className="text-xs text-[#555]">Redirecting to your dashboard...</p>
      </div>

      <style>{`
        @keyframes grow-bar {
          from { transform: scaleX(0); transform-origin: left; }
          to { transform: scaleX(1); transform-origin: left; }
        }
      `}</style>
    </div>
  );
}
