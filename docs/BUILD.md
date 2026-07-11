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

Voice input (`expo-speech-recognition`) is a custom native module, so the dev loop runs through a **dev client** — a one-time debug build that then behaves exactly like Expo Go:

```sh
bun install
bunx expo prebuild --platform android   # regenerate android/ after native/plugin changes
echo "sdk.dir=$HOME/Android/Sdk" > android/local.properties   # prebuild wipes it
cd android && ./gradlew assembleDebug && cd ..
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

bunx expo start --dev-client --tunnel   # open the project from the dev client's launcher
```

Rebuild the APK **only when native deps or app.json plugins change** — a JS import of a native module that isn't in the installed build fails at runtime with "Cannot find native module …", and a Metro 500 (e.g. missing `bun install` after a dependency change) can crash-loop the dev client. Recovery: fix the server, confirm `curl -s "localhost:8085/index.bundle?platform=android&dev=true" -o /dev/null -w '%{http_code}'` returns 200, then `adb shell am force-stop com.doop.pugiron` and relaunch. Day-to-day JS work is Fast Refresh (~1 s), same as Expo Go.

`--tunnel` sidesteps WSL2's NAT (phone can't reach the WSL IP directly; tunnel routes via ngrok). Deep-link the dev client straight to the server (the launcher's URL field also works): `adb shell am start -a android.intent.action.VIEW -d "exp+pug-iron://expo-development-client/?url=http%3A%2F%2F<hostUri>"` — the hostUri comes from `curl -s localhost:8085 -H "expo-platform: android"` (`extra.expoClient.hostUri`); note the scheme is `exp+pug-iron://`, plain `pugiron://` doesn't resolve. If tunnel is slow: `adb reverse tcp:8085 tcp:8085` over USB with `http://127.0.0.1:8085` as the URL — but replugging the cable silently drops all reverses (symptom: endless spinner / "Failed to download remote update"); re-run the reverse after every replug.

Unit tests (`src/logic/`) run with jest-expo on the desktop, no device needed.

**On-device speech model:** voice input requires Android 13+ on-device recognition (`com.google.android.as`). If the offline English model isn't installed, the mic control in the logger shows disabled with a note; recognition never falls back to the network. Verify the manifest stays lean after native changes: `aapt dump permissions android/app/build/outputs/apk/debug/app-debug.apk` — voice adds `RECORD_AUDIO`, reminders add `POST_NOTIFICATIONS` + `RECEIVE_BOOT_COMPLETED`; anything else new is suspect. (`expo-notifications` also drags in vendor badge/launcher permissions and `c2dm.RECEIVE` from its unused push machinery — candidates for `android.blockedPermissions`, like the already-blocked `CHANGE_WIFI_MULTICAST_STATE`.)

**Pixel 9 recognizer quirk (do not "fix" the beep):** SODA on-device recognition returns empty transcripts whenever the recognizer runs off a custom audio source — which is what both documented beep workarounds (`continuous: true`, `recordingOptions.persist`) switch to under the hood. `src/lib/voiceControl.ts` deliberately runs one system-source session per utterance; the per-session beep is the price of working transcripts. Diagnose recognizer issues with `adb logcat | grep -iE "ExpoSpeech|SodaSpeech|RecognitionClient"` — it distinguishes "not hearing" from "hearing but returning empty".

**Adding/aligning dependencies:** always `bunx expo install <pkg>` (never plain `bun add` for Expo/RN packages) — it resolves the SDK-matched version. Since SDK 55, all `expo-*` packages version as `~<sdk>.0.0` (e.g. `expo-sqlite@~57.0.0`); older `~15.x`-style pins are pre-SDK-55 and won't resolve. `bunx expo install --check` validates the whole set.

## Build the APK

```sh
bunx expo prebuild --platform android  # generates android/ (gitignored, regenerable)
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

First Gradle run downloads Gradle + dependencies (~10 min); later builds are ~1 min.

For daily use, build a **release APK**: `./gradlew assembleRelease` → `android/app/build/outputs/apk/release/app-release.apk`. It's standalone (bundled JS, Hermes, minified, ~39 MB vs ~89 MB debug) and needs no Metro. The Expo template signs release with the debug keystore — fine for personal sideloading, no Play Store keystore ceremony. Debug and release share the package name, so installing one replaces the other; SQLite data survives every `install -r` swap. Never add EAS Update/expo-updates — the app is fully offline by design.

## Install on the phone

Cable + adb (enable USB debugging in Developer Options):

```sh
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Or cable-free: copy the APK anywhere the phone can reach it (Nextcloud/Drive/`python -m http.server`), open it on the phone, allow "install unknown apps" for that source once.

**Updating** keeps all data: the SQLite database lives in the app's document directory and survives `adb install -r`. Data is only lost on uninstall — hence the export button. Export before uninstalling, always.
