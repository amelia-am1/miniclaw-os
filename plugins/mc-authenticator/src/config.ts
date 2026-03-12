export interface AuthenticatorConfig {
  vaultBin: string;
}

export function resolveConfig(raw: Record<string, unknown>): AuthenticatorConfig {
  return {
    vaultBin: (raw.vaultBin as string) || `${process.env.HOME}/am/miniclaw/SYSTEM/bin/miniclaw-vault`,
  };
}
