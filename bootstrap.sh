#!/usr/bin/env bash
# bootstrap.sh — miniclaw-os one-click installer
#
# Downloads the repo and launches the board web app (which includes setup).
# Everything happens in the browser — no terminal knowledge needed.
#
# Usage:
#   curl -fsSL https://miniclaw.bot/install | bash
#   curl -fsSL https://raw.githubusercontent.com/augmentedmike/miniclaw-os/main/bootstrap.sh | bash

set -euo pipefail

REPO_URL="https://github.com/augmentedmike/miniclaw-os.git"
INSTALL_DIR="${HOME}/.openclaw/projects/miniclaw-os"
APP_PORT=4220
LOG_FILE="/tmp/miniclaw-bootstrap.log"

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
    BREW_PREFIX=$([[ "$(uname -m)" == "arm64" ]] && echo "/opt/homebrew" || echo "/usr/local")
    export PATH="$BREW_PREFIX/opt/node@22/bin:$PATH"
  else
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" </dev/null >>"$LOG_FILE" 2>&1
    BREW_PREFIX=$([[ "$(uname -m)" == "arm64" ]] && echo "/opt/homebrew" || echo "/usr/local")
    eval "$($BREW_PREFIX/bin/brew shellenv)"
    brew install node@22 >>"$LOG_FILE" 2>&1
    export PATH="$BREW_PREFIX/opt/node@22/bin:$PATH"
  fi
fi

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

# ── Build the board web app (includes setup wizard + settings) ───────────────
APP_DIR="$INSTALL_DIR/plugins/mc-board/web"
echo "  Preparing app..."
(cd "$APP_DIR" && npm install --silent >>"$LOG_FILE" 2>&1)
(cd "$APP_DIR" && npx next build >>"$LOG_FILE" 2>&1) || true

# ── Kill anything on the app port ────────────────────────────────────────────
PORT_PID=$(lsof -ti ":$APP_PORT" 2>/dev/null | head -1 || true)
if [[ -n "$PORT_PID" ]]; then
  kill "$PORT_PID" 2>/dev/null || true
  sleep 1
fi

# ── Reset setup state so the wizard runs fresh ───────────────────────────────
rm -f "${HOME}/.openclaw/USER/setup-state.json"

# ── Add local hostname ───────────────────────────────────────────────────────
if ! grep -q 'myam.local' /etc/hosts 2>/dev/null; then
  echo "  Adding myam.local to /etc/hosts (may need your password)..."
  echo "127.0.0.1 myam.local" | sudo tee -a /etc/hosts >/dev/null 2>&1 \
    && echo "  ✓ myam.local added" \
    || echo "  ! Could not add myam.local — use localhost:$APP_PORT instead"
fi

# ── Start the app ────────────────────────────────────────────────────────────
echo "  Starting at http://localhost:$APP_PORT"
echo ""

export OPENCLAW_STATE_DIR="${HOME}/.openclaw"
export MINICLAW_OS_DIR="$INSTALL_DIR"
export NODE_ENV=production

cd "$APP_DIR"
npx next start -p "$APP_PORT" >>"$LOG_FILE" 2>&1 &
APP_PID=$!

# Wait for the server to be ready
for i in $(seq 1 30); do
  if curl -sf "http://localhost:$APP_PORT/api/health" &>/dev/null; then
    break
  fi
  sleep 1
done

# Open browser — goes to / which redirects to /setup/meet or /board
APP_URL="http://myam.local:$APP_PORT"
if command -v open &>/dev/null; then
  open "$APP_URL"
fi

echo "  ✓ Setup is running in your browser."
echo ""
echo "  If the browser didn't open, go to:"
echo "  $APP_URL"
echo ""
echo "  Close this terminal window when you're done."
echo ""

wait $APP_PID 2>/dev/null || true
