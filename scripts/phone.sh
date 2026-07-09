#!/usr/bin/env bash
# Launch the running Metro bundle in Expo Go on the USB-connected Pixel from WSL2.
# Assumes `npm start` (Metro) is already running. See memory: expo-go-wsl2-dev-loop.
set -euo pipefail

PORT="${EXPO_PORT:-8085}"

# Windows adb.exe sees the USB phone natively (no usbipd); fall back to a Linux adb on PATH.
ADB="/mnt/c/Users/dominik.opwis/AppData/Local/Android/Sdk/platform-tools/adb.exe"
[ -x "$ADB" ] || ADB="$(command -v adb || true)"
[ -n "$ADB" ] || { echo "adb not found (Windows SDK path or PATH)"; exit 1; }

DEVICE="$("$ADB" get-serialno 2>/dev/null || true)"
[ -n "$DEVICE" ] && [ "$DEVICE" != "unknown" ] || { echo "no device — unlock the phone, enable USB debugging, replug"; exit 1; }

# Tunnel Metro over the USB cable: phone's localhost:PORT -> host loopback -> WSL Metro
# (WSL localhostForwarding bridges the Windows loopback to the WSL listener). No LAN, no
# mirrored networking, so this is VPN-safe.
"$ADB" reverse tcp:"$PORT" tcp:"$PORT" >/dev/null

echo "launching exp://127.0.0.1:$PORT on $DEVICE"
"$ADB" shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:$PORT" host.exp.exponent
