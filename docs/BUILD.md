# Build Guide

From `npm install` to an APK on the phone, without Android Studio.

Stack: **Expo SDK 57** (React Native 0.86, React 19.2, New Architecture, Hermes). Pinned versions checked 2026-07 — re-verify against the [Expo changelog](https://expo.dev/changelog) and [RN environment docs](https://reactnative.dev/docs/set-up-your-environment) before bumping.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node | ≥ 22.11 | RN 0.86 minimum |
| Bun | ≥ 1.3 | package manager (`bun install`, `bunx expo …`); Node still runs Metro/scripts |
| JDK | **17** | RN's documented requirement; higher JDKs can break the Gradle build |
| Android SDK | platform **35**, build-tools **36.0.0**, platform-tools, cmdline-tools | headless install below; no Android Studio needed |

Target device: Pixel 9, Android 16 — anything Expo ships runs there.

## Android SDK headless install

Linux/WSL2 (`~/Android/Sdk`):

```sh
sdk=~/Android/Sdk
mkdir -p "$sdk/cmdline-tools"
curl -sL -o /tmp/cmdtools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip -q /tmp/cmdtools.zip -d "$sdk/cmdline-tools"
mv "$sdk/cmdline-tools/cmdline-tools" "$sdk/cmdline-tools/latest"

yes | "$sdk/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$sdk" --licenses
"$sdk/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$sdk" \
  platform-tools "platforms;android-35" "build-tools;36.0.0"
```

Make it discoverable: `export ANDROID_HOME=~/Android/Sdk` (plus `$ANDROID_HOME/platform-tools` on PATH) in the shell profile, or write `android/local.properties` (gitignored) after prebuild:

```
sdk.dir=/home/<you>/Android/Sdk
```

## Dev loop

v1 uses **no custom native modules** — expo-sqlite, expo-haptics, expo-file-system, expo-sharing, react-native-svg are all in Expo Go. So until the PM5 BLE stretch goal lands, the loop is just:

```sh
bun install
bunx expo start --tunnel    # scan QR with Expo Go on the phone
```

`--tunnel` sidesteps WSL2's NAT (phone can't reach the WSL IP directly; tunnel routes via ngrok). If tunnel is slow, alternatives: `adb reverse tcp:8081 tcp:8081` over USB, or Windows port-forwarding to the WSL IP.

Fast Refresh applies JS edits in ~1 s. Unit tests (`src/logic/`) run with jest-expo on the desktop, no device needed.

**When BLE arrives** (react-native-ble-plx = custom native module): switch to a dev client — `bunx expo run:android` once builds and installs a debug app that behaves exactly like Expo Go (`bunx expo start --dev-client`). Rebuild only when native deps change.

**Adding/aligning dependencies:** always `bunx expo install <pkg>` (never plain `bun add` for Expo/RN packages) — it resolves the SDK-matched version. Since SDK 55, all `expo-*` packages version as `~<sdk>.0.0` (e.g. `expo-sqlite@~57.0.0`); older `~15.x`-style pins are pre-SDK-55 and won't resolve. `bunx expo install --check` validates the whole set.

## Build the APK

```sh
bunx expo prebuild --platform android  # generates android/ (gitignored, regenerable)
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

First Gradle run downloads Gradle + dependencies (~10 min); later builds are ~1 min.

The **debug APK is fine for personal use** — signed with a debug key, installs anywhere. `assembleRelease` needs a keystore; not worth it unless Play Store distribution ever happens. Never add EAS Update/expo-updates — the app is fully offline by design.

## Install on the phone

Cable + adb (enable USB debugging in Developer Options):

```sh
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Or cable-free: copy the APK anywhere the phone can reach it (Nextcloud/Drive/`python -m http.server`), open it on the phone, allow "install unknown apps" for that source once.

**Updating** keeps all data: the SQLite database lives in the app's document directory and survives `adb install -r`. Data is only lost on uninstall — hence the export button. Export before uninstalling, always.
