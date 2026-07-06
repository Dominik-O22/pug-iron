# Build Guide

From `npm install` to an APK on the phone, without Android Studio.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node | ≥ 20.19 (22.x recommended) | Vite 6 requirement |
| JDK | **17** | Capacitor 6 / AGP 8.2 target. *Capacitor 7 would require JDK 21 — that's why this project pins Capacitor 6.* |
| Android SDK | platform 34, build-tools 34.0.0, platform-tools | headless install below; no Android Studio needed |

## Android SDK headless install

Tested on Windows (adapt paths for Linux — `commandlinetools-linux-*.zip`, `~/Android/Sdk`):

```powershell
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
New-Item -ItemType Directory -Force "$sdk\cmdline-tools" | Out-Null
curl.exe -sL -o cmdtools.zip https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip
Expand-Archive cmdtools.zip "$sdk\cmdline-tools" -Force
Rename-Item "$sdk\cmdline-tools\cmdline-tools" "latest"
```

**Gotcha:** `sdkmanager --licenses` reads answers from stdin in a way that PowerShell's pipe doesn't always satisfy. Redirect from a file of `y` lines via `cmd`:

```powershell
Set-Content y.txt ("y`r`n" * 30) -Encoding ascii -NoNewline
cmd /c "`"$sdk\cmdline-tools\latest\bin\sdkmanager.bat`" --sdk_root=$sdk --licenses < y.txt"
cmd /c "`"$sdk\cmdline-tools\latest\bin\sdkmanager.bat`" --sdk_root=$sdk platform-tools `"platforms;android-34`" `"build-tools;34.0.0`" < y.txt"
```

Then make the SDK discoverable — either set `ANDROID_HOME=$sdk` in the environment, or write `android/local.properties` (gitignored) after the Capacitor android platform exists:

```
sdk.dir=C:\\Users\\<you>\\AppData\\Local\\Android\\Sdk
```

## Web development loop

```sh
npm install
npm run dev          # localhost:5173 — full app works in a desktop browser
```

Dexie, charts, autopilot logic — everything is testable in the browser. Only Share/Filesystem export takes the web fallback path (`<a download>`).

## Capacitor wrap (one-time)

```sh
npx cap init "Pug Iron" dev.opwis.pugiron --web-dir dist
npm run build
npx cap add android
```

Then in `capacitor.config.ts` keep defaults; no server config (fully bundled, offline).

## Build the APK

```sh
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

First Gradle run downloads Gradle + dependencies (~10 min); later builds are ~1 min.

The **debug APK is fine for personal use** — it's signed with a debug key and installs anywhere. A release build (`assembleRelease`) needs a keystore; not worth it unless Play Store distribution ever happens.

## Install on the phone

Cable + adb (enable USB debugging in Developer Options):

```sh
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Or cable-free: copy the APK anywhere the phone can reach it (Nextcloud/Drive/`python -m http.server`), open it on the phone, allow "install unknown apps" for that source once.

**Updating** keeps all data: IndexedDB lives in app storage and survives `adb install -r`. Data is only lost on uninstall — hence the export button. Export before uninstalling, always.
