# Uncle Joe's 26th Annual Double Bogey Golf Tournament App

A high-contrast, touch-optimized iOS and Android scoring application designed specifically for **Uncle Joe's Annual Double Bogey Golf Tournament**. Built with React Native, Expo SDK 58, and TypeScript.

---

## ⛳ Tournament Scoring System

### 1. Modified Stableford Points
| Result | Relative to Par | Points Awarded |
| :--- | :--- | :--- |
| **Albatross or better** | -3 or lower | **16 pts** |
| **Eagle** | -2 | **8 pts** |
| **Birdie** | -1 | **4 pts** |
| **Par** | 0 | **2 pts** |
| **Bogey** | +1 | **1 pt** |
| **Double Bogey or worse** | +2 or higher | **0 pts** |

### 2. Daily Target Quotas & Net Score
* **Target Quota (TGT)**: Each player has a target quota per round (initialized from their handicap/starting target).
* **Actual Points (ACT)**: Sum of modified Stableford points earned on all completed holes.
* **In-Round Net Score (INS)**: $\text{INS} = \text{ACT} - \text{TGT}$.
* **Overall Net Score (ONS)**: Cumulative net quota points across all rounds of the tournament.

### 3. Day-to-Day Target Adjustment (60% Rule)
Between rounds, a player's new quota automatically updates based on their actual performance:
$$\text{New Target} = \text{round}\Big(\min(\text{Old Target}, \text{Actual}) + 60\% \times |\text{Actual} - \text{Old Target}|\Big)$$
*(Adjustment percentage is configurable in the Admin Portal).*

### 4. Tie-Breaker Logic
Ties in flight standings are broken hole-by-hole according to course **Hole Difficulty Ranks** (#1 hardest through #18 easiest).

---

## 📱 Key Features & UI Design

* **Zero-Friction Scoring ("Only Touch When Points Are Scored")**:
  * Every hole presets players to **Double Bogey / 0 Points** (`Par + 2` strokes).
  * If a player double-bogeys or picks up, no buttons need to be pressed.
  * If points are made, one tap on `Bogey (+1p)`, `Par (+2p)`, `Birdie (+4p)`, or `Eagle (+8p)` logs the points.
* **Commit / Lock-In Safeguard**:
  * Individual `🔒 Lock In` buttons confirm each player's score.
  * Cart scorers can tap `🔒 Commit Hole & Go to Next Hole ›` to save all 4 cart players and advance in one click.
* **Dual-Flight Leaderboard**:
  * High-contrast, large-text standings split into **A-Flight** and **B-Flight** matching paper tally sheets.
  * Displays **TGT**, **ACT**, and **NET** with color-coded badges for under/over quota.
* **Admin Portal (Uncle Joe's Master Sheet)**:
  * Full 5-round multi-course tournament ledger (Colonial Heritage, G.H. Green, G.H. Gold, Kiskiack, Royal New Kent).
  * Protected with PIN (`9999`).
  * One-click 60% quota calculation and player division assignments.

---

## 🛠️ Project Structure

```
├── App.tsx                     # Main navigation shell (Scoring & Standings tabs)
├── node-compat.js              # Polyfills for Node 20.8+ (URL.parse, util.styleText)
├── src/
│   ├── types/tournament.ts     # Core models (Player, HoleConfig, Course, Round, Group)
│   ├── utils/scoring.ts        # Stableford math, tie-breaker & 60% adjustment logic
│   ├── data/seedData.ts        # Tournament roster & official course layouts
│   ├── context/
│   │   └── TournamentContext.tsx # Centralized tournament state & persistence
│   └── screens/
│       ├── EnterScoresScreen.tsx # Cart picker, hole stepper & lock-in scorer
│       ├── StandingsScreen.tsx   # A & B flight leaderboards
│       └── MasterSheetScreen.tsx # Multi-round admin ledger
└── ios/                        # Native iOS Xcode workspace & CocoaPods (iOS 17.0+)
└── android/                    # Native Android Studio project & Gradle scripts
```

---

## 🚀 Running Locally

### Prerequisites
* **Node.js**: v20.13+ or v22+ LTS recommended ([nodejs.org](https://nodejs.org))
* **Git**: Installed and configured

---

### 🍏 On macOS (iOS Simulator & Xcode)
```bash
# 1. Install dependencies
npm install

# 2. Start Metro bundler
npm start

# 3. Open in iOS Simulator
# Press 'i' in the terminal, or open the native workspace:
open ios/golftournamentapp.xcworkspace
```

---

### 🤖 Running on Android (macOS, Windows, or Linux)

#### Option A: On an Android Physical Device (Fastest)
1. Install **Expo Go** from the [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent).
2. Start the dev server:
   ```bash
   npm start
   ```
3. Open the **Expo Go** app on your Android phone, tap **Scan QR Code**, and scan the QR code in your terminal. The app will build and open directly on your phone!

#### Option B: On an Android Studio Emulator
1. Install [Android Studio](https://developer.android.com/studio) and create an Android Virtual Device (AVD).
2. Start the emulator.
3. In your terminal, run:
   ```bash
   npm run android
   ```
   *(Or press `a` in an active `npm start` terminal).*

#### Option C: Native Android Studio Build / Standalone APK
Open the `android/` directory directly in Android Studio, or build a debug APK via terminal:
```bash
# macOS/Linux:
cd android && ./gradlew assembleDebug

# Windows (Command Prompt / PowerShell):
cd android && gradlew.bat assembleDebug
```
The output APK is generated at `android/app/build/outputs/apk/debug/app-debug.apk`.

---

### 🪟 Running on Windows

A Windows user can develop and test this app using any of the following methods:

#### 1. In a Web Browser (Zero Setup)
```powershell
npm install
npm run web
```
Press `w` in the terminal or open `http://localhost:8081` in Chrome, Edge, or Brave.

#### 2. On a Physical Android or iPhone (via Expo Go)
* Even on Windows, you can test on an **iPhone** or **Android** phone!
* Download **Expo Go** from the Apple App Store or Google Play Store.
* Run `npm start` on Windows.
* Connect your phone to the same Wi-Fi network and scan the QR code with the Camera app (iOS) or Expo Go app (Android).

#### 3. On Android Emulator (Windows)
1. Install Android Studio on Windows with the Android SDK & Virtual Device.
2. In PowerShell / Command Prompt:
   ```powershell
   npm install
   npm run android
   ```

