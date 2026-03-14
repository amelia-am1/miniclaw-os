import { WizardProvider } from "../wizard-context";
import SetupWizard from "../setup-wizard";

export const dynamic = "force-dynamic";

export default function StepPage() {
  return (
    <WizardProvider>
      <SetupWizard />
    </WizardProvider>
  );
}
