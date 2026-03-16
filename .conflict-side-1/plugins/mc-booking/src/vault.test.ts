/**
 * vault.test.ts — unit tests for mc-booking vault helpers
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { vaultGet, vaultSet, getTursoUrl, getTursoToken } from "./vault.js";

let tmpDir: string;
let fakeVault: string;
let storePath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-booking-vault-test-"));
  storePath = path.join(tmpDir, "store.json");
  fs.writeFileSync(storePath, "{}");

  fakeVault = path.join(tmpDir, "fake-vault");
  fs.writeFileSync(
    fakeVault,
    `#!/bin/bash
STORE="${storePath}"
CMD="$1"
KEY="$2"
VAL="$3"

if [ "$CMD" = "get" ]; then
  val=$(cat "$STORE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$KEY',''))" 2>/dev/null)
  if [ -n "$val" ]; then
    echo "$KEY = $val"
  else
    exit 1
  fi
elif [ "$CMD" = "set" ]; then
  VAL=$(echo "$VAL" | sed 's/^"//;s/"$//')
  python3 -c "
import sys,json
with open('$STORE') as f: d=json.load(f)
d['$KEY']='$VAL'
with open('$STORE','w') as f: json.dump(d,f)
"
fi
`,
  );
  fs.chmodSync(fakeVault, 0o755);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("vaultGet / vaultSet", () => {
  it("returns null for missing key", () => {
    expect(vaultGet(fakeVault, "nonexistent")).toBeNull();
  });

  it("round-trips a value", () => {
    vaultSet(fakeVault, "test-key", "test-value");
    expect(vaultGet(fakeVault, "test-key")).toBe("test-value");
  });
});

describe("getTursoUrl", () => {
  it("returns null when not set", () => {
    expect(getTursoUrl(fakeVault)).toBeNull();
  });

  it("returns URL after setting", () => {
    vaultSet(fakeVault, "turso-booking-url", "libsql://test-db.turso.io");
    expect(getTursoUrl(fakeVault)).toBe("libsql://test-db.turso.io");
  });
});

describe("getTursoToken", () => {
  it("returns null when not set", () => {
    expect(getTursoToken(fakeVault)).toBeNull();
  });

  it("returns token after setting", () => {
    vaultSet(fakeVault, "turso-booking-token", "eyJ0eXAiOi...");
    expect(getTursoToken(fakeVault)).toBe("eyJ0eXAiOi...");
  });
});
