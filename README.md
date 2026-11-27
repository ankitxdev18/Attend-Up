# AttendUp

<p align="center">
  <strong>Mobile-first student attendance tracker with an Emerald Liquid Glass UI, offline SQLite persistence, What-If Bunk Simulator, and native Android Home Screen Widgets.</strong>
</p>

<p align="center">
  <a href="https://github.com/ankitxdev18/Attend-Up/releases/latest">
    <img src="https://img.shields.io/badge/Download-Latest%20APK-10B981?style=for-the-badge&logo=android&logoColor=white" alt="Download Latest APK" />
  </a>
  <img src="https://img.shields.io/badge/Expo-SDK%2058-050608?style=for-the-badge&logo=expo&logoColor=34D399" alt="Expo SDK 58" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-050608?style=for-the-badge&logo=typescript&logoColor=34D399" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Offline--First-SQLite-050608?style=for-the-badge&logo=sqlite&logoColor=34D399" alt="SQLite" />
</p>

---

## Core Capabilities

- **Unified Emerald Liquid Glass UI** — Obsidian dark theme (`#050608`) with an animated 4-edge Emerald aurora, translucent glass cards, and crisp tabular-numeric typography (`Plus Jakarta Sans` & `JetBrains Mono`).
- **1-Tap Attendance & Multi-Lecture Logging** — Mark `Present`, `Absent`, `Half Day`, `Holiday`, `Weekly Off`, or `Leave` with `1x–4x` lectures per day, shift tags, overtime hours, and per-date notes.
- **What-If Bunk Simulator** — Preview the exact impact of attending or missing upcoming classes before committing, alongside safe-bunk margin and recovery-classes-needed calculations.
- **12-Week Heatmap & Monthly Calendar** — Switch seamlessly between a GitHub-style 12-week contribution heatmap and an interactive monthly calendar with Liquid Glass selection containers and note indicators.
- **Native Android Home Screen Widgets** — Pin live **Heatmap** or **Monthly Calendar** widgets directly to your Android home screen (`react-native-android-widget`) that stay synced with your SQLite database.
- **Offline SQLite Persistence** — 100% local-first storage via `expo-sqlite` with optional PIN lock, Attendance Lock (prevents accidental past edits), and daily interactive check-in notifications.
- **PDF & CSV Reports** — Export clean attendance summaries and subject-wise breakdowns for any date range.
- **JSON Backup & Safety Snapshots** — Full JSON export/import plus automatic pre-bulk-edit safety snapshots for instant rollback.
- **In-App GitHub Releases Auto-Updater** — Automatically checks for new APK releases on launch and foreground resume, notifies once per release, and launches the Android package installer directly.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | React Native · Expo SDK 58 |
| Language | TypeScript (strict mode) |
| Navigation | React Navigation (Drawer + Native Stack) |
| Animations | `react-native-reanimated` · `react-native-gesture-handler` |
| Local Database | `expo-sqlite` |
| Android Widgets | `react-native-android-widget` |
| Notifications | `expo-notifications` |
| Exports & Sharing | `expo-print` · `expo-file-system` · `expo-sharing` |
| CI/CD | GitHub Actions (`release-apk.yml`) |

---

## Download & Install (Android)

1. Download the latest signed APK from [**GitHub Releases**](https://github.com/ankitxdev18/Attend-Up/releases/latest).
2. Open the downloaded `.apk` on your Android device (allow *Install unknown apps* if prompted).
3. Future updates can be installed directly inside AttendUp via the in-app **Update Available** prompt.

### Android Home Screen Widget Setup

1. Long-press an empty space on your Android home screen and tap **Widgets**.
2. Find **AttendUp** and drag either the **Heatmap** or **Calendar** widget onto your home screen.
3. Open **AttendUp → Settings → Widget Configuration** to choose the target subject, widget style, and month.

---

## Local Development & Build

### Prerequisites

- Node.js 20+
- Android SDK / JDK 17 (for local native builds)

### Commands

```bash
# Install dependencies
npm install

# Start Metro dev server
npx expo start

# Typecheck & Lint
npx tsc --noEmit
npx eslint . --max-warnings=0

# Diagnose Expo SDK & config compatibility
npx expo-doctor

# Generate native Android project & build Release APK locally
npx expo prebuild --platform android --clean
node scripts/fix-android-release.mjs
cd android && ./gradlew assembleRelease
```

---

## License

See [LICENSE](LICENSE) for details.
