#!/usr/bin/env bash
# Expose the local BFF (WSL2 :8070) to devices through the Expo ngrok account.
#
# Why this exists: the iPhone running Expo Go cannot reach the Windows LAN IP
# (192.168.0.15:8070), so the app must talk to a URL that is reachable from the
# phone. EXPO_PUBLIC_API_BASE_URL in .env points at this tunnel's hostname;
# keep the tunnel running while testing on a device.
#
# Usage: scripts/api-tunnel.sh [hostname]      (Ctrl+C to stop)
set -euo pipefail

HOSTNAME_FQDN="${1:-hyperter96-nodelearn-api.exp.direct}"
PORT="${API_PORT:-8070}"

# ngrok ships inside the Expo CLI rather than as a standalone install.
NGROK="${NGROK_BIN:-$(npm root -g 2>/dev/null)/@expo/ngrok/node_modules/@expo/ngrok-bin-linux-x64/ngrok}"
if [ ! -x "$NGROK" ]; then
  echo "ngrok binary not found at $NGROK — set NGROK_BIN to a ngrok v2 binary" >&2
  exit 1
fi

# Reuse the credentials the Expo CLI already fetched; never commit the token.
TOKEN="${NGROK_AUTHTOKEN:-$(sed -n 's/^authtoken:[[:space:]]*//p' "$HOME/.expo/ngrok.yml")}"
if [ -z "$TOKEN" ]; then
  echo "no ngrok authtoken in ~/.expo/ngrok.yml — set NGROK_AUTHTOKEN" >&2
  exit 1
fi

# ngrok 4040/4041 are taken by the running Expo dev servers.
CONFIG="$(mktemp)"
trap 'rm -f "$CONFIG"' EXIT
printf 'authtoken: %s\nweb_addr: localhost:4042\n' "$TOKEN" > "$CONFIG"

echo "tunneling https://$HOSTNAME_FQDN -> localhost:$PORT"
"$NGROK" http --config="$CONFIG" --hostname="$HOSTNAME_FQDN" --log=stdout "$PORT"
