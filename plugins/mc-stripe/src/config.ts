export interface StripeConfig {
  vaultBin: string;
  testMode: boolean;
}

export function resolveConfig(raw: Record<string, unknown>): StripeConfig {
  return {
    vaultBin: (raw.vaultBin as string) || `${process.env.HOME}/am/miniclaw/SYSTEM/bin/miniclaw-vault`,
    testMode: (raw.testMode as boolean) ?? false,
  };
}
