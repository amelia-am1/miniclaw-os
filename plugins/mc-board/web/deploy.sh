#!/usr/bin/env bash
set -euo pipefail

# Build and deploy the mc-board web app to the live service
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$HOME/.openclaw/miniclaw/plugins/mc-board/web"
SERVICE="com.miniclaw.board-web"

echo "→ Building..."
cd "$SCRIPT_DIR"
npm run build

echo "→ Deploying to $DEPLOY_DIR..."
rm -rf "$DEPLOY_DIR/.next"
cp -r .next "$DEPLOY_DIR/.next"

echo "→ Restarting $SERVICE..."
launchctl kickstart -k "gui/$(id -u)/$SERVICE"

echo "✓ Done"
