#!/usr/bin/env bash
# bootstrap.sh — miniclaw-os one-click installer
#
# Downloads the repo, installs the board web app as a LaunchAgent,
# and opens the browser. Everything happens in the browser from there.
#
# Usage:
#   curl -fsSL https://miniclaw.bot/install | bash

set -euo pipefail

REPO_URL="https://github.com/augmentedmike/miniclaw-os.git"
INSTALL_DIR="${HOME}/.openclaw/projects/miniclaw-os"
STATE_DIR="${HOME}/.openclaw"
APP_PORT=4220
LOG_FILE="/tmp/miniclaw-bootstrap.log"
NODE_BIN=""

echo ""
echo "  🦀 MiniClaw"
echo "  Starting setup..."
echo ""

# ── macOS check ──────────────────────────────────────────────────────────────
[[ "$(uname)" == "Darwin" ]] || { echo "  Error: macOS required."; exit 1; }

# ── Xcode CLT (provides git) ────────────────────────────────────────────────
if ! xcode-select -p &>/dev/null; then
  echo "  Installing developer tools (this may take a minute)..."
  xcode-select --install 2>/dev/null || true
  until xcode-select -p &>/dev/null; do sleep 5; done
fi

# ── Node.js ──────────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "  Installing Node.js..."
  if command -v brew &>/dev/null; then
    brew install node@22 >>"$LOG_FILE" 2>&1
  else
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" </dev/null >>"$LOG_FILE" 2>&1
    BREW_PREFIX=$([[ "$(uname -m)" == "arm64" ]] && echo "/opt/homebrew" || echo "/usr/local")
    eval "$($BREW_PREFIX/bin/brew shellenv)"
    brew install node@22 >>"$LOG_FILE" 2>&1
  fi
fi

# Resolve node binary path for LaunchAgent (can't rely on shell PATH)
BREW_PREFIX=$([[ "$(uname -m)" == "arm64" ]] && echo "/opt/homebrew" || echo "/usr/local")
NODE_BIN=$(which node 2>/dev/null || echo "$BREW_PREFIX/opt/node@22/bin/node")
export PATH="$(dirname "$NODE_BIN"):$BREW_PREFIX/bin:$PATH"

# ── Evacuate any existing install ────────────────────────────────────────────
if [[ -d "$INSTALL_DIR" ]]; then
  EVAC_DIR="${INSTALL_DIR}.previous-$(date +%Y%m%d-%H%M%S)"
  echo "  Backing up previous install → $(basename "$EVAC_DIR")"
  mv "$INSTALL_DIR" "$EVAC_DIR"
  export OPENCLAW_EVAC_DIR="$EVAC_DIR"
fi

# ── Fresh clone ──────────────────────────────────────────────────────────────
echo "  Downloading MiniClaw..."
mkdir -p "$(dirname "$INSTALL_DIR")"
git clone -q --depth 1 "$REPO_URL" "$INSTALL_DIR"

# ── Build the board web app ──────────────────────────────────────────────────
APP_DIR="$INSTALL_DIR/plugins/mc-board/web"
echo "  Building app..."
(cd "$APP_DIR" && npm install --silent >>"$LOG_FILE" 2>&1)
(cd "$APP_DIR" && npx next build >>"$LOG_FILE" 2>&1) || true

# ── Reset setup state ────────────────────────────────────────────────────────
mkdir -p "$STATE_DIR/USER" "$STATE_DIR/logs"
rm -f "$STATE_DIR/USER/setup-state.json"

# ── Sudo for /etc/hosts + port 80 ───────────────────────────────────────────
echo "  Setting up local access (may need your password)..."
if ! sudo -n true 2>/dev/null; then
  sudo -v || { echo "  ! sudo required"; }
fi

# ── Add myam.localhost hostname ──────────────────────────────────────────────────
if ! grep -q 'myam.localhost' /etc/hosts 2>/dev/null; then
  echo "127.0.0.1 myam.localhost" | sudo tee -a /etc/hosts >/dev/null 2>&1
  echo "  ✓ myam.localhost added"
fi

# ── Port 80 → 4220 redirect via pfctl ────────────────────────────────────────
# This lets users access http://myam.localhost with no port number.
PF_RULE="rdr pass on lo0 inet proto tcp from any to 127.0.0.1 port 80 -> 127.0.0.1 port $APP_PORT"

# Load the rule directly into a named anchor (no pf.conf editing needed)
echo "$PF_RULE" | sudo pfctl -a com.miniclaw -f - 2>/dev/null
sudo pfctl -e 2>/dev/null || true

# Also install a LaunchDaemon so the redirect survives reboots
PF_DAEMON="/Library/LaunchDaemons/com.miniclaw.pfctl.plist"
sudo tee "$PF_DAEMON" >/dev/null << PFDAEMON
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.miniclaw.pfctl</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>-c</string>
    <string>echo "$PF_RULE" | /sbin/pfctl -a com.miniclaw -f - 2>/dev/null; /sbin/pfctl -e 2>/dev/null; true</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
PFDAEMON
sudo launchctl load "$PF_DAEMON" 2>/dev/null || true
echo "  ✓ http://myam.localhost → port $APP_PORT"

# ── Install LaunchAgent (persists across reboots) ────────────────────────────
echo "  Installing service..."
PLIST="$HOME/Library/LaunchAgents/com.miniclaw.board-web.plist"
mkdir -p "$HOME/Library/LaunchAgents"

# Unload if already running
launchctl unload "$PLIST" 2>/dev/null || true

cat > "$PLIST" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.miniclaw.board-web</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$APP_DIR/node_modules/.bin/next</string>
    <string>start</string>
    <string>-p</string>
    <string>$APP_PORT</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$APP_DIR</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>5</integer>
  <key>StandardOutPath</key>
  <string>$STATE_DIR/logs/miniclaw-board-web.log</string>
  <key>StandardErrorPath</key>
  <string>$STATE_DIR/logs/miniclaw-board-web.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>$HOME</string>
    <key>PATH</key>
    <string>$(dirname "$NODE_BIN"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>OPENCLAW_STATE_DIR</key>
    <string>$STATE_DIR</string>
    <key>MINICLAW_OS_DIR</key>
    <string>$INSTALL_DIR</string>
    <key>NODE_ENV</key>
    <string>production</string>
  </dict>
</dict>
</plist>
PLIST

# Kill anything on the port before starting
PORT_PID=$(lsof -ti ":$APP_PORT" 2>/dev/null | head -1 || true)
if [[ -n "$PORT_PID" ]]; then
  kill "$PORT_PID" 2>/dev/null || true
  sleep 1
fi

launchctl load "$PLIST" 2>/dev/null
echo "  ✓ Service installed (starts on boot)"

# ── Wait for the app to be ready ─────────────────────────────────────────────
echo ""
for i in $(seq 1 30); do
  if curl -sf "http://localhost:$APP_PORT/api/health" &>/dev/null; then
    break
  fi
  sleep 1
done

# ── Open browser ─────────────────────────────────────────────────────────────
APP_URL="http://myam.localhost"
if command -v open &>/dev/null; then
  open "$APP_URL"
fi

echo "  ✓ MiniClaw is running."
echo ""
echo "  $APP_URL"
echo ""
echo "  You can close this terminal — MiniClaw runs in the background."
echo ""
