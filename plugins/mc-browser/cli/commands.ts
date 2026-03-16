import { execSync, execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as net from "node:net";
import type { BrowserConfig } from "../index.js";

interface CommandContext {
  program: any;
  logger: { info: (m: string) => void; warn: (m: string) => void };
}

const CHROME_APP = "/Applications/Google Chrome.app";
const POLICY_DIR = "/Library/Google/Chrome/Managed Preferences";
const POLICY_FILE = `${POLICY_DIR}/com.google.Chrome.plist`;
const LAUNCH_AGENT_LABEL = "com.miniclaw.mc-chrome";

function relayExtensionDir(cfg: BrowserConfig): string {
  return path.join(cfg.stateDir, "miniclaw/plugins/mc-browser/assets/extension");
}

function launchAgentPlistPath(): string {
  return path.join(os.homedir(), "Library/LaunchAgents", `${LAUNCH_AGENT_LABEL}.plist`);
}

function mcChromeBin(cfg: BrowserConfig): string {
  return path.join(cfg.stateDir, "miniclaw/SYSTEM/bin/mc-chrome");
}

export function registerBrowserCommands(ctx: CommandContext, cfg: BrowserConfig): void {
  const browser = ctx.program
    .command("mc-browser")
    .description("Chrome browser setup and health checks for MiniClaw");

  browser
    .command("check")
    .description("Verify Chrome is installed, CDP port is accessible, and extensions are configured")
    .action(async () => {
      let ok = true;

      // 1. Chrome installed?
      if (fs.existsSync(CHROME_APP)) {
        console.log(`  ✓  Chrome installed at ${CHROME_APP}`);
      } else {
        console.log(`  ✗  Chrome not found — run: brew install --cask google-chrome`);
        ok = false;
      }

      // 2. CDP port accessible?
      const cdpUp = await checkPort(cfg.cdpPort);
      if (cdpUp) {
        console.log(`  ✓  CDP port ${cfg.cdpPort} is listening`);
      } else {
        console.log(`  ⚠  CDP port ${cfg.cdpPort} not listening — Chrome may not be running with remote debugging`);
      }

      // 3. Extension policy configured?
      if (fs.existsSync(POLICY_FILE)) {
        try {
          const plistContent = execFileSync("defaults", ["read", POLICY_FILE, "ExtensionInstallForcelist"], {
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
          });
          const missingExts = cfg.extensionIds.filter((id) => !plistContent.includes(id));
          if (missingExts.length === 0) {
            console.log(`  ✓  Extension force-install policy configured (${cfg.extensionIds.length} extensions)`);
          } else {
            console.log(`  ⚠  Missing extensions in policy: ${missingExts.join(", ")}`);
          }
        } catch {
          console.log(`  ⚠  Could not read extension policy — run: mc-browser setup`);
        }
      } else {
        console.log(`  ⚠  Chrome managed policy not found — run: mc-browser setup`);
      }

      // 4. Remote debugging policy (RemoteDebuggingAllowed)?
      try {
        const val = execFileSync("defaults", ["read", POLICY_FILE, "RemoteDebuggingAllowed"], {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }).trim();
        if (val === "1") {
          console.log(`  ✓  Remote debugging allowed via Chrome policy`);
        } else {
          console.log(`  ⚠  RemoteDebuggingAllowed policy is not enabled`);
        }
      } catch {
        console.log(`  ⚠  RemoteDebuggingAllowed policy not set — run: mc-browser setup`);
      }

      // 5. LaunchAgent for persistent remote debugging?
      const plistPath = launchAgentPlistPath();
      if (fs.existsSync(plistPath)) {
        console.log(`  ✓  LaunchAgent installed at ${plistPath}`);
      } else {
        console.log(`  ⚠  LaunchAgent not installed — run: mc-browser setup`);
      }

      // 6. Browser Relay extension present?
      const extDir = relayExtensionDir(cfg);
      if (fs.existsSync(path.join(extDir, "manifest.json"))) {
        console.log(`  ✓  Browser Relay extension at ${extDir}`);
      } else {
        console.log(`  ⚠  Browser Relay extension not found — run: mc-browser setup`);
      }

      // 7. mc-chrome launcher?
      const mcChromeFile = mcChromeBin(cfg);
      if (fs.existsSync(mcChromeFile)) {
        console.log(`  ✓  mc-chrome launcher at ${mcChromeFile}`);
      } else {
        console.log(`  ⚠  mc-chrome launcher not found`);
      }

      process.exit(ok ? 0 : 1);
    });

  browser
    .command("setup")
    .description("Install Chrome, configure remote debugging, and set up extension policies")
    .action(async () => {
      // 1. Install Chrome if missing
      if (!fs.existsSync(CHROME_APP)) {
        console.log("Installing Google Chrome...");
        try {
          execSync("brew install --cask google-chrome", { stdio: "inherit" });
          console.log("  ✓  Chrome installed");
        } catch {
          console.error("  ✗  Chrome install failed — download from https://google.com/chrome");
          process.exit(1);
        }
      } else {
        console.log("  ✓  Chrome already installed");
      }

      // 2. Set up extension force-install policy (CWS extensions)
      console.log("Configuring Chrome extension policies...");
      try {
        execFileSync("sudo", ["mkdir", "-p", POLICY_DIR], { stdio: "inherit" });

        let existing: string[] = [];
        try {
          const raw = execFileSync("defaults", ["read", POLICY_FILE, "ExtensionInstallForcelist"], {
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
          });
          const matches = raw.match(/"([^"]+)"/g);
          if (matches) {
            existing = matches.map((m) => m.replace(/"/g, ""));
          }
        } catch {
          // no existing policy
        }

        for (const extId of cfg.extensionIds) {
          const entry = `${extId};https://clients2.google.com/service/update2/crx`;
          if (!existing.some((e) => e.includes(extId))) {
            existing.push(entry);
          }
        }

        execFileSync("sudo", ["defaults", "write", POLICY_FILE, "ExtensionInstallForcelist", "-array", ...existing], {
          stdio: "inherit",
        });
        console.log(`  ✓  Extension policy updated (${existing.length} extensions)`);
      } catch {
        console.error(`  ✗  Failed to write extension policy (sudo required)`);
      }

      // 3. Enable persistent remote debugging via Chrome enterprise policy
      console.log("Configuring persistent remote debugging...");
      try {
        // RemoteDebuggingAllowed — Chrome enterprise policy that permits --remote-debugging-port
        execFileSync("sudo", ["defaults", "write", POLICY_FILE, "RemoteDebuggingAllowed", "-bool", "true"], {
          stdio: "inherit",
        });
        // Suppress the "you are using an unsupported command-line flag" warning bar
        execFileSync("sudo", ["defaults", "write", POLICY_FILE, "CommandLineFlagSecurityWarningsEnabled", "-bool", "false"], {
          stdio: "inherit",
        });
        console.log(`  ✓  Remote debugging policy enabled (RemoteDebuggingAllowed + no warnings)`);
      } catch {
        console.error(`  ⚠  Could not set Chrome policy (sudo required)`);
      }

      // 4. Copy Browser Relay extension to plugin assets in state dir
      console.log("Installing Browser Relay extension...");
      const extDst = relayExtensionDir(cfg);
      const extSrc = path.join(__dirname, "..", "assets", "extension");
      try {
        if (fs.existsSync(extSrc) && !fs.existsSync(path.join(extDst, "manifest.json"))) {
          fs.mkdirSync(extDst, { recursive: true });
          for (const file of fs.readdirSync(extSrc)) {
            fs.copyFileSync(path.join(extSrc, file), path.join(extDst, file));
          }
          console.log(`  ✓  Browser Relay extension copied to ${extDst}`);
        } else if (fs.existsSync(path.join(extDst, "manifest.json"))) {
          console.log(`  ✓  Browser Relay extension already installed at ${extDst}`);
        } else {
          console.log(`  ⚠  Extension source not found at ${extSrc}`);
        }
      } catch (err) {
        console.error(`  ✗  Failed to copy extension: ${err}`);
      }

      // 5. Update mc-chrome launcher to load Browser Relay extension
      console.log("Updating mc-chrome launcher...");
      const mcChromeFile = mcChromeBin(cfg);
      try {
        const launcherScript = `#!/usr/bin/env bash
# mc-chrome — launch Google Chrome with remote debugging + Browser Relay extension
set -euo pipefail

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT="\${MC_CHROME_DEBUG_PORT:-${cfg.cdpPort}}"
EXT_DIR="${extDst}"

if [[ ! -x "$CHROME" ]]; then
  echo "error: Google Chrome not found at $CHROME — install via: brew install --cask google-chrome" >&2
  exit 1
fi

EXTRA_ARGS=("--remote-debugging-port=$PORT")
if [[ -d "$EXT_DIR" ]]; then
  EXTRA_ARGS+=("--load-extension=$EXT_DIR")
fi

exec "$CHROME" "\${EXTRA_ARGS[@]}" "$@"
`;
        fs.mkdirSync(path.dirname(mcChromeFile), { recursive: true });
        fs.writeFileSync(mcChromeFile, launcherScript, { mode: 0o755 });
        console.log(`  ✓  mc-chrome updated with --load-extension at ${mcChromeFile}`);
      } catch (err) {
        console.error(`  ✗  Failed to update mc-chrome: ${err}`);
      }

      // 6. Install LaunchAgent so Chrome starts with remote debugging on login
      console.log("Installing LaunchAgent for persistent remote debugging...");
      const plistPath = launchAgentPlistPath();
      try {
        const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCH_AGENT_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${mcChromeFile}</string>
    <string>--no-first-run</string>
    <string>--no-default-browser-check</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
  <key>EnvironmentVariables</key>
  <dict>
    <key>MC_CHROME_DEBUG_PORT</key>
    <string>${cfg.cdpPort}</string>
  </dict>
</dict>
</plist>
`;
        fs.mkdirSync(path.dirname(plistPath), { recursive: true });
        fs.writeFileSync(plistPath, plistContent);
        console.log(`  ✓  LaunchAgent installed at ${plistPath}`);

        // Load the agent (don't fail if already loaded)
        try {
          try { execFileSync("launchctl", ["unload", plistPath], { stdio: "pipe" }); } catch { /* not loaded */ }
          execFileSync("launchctl", ["load", plistPath], { stdio: "pipe" });
          console.log(`  ✓  LaunchAgent loaded`);
        } catch {
          console.log(`  ⚠  LaunchAgent written but could not be loaded — will activate on next login`);
        }
      } catch (err) {
        console.error(`  ✗  Failed to install LaunchAgent: ${err}`);
      }

      console.log("\nBrowser setup complete.");
      console.log("  Chrome will launch with remote debugging on port " + cfg.cdpPort + " at login.");
      console.log("  Browser Relay extension will be loaded automatically.");
      console.log("  Launch now with: mc-chrome");
    });
}

function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      resolve(false);
    });
    socket.connect(port, "127.0.0.1");
  });
}
