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
```

---

## 🚀 Running Locally

### Prerequisites
* Node.js 20+
* macOS with Xcode 16+ (for native iOS Simulator)
* CocoaPods installed (`brew install cocoapods`)

### Development Commands
```bash
# Install dependencies
npm install

# Start Metro Bundler
NODE_OPTIONS='--require ./node-compat.js' npx expo start

# Open in Native iOS Simulator / Xcode
open ios/golftournamentapp.xcworkspace

# Open Web Preview
NODE_OPTIONS='--require ./node-compat.js' npx expo start --web
```
