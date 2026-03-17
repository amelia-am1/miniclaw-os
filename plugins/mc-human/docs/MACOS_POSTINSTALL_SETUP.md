# macOS Post-Install Setup Guide

After installing MiniClaw/OpenClaw on a macOS machine (especially Mac mini headless servers), several system settings must be configured to ensure the agent can interact with the system via VNC and doesn't unexpectedly sleep.

## Quick Start

Run the automated setup:

```bash
openclaw mc-human setup
```

This will configure:
- **Screen Sharing (VNC)** — enables remote desktop access via port 5900
- **System sleep disabled** — prevents the Mac from sleeping and disconnecting
- **Display sleep** — screen can sleep after 30 minutes (optional, separate from system sleep)
- **Screensaver** — disabled on login window
- **Auto-updates** — configured to not auto-restart

## What Each Setting Does

### Screen Sharing (VNC)

MiniClaw uses noVNC to provide interactive remote desktop access. This requires:

1. **Enable via launchctl** — loads the system daemon
   ```bash
   sudo launchctl load -w /System/Library/LaunchDaemons/com.apple.screensharing.plist
   ```

2. **Activate via kickstart** — configures ARD agent with full permissions
   ```bash
   sudo /System/Library/CoreServices/RemoteManagement/ARDAgent.app/Contents/Resources/kickstart \
     -activate \
     -configure -access -on \
     -configure -allowAccessFor -allUsers \
     -configure -restart -agent \
     -privs -all
   ```

**Manual alternative:** System Settings → General → Sharing → Screen Sharing (enable)

### System Sleep Disabled

Mac minis sleep by default. When sleeping, the agent cannot operate. Disable with:

```bash
sudo pmset -a sleep 0 disksleep 0 hibernatemode 0
```

**Verify:**
```bash
pmset -g | grep sleep
# Should show: sleep         0
```

### Display Sleep

Separate from system sleep. Recommended to keep at 30 minutes to save power, but allow system to remain awake:

```bash
sudo pmset -a displaysleep 30
```

### Screensaver (Login Window)

Headless machines shouldn't lock on the login window:

```bash
sudo defaults write com.apple.screensaver loginWindowIdleTime 0
```

### Auto-Updates

Configure to check daily but not auto-restart (you control when the machine restarts):

```bash
sudo defaults write /Library/Preferences/com.apple.commerce \
  AutoUpdate -bool false
sudo defaults write /Library/Preferences/com.apple.commerce \
  AutoUpdateRestartRequired -bool false
```

## Interactive Setup (With sudo Prompts)

If running in an agent context where you need interactive sudo access:

```bash
openclaw ask_human "Setup macOS system settings" --reason "Need sudo access for VNC, power, and screensaver config"
```

Then run:
```bash
openclaw mc-human setup
```

Inside the noVNC session where sudo can prompt for a password.

## Verification

Check that settings are correctly applied:

```bash
openclaw mc-human verify
```

Expected output:
```
✓ VNC reachable at 127.0.0.1:5900
✓ System sleep disabled (pmset sleep=0)
✓ Display sleep configured
✓ Login window screensaver disabled
```

Or manually verify each:

```bash
# VNC reachable?
nc -zv 127.0.0.1 5900

# System sleep disabled?
pmset -g | grep "^sleep"        # Should show: sleep         0

# Display sleep configured?
pmset -g | grep "displaysleep"  # Should show: displaysleep  30

# Screensaver disabled?
defaults read com.apple.screensaver loginWindowIdleTime  # Should show: 0
```

## Troubleshooting

### "VNC not reachable" after setup

Screen Sharing might require a System Settings confirmation. Check:

1. System Settings → General → Sharing → Screen Sharing — should be enabled
2. Restart the ARD agent:
   ```bash
   sudo /System/Library/CoreServices/RemoteManagement/ARDAgent.app/Contents/Resources/kickstart -restart -agent
   ```

### sudo permission denied

If you're not in the sudoers group or sudoers is not configured for passwordless access:

1. Add yourself to sudoers (one-time setup):
   ```bash
   sudo visudo
   # Add this line:
   # %admin ALL=(ALL) NOPASSWD: /usr/bin/pmset, /bin/launchctl, /usr/bin/defaults, /System/Library/CoreServices/RemoteManagement/ARDAgent.app/Contents/Resources/kickstart
   ```

2. Or use interactive mode via ask_human (described above)

### Display stays on but agent can't control it

If the Mac has a physical display, you might see these in System Preferences:

- **Desktop & Dock** → **Lock Screen** → set to "Never"
- **System Settings** → **General** → **Login Items** → remove any unused login items

### System still sleeps despite settings

1. Check if there are any USB/power settings overriding pmset:
   ```bash
   pmset -g | head -20
   ```

2. Ensure no other power-management software (like Amphetamine or Caffeine) is interfering

3. Try a system restart after applying settings

## Integrating Into Post-Install Wizard

To make this part of the MiniClaw install flow:

1. Add a post-install step that runs `openclaw mc-human setup` with user consent
2. Add `openclaw mc-human verify` as a smoke test check
3. If verification fails, create a card in the user's board asking them to run setup manually or use interactive mode

## References

- [Apple Remote Desktop / Screen Sharing](https://support.apple.com/guide/remote-desktop/welcome/mac)
- [pmset man page](https://ss64.com/mac/pmset.html)
- [defaults write command reference](https://ss64.com/mac/defaults.html)
