#!/usr/bin/env bash
# uninstall.sh — remove everything installed by miniclaw-os install.sh
#
# Usage:
#   ./uninstall.sh          # interactive (asks before deleting)
#   ./uninstall.sh --force  # no prompts

set -euo pipefail

STATE_DIR="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
FORCE=false
[[ "${1:-}" == "--force" ]] && FORCE=true

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}[✓]${NC} $1"; }
warn() { echo -e "  ${YELLOW}[!]${NC} $1"; }
fail() { echo -e "  ${RED}[✗]${NC} $1"; }
skip() { echo -e "  ${YELLOW}[-]${NC} $1"; }

echo ""
echo -e "${BOLD}miniclaw-os uninstaller${NC}"
echo "  state dir: $STATE_DIR"
echo ""

if [[ "$FORCE" != true ]]; then
  echo -e "  ${RED}This will delete ~/.openclaw and all miniclaw data.${NC}"
  echo ""
  read -rp "  Continue? (y/N): " CONFIRM
  [[ "$CONFIRM" == "y" || "$CONFIRM" == "Y" ]] || { echo "  Aborted."; exit 0; }
  echo ""
fi

# ── 1. Unload and remove LaunchAgents ────────────────────────────────────────
echo -e "${BOLD}── LaunchAgents${NC}"

for label in com.miniclaw.board-web com.miniclaw.am-setup com.miniclaw.vend-web; do
  plist="$HOME/Library/LaunchAgents/$label.plist"
  if [[ -f "$plist" ]]; then
    launchctl unload "$plist" 2>/dev/null || true
    rm -f "$plist" "$plist.bak"
    ok "Unloaded and removed $label"
  else
    skip "$label not found"
  fi
done

# ── 2. Kill processes on miniclaw ports ──────────────────────────────────────
echo -e "${BOLD}── Ports${NC}"

for portnum in 4210 4220; do
  PORT_PID=$(lsof -ti ":$portnum" 2>/dev/null | head -1 || true)
  if [[ -n "$PORT_PID" ]]; then
    kill "$PORT_PID" 2>/dev/null || true
    sleep 0.5
    kill -0 "$PORT_PID" 2>/dev/null && kill -9 "$PORT_PID" 2>/dev/null || true
    ok "Killed process on port $portnum (PID $PORT_PID)"
  else
    skip "Port $portnum not in use"
  fi
done

# ── 3. Remove QMD collection ────────────────────────────────────────────────
echo -e "${BOLD}── QMD${NC}"

if command -v qmd &>/dev/null || [[ -f "$HOME/.bun/bin/qmd" ]]; then
  export PATH="$HOME/.bun/bin:$PATH"
  if qmd collection list 2>/dev/null | grep -q "^mc-memory"; then
    qmd collection remove mc-memory 2>/dev/null && ok "Removed mc-memory collection" \
      || warn "Failed to remove mc-memory collection"
  else
    skip "mc-memory collection not found"
  fi
else
  skip "qmd not installed"
fi

# ── 4. Remove ~/.openclaw ───────────────────────────────────────────────────
echo -e "${BOLD}── State directory${NC}"

if [[ -d "$STATE_DIR" ]]; then
  rm -rf "$STATE_DIR"
  ok "Removed $STATE_DIR"
else
  skip "$STATE_DIR does not exist"
fi

# ── 5. Clean .zshrc ─────────────────────────────────────────────────────────
echo -e "${BOLD}── Shell environment${NC}"

RCFILE="$HOME/.zshrc"
if [[ -f "$RCFILE" ]]; then
  CHANGED=false

  # Remove the comment header, env vars, alias, and PATH entries
  for pattern in \
    '^# OpenClaw / MiniClaw' \
    '^export OPENCLAW_STATE_DIR=' \
    '^export MINICLAW_HOME=' \
    "^alias oc='openclaw'" \
    'miniclaw/SYSTEM/bin' \
    'OPENCLAW_STATE_DIR/USER/bin'; do
    if grep -q "$pattern" "$RCFILE" 2>/dev/null; then
      # Use a temp file to avoid sed -i portability issues
      grep -v "$pattern" "$RCFILE" > "$RCFILE.tmp" && mv "$RCFILE.tmp" "$RCFILE"
      CHANGED=true
    fi
  done

  # Clean up any trailing blank lines left behind
  if [[ "$CHANGED" == true ]]; then
    # Remove trailing blank lines at end of file
    sed -e :a -e '/^\n*$/{$d;N;ba' -e '}' "$RCFILE" > "$RCFILE.tmp" && mv "$RCFILE.tmp" "$RCFILE"
    ok "Cleaned miniclaw entries from $RCFILE"
  else
    skip "No miniclaw entries in $RCFILE"
  fi
else
  skip "$RCFILE not found"
fi

# ── 6. Remove install log ───────────────────────────────────────────────────
echo -e "${BOLD}── Cleanup${NC}"

if [[ -f /tmp/miniclaw-install.log ]]; then
  rm -f /tmp/miniclaw-install.log
  ok "Removed /tmp/miniclaw-install.log"
else
  skip "No install log found"
fi

# Remove any openclaw backup dirs (optional)
BACKUPS=$(ls -d "$HOME"/.openclaw-backup-* 2>/dev/null || true)
if [[ -n "$BACKUPS" ]]; then
  echo ""
  warn "Found backup directories:"
  echo "$BACKUPS" | while read -r d; do echo "    $d"; done
  if [[ "$FORCE" == true ]]; then
    echo "$BACKUPS" | while read -r d; do rm -rf "$d"; done
    ok "Removed all backup directories"
  else
    echo ""
    read -rp "  Remove backup directories too? (y/N): " RM_BACKUPS
    if [[ "$RM_BACKUPS" == "y" || "$RM_BACKUPS" == "Y" ]]; then
      echo "$BACKUPS" | while read -r d; do rm -rf "$d"; done
      ok "Removed all backup directories"
    else
      skip "Kept backup directories"
    fi
  fi
fi

echo ""
echo -e "${GREEN}${BOLD}miniclaw-os uninstalled.${NC}"
echo ""
