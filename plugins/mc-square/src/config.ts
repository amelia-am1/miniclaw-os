export interface SquareConfig {
  vaultBin: string;
  environment: "sandbox" | "production";
  locationId: string;
  currency: string;
}

export function resolveConfig(raw: Record<string, unknown>): SquareConfig {
  return {
    vaultBin: (raw.vaultBin as string) || `${process.env.HOME}/am/miniclaw/SYSTEM/bin/miniclaw-vault`,
    environment: (raw.environment as "sandbox" | "production") || "sandbox",
    locationId: (raw.locationId as string) || "",
    currency: (raw.currency as string) || "USD",
  };
}
