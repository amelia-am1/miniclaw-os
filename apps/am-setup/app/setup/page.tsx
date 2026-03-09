import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/setup-state";
import SetupWizard from "./SetupWizard";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  if (isSetupComplete()) {
    redirect("/dashboard");
  }
  return <SetupWizard />;
}
