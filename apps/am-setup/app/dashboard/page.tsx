import { redirect } from "next/navigation";
import { readSetupState } from "@/lib/setup-state";
import Dashboard from "./Dashboard";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const state = readSetupState();
  if (!state.complete) {
    redirect("/setup");
  }
  return <Dashboard state={state} />;
}
