# Android build — Counter Watch

How the Android APK is built and installed on a phone (e.g. the S25 Ultra).

**Stack:** vanilla-JS + Vite web app → wrapped by **Capacitor** → built into a
**standalone, offline APK** by **GitHub Actions** in the cloud. Unlike a PWABuilder
TWA, the whole app is bundled into the APK — no hosting, works with no network.

> Not the same as Anime Samurai. That one is Expo + EAS Build. This is
> Capacitor + GitHub Actions. The commands do not transfer between them.

## One-time setup

1. Push this repo to GitHub (done via `gh repo create`).
2. The QR install link only works if the **repo is public** — release assets on a
   private repo require login, which a phone browser can't do. The code has no
   secrets (no backend, no API keys), so public is safe. If you keep it private,
   install via the build **artifact** instead (see below).

## Make a build → install on the phone

1. GitHub → **Actions** tab → **Build Android APK** → **Run workflow**.
   (Or push a tag: `git tag v0.1.0 && git push --tags`.)
2. The cloud build runs (~5–10 min): builds the web bundle, regenerates the
   Android project with Capacitor, and compiles a debug APK.
3. When it finishes:
   - **Public repo:** the run **Summary** shows a **QR code** + download link, and
     a **Release** is created with `counter-watch-debug.apk` attached. Scan the QR
     with the phone, or open the release on the phone and download the APK.
   - **Private repo:** open the finished run → **Artifacts** →
     `counter-watch-debug-apk` → download (requires being logged into GitHub).
4. On the phone, the first install asks to allow **"Install unknown apps"** for
   your browser/files app — approve it, then open the downloaded APK to install.

## How it works (`.github/workflows/android.yml`)

```
npm ci
npm run fetch-portraits        # pull hero art from the CDN URLs (best-effort)
npm run build                  # Vite -> dist/
npx cap add android            # regenerate android/ (it's gitignored, not committed)
npx cap sync android           # copy dist/ into the native project
npx @capacitor/assets generate # launcher icon from resources/icon.png (best-effort)
cd android && ./gradlew assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`, staged as
`counter-watch-debug.apk`.

## Notes / gotchas

- **Debug signing.** It builds a *debug* APK (auto-signed with Android's debug
  key) — fine for personal sideloading, no keystore needed. For a Play Store /
  signed release build, add a keystore to repo **Secrets** and an
  `assembleRelease` step with a signing config.
- **No OTA updates.** Every change needs a new build + reinstall. Reinstalling
  over the top keeps your data (uploaded portraits in IndexedDB persist in the
  WebView storage).
- **Icons.** `npm run make-icons` regenerates `public/assets/icon-{192,512}.png`
  and `resources/icon.png` (the launcher source). Replace `resources/icon.png`
  with real art and re-run to rebrand.
- **`android/` is not committed** — it's regenerated each build from
  `capacitor.config.json`. To build locally instead: `npm run build && npx cap add
  android && npx cap open android` (needs Android Studio + JDK 17).
- **App id / name:** `com.counterwatch.app` / "Counter Watch"
  (`capacitor.config.json`).
