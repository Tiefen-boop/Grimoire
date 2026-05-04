#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="grimoire"
SERVICE_FILE="$HOME/.config/systemd/user/${SERVICE_NAME}.service"

echo "=== Grimoire Service Setup ==="

# Resolve node binary via nvm
export NVM_DIR="$HOME/.nvm"
if [ ! -f "$NVM_DIR/nvm.sh" ]; then
  echo "ERROR: nvm not found at $NVM_DIR. Please install nvm first."
  exit 1
fi
source "$NVM_DIR/nvm.sh" --no-use
cd "$SCRIPT_DIR"
nvm use --silent
NODE_BIN="$(which node)"
echo "Using Node: $NODE_BIN ($(node --version))"

# Check .env exists
if [ ! -f "$SCRIPT_DIR/.env" ]; then
  echo "ERROR: .env file not found at $SCRIPT_DIR/.env"
  echo "Create it with PORT, JWT_SECRET, and DB_PATH before running this script."
  exit 1
fi

# Create systemd user directory
mkdir -p "$HOME/.config/systemd/user"

# Write service file
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Grimoire D&D Character Server
After=network.target

[Service]
Type=simple
WorkingDirectory=$SCRIPT_DIR
ExecStart=$NODE_BIN server/index.js
EnvironmentFile=$SCRIPT_DIR/.env
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF

echo "Service file written to $SERVICE_FILE"

# Reload daemon, enable and start
systemctl --user daemon-reload
systemctl --user enable "$SERVICE_NAME"
systemctl --user restart "$SERVICE_NAME"

echo ""
echo "=== Done! Grimoire is running and will start automatically on login ==="
echo ""
echo "Useful commands:"
echo "  systemctl --user status grimoire     # check status"
echo "  systemctl --user restart grimoire    # restart after server changes"
echo "  journalctl --user -u grimoire -f     # follow logs"
echo "  npm run build --prefix client        # rebuild after client changes"
