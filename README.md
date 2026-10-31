# MOTION DRIVE 3D

**Your hands. Your steering wheel. Your race.**

Motion Drive 3D is a playable, browser-native **3D highway car racing game controlled by real-time webcam hand gestures**, built with **Three.js**, **MediaPipe Hand Landmarker**, **GSAP**, and plain **JavaScript (ES Modules)**.

Sit in front of your webcam, hold both hands up as if gripping an imaginary steering wheel at 9 and 3 o'clock, and rotate your hands left or right to steer a sculpted 3D GT supercar through endless nocturnal highway traffic. All webcam frames are processed **100% locally in your browser** — no camera images or video streams are ever uploaded to a server.

---

## Features

- **Two-Page Website Architecture (`#garage` & `#race`):**
  - **Page 01 — Garage & Speed Lab (`#garage`):** Dedicated 3D showroom and vehicle tuning studio featuring 4 sculpted 3D car models, 8 instant paint swatches, live 3D floating driver nameplate editor, 5 world arenas, interactive showroom camera angles (`Auto Orbit`, `Front 3/4`, `Side Profile`, `Rear Aero`), and a full **Speed & Acceleration Lab**.
  - **Page 02 — Live Race Track (`#race`):** Dedicated full-viewport 3D highway cockpit with a Starting Grid Ready Deck before green flag and an uncluttered live Race HUD with instant Gearbox & Speed Slider controls.
- **Real-Time Two-Hand & One-Hand Webcam Steering:**
  - Uses MediaPipe `HandLandmarker` locally in the browser to track 21 landmarks per hand.
  - Calculates steering from the relative axle angle between your left and right palm hubs in mirrored screen space, with seamless 1-hand steering support.
  - Interactive **Steering Calibration Studio** with automatic neutral-grip hold detection, manual one-click neutral capture, adjustable sensitivity, center dead zone, jitter smoothing, and maximum wheel-lock angle.
  - **Safe Tracking-Loss Recovery:** If hands leave the camera frame, throttle disengages safely and steering returns smoothly toward center neutral (`0°`).
- **Full Speed & Acceleration Control (`0–180 km/h` + 6-Position Gearbox):**
  - `0` — **STOP Gear (`0 km/h`)** (smooth coast to a complete stop)
  - `1`–`5` — **Instant Gearbox Presets** (`G1 = 45`, `G2 = 75`, `G3 = 105`, `G4 = 140`, `G5 = 180 km/h`)
  - **Live `0–180 km/h` Speed Slider** + **`−10` / `+10 km/h` Buttons** + **Mouse Scroll Wheel (`±5 km/h`)** — Dial your exact driving speed or speed limit before or during any race
  - `Q` / `E` or `-` / `+` — Step Target Speed down / up by `10 km/h` (`X` shifts to `0 km/h` STOP)
  - `M` or On-HUD Mode Button — Cycle Throttle Style (`Speed Dial + Pedals`, `Manual Gas Pedal`, `Locked Cruise`)
  - `A` / `D` or `Left` / `Right` — Steer Left / Right
  - `W` / `Up Arrow` / `GAS` Pedal — Accelerate (passes faster in `Speed Dial`, or drives up to your KM/H cap in `Manual Gas`)
  - `S` / `Down Arrow` / `BRAKE` Pedal / Open Palm — Brake crisply down to `0 km/h` full stop
  - `Space` / `Shift` / `NITRO` Pedal — Hyper Nitro Boost
  - `C` — Cycle Camera Perspective (`Chase`, `Action`, `Hood`)
  - `Escape` — Pause / Resume & Speed Settings · `R` — Instant Restart · `H` — Hide / Show Bottom Steering Gauge
- **3D Highway World & Procedural Audio:**
  - Multi-part sculpted GT player cars (`Apex GT-R`, `Vortex F1-X`, `Titan V8`, `Nomad Cyber-X`) with 8 paint finishes, editable 3D driver nameplate, rotating wheels, articulated front steering knuckles, dynamic brake lights, projected road headlights, and collision sparks.
  - Endless 4-lane highway across 5 colorful world arenas with object-pooled multi-part traffic vehicles that scale proportionally with your chosen speed setting and always leave at least one unobstructed lane.
  - 3-point hull integrity shield system, near-miss overtake bonuses (`+50`), procedural Web Audio GT engine synthesizer (with mute toggle), and `localStorage` personal-best persistence.
- **Credits:** T56

---

## Project Structure

```text
index.html
src/
  main.js
  styles.css
  controls/
    CameraController.js      # Explicit consent webcam stream lifecycle & track cleanup
    HandTracker.js           # MediaPipe HandLandmarker (local WASM + CDN fallback) & skeleton overlay
    SteeringCalibration.js   # Two-hand wheel angle math, mirror compensation, smoothing & dead zone
    KeyboardController.js    # Smooth WASD / Arrow fallback & keyboard shortcuts
  game/
    Game.js                  # Three.js renderer, PBR lighting, game loop & state machine
    Car.js                   # 11-part procedural GT supercar, kinematics & spark bursts
    Road.js                  # Endless 4-lane highway, instanced streetlights, trees & skyline
    TrafficManager.js        # Pooled traffic vehicles & fair open-lane wave spawner
    CollisionSystem.js       # AABB collision & near-miss overtake evaluator
    AudioSystem.js           # Procedural Web Audio engine & sound-effect synthesizer
  ui/
    HUD.js                   # Speedometer, rotating virtual wheel, gesture banner & webcam PiP
    Menu.js                  # Title screen, camera consent modal, calibration studio & pause menu
    GameOver.js              # Race summary, personal best comparison & replay controls
public/
  wasm/                      # Local MediaPipe Vision WASM runtime assets
tests/
  motion-drive.test.js       # Automated Vitest suite (steering math, camera lifecycle, gameplay)
```

---

## Running Locally on Windows in VS Code

### Prerequisites
- **Node.js 18+** (LTS recommended — download from [nodejs.org](https://nodejs.org/))
- **Visual Studio Code**
- A modern desktop browser (**Google Chrome**, **Microsoft Edge**, or **Firefox**) with WebGL enabled
- A built-in or USB webcam (optional — the game is also 100% playable with keyboard controls)

### Step-by-Step Windows Setup (PowerShell or VS Code Terminal)

1. **Open the project folder in VS Code:**
   ```powershell
   cd path\to\motion-drive-3d
   code .
   ```

2. **Open the integrated terminal in VS Code** (`Ctrl + ~`) and **install dependencies**:
   ```powershell
   npm install
   ```

3. **Copy MediaPipe WASM files into `public/wasm` (if not already present):**
   ```powershell
   New-Item -ItemType Directory -Force -Path public\wasm | Out-Null
   Copy-Item node_modules\@mediapipe\tasks-vision\wasm\* public\wasm\ -Force
   ```

4. **Start the Vite development server:**
   ```powershell
   npm run dev
   ```

5. **Open the game in your browser:**
   - Visit `http://localhost:3000`
   - Click **PLAY WITH CAMERA**, review the local-privacy notice, click **Allow Camera & Calibrate**, and click **Allow** in your browser's webcam permission prompt.

### Build & Production Preview Commands

1. **Run automated tests:**
   ```powershell
   npm test
   ```

2. **Create an optimized static production bundle (`dist/`):**
   ```powershell
   npm run build
   ```

3. **Preview the production build locally:**
   ```powershell
   npm run preview
   ```

---

## Webcam Permissions & Secure Context (HTTPS) Requirements

Modern browsers enforce strict security rules on `navigator.mediaDevices.getUserMedia()`:
- **Local Development:** Camera access works automatically on `http://localhost:3000` and `http://127.0.0.1:3000`. Note that opening via an unencrypted LAN IP (such as `http://192.168.x.x:3000`) will block webcam access unless served over HTTPS.
- **Production Deployment:** Your deployed site **must use HTTPS** (`https://...`). Static hosts like GitHub Pages, Vercel, Cloudflare Pages, and Netlify automatically provision HTTPS certificates.
- **Browser Permission Reset:** If you accidentally click *Block* on the webcam prompt, click the tune/lock icon on the left side of your browser's address bar, switch **Camera** to **Allow**, and click **Retry Camera Access**.

---

## GitHub Repository & Static Deployment Guide

Because Motion Drive 3D runs entirely in the browser with zero backend requirement, the `dist/` output can be deployed for free to any static HTTPS host.

### 1. Push to GitHub (Windows PowerShell)
```powershell
git init
git add .
git commit -m "Initial release: Motion Drive 3D webcam racing game"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

### 2. Deploy to Vercel or Netlify (Zero Config, Automatic HTTPS)
- **Netlify:** Import your GitHub repository — `netlify.toml` automatically sets Node 22, Build Command `npm run build`, Publish Directory `dist`, and `Permissions-Policy: camera=(self)`.
- **Vercel:** Import your GitHub repository at [vercel.com/new](https://vercel.com/new) — `vercel.json` automatically configures `npm run build` and `dist`.

### 3. Deploy to GitHub Pages (Automatic via GitHub Actions)
1. Push your code to the `main` branch on GitHub.
2. The included workflow (`.github/workflows/deploy.yml`) automatically installs dependencies, copies MediaPipe WASM assets, builds `dist/`, and publishes the built bundle to the `gh-pages` branch (with `.nojekyll`).
3. In your GitHub repository, go to **Settings -> Pages -> Build and deployment**:
   - **Source:** `Deploy from a branch`
   - **Branch:** `gh-pages` / `/ (root)` -> Click **Save** *(do not select `main`, as `main` contains unbuilt Vite source files)*.
4. Open your HTTPS GitHub Pages URL and grant webcam permission when starting Camera Mode.

---

## Test Report & Known Limitations

### Automated Tests Executed (`npm test` via Vitest + JSDOM)
- Verified game boots into Title Screen without invoking `getUserMedia`.
- Verified `KeyboardController` steering (`A`/`D`/Arrows), throttle (`W`), brake (`S`), pause (`Escape`), and restart (`R`).
- Verified `CameraController` requests webcam access strictly on user trigger, normalizes `NotAllowedError` permission denials cleanly, and calls `track.stop()` on all `MediaStreamTrack`s upon exiting camera mode.
- Verified `SteeringCalibration` detects both hands, calibrates neutral reference, steers **left** (`< 0`) when rotating counter-clockwise and **right** (`> 0`) when rotating clockwise in mirrored coordinates, detects open-palm braking, and smoothly returns steering to `0` neutral on tracking loss.
- Verified `Car` lateral clamping keeps the vehicle inside highway barriers (`[-PLAYER_MAX_X, +PLAYER_MAX_X]`).
- Verified `TrafficManager` leaves at least 1 unobstructed lane on every wave across all difficulty tiers.
- Verified `CollisionSystem` & `Game` hull shield impacts, fatal crash -> Game Over transition, `localStorage` personal-best persistence, clean race reset, window resize handling, and graceful fallback when MediaPipe fails to load.

### Manual Physical Webcam Checklist (For End-User Hardware Verification)
Because automated CI/sandbox environments do not have a physical webcam with live human hands in front of a lens, verify the following on your local machine:
1. Sit ~50–80 cm from your webcam in normal room lighting.
2. Click **PLAY WITH CAMERA** -> **Allow Camera & Calibrate** and confirm both hand skeletons appear in the mirrored preview.
3. Hold both hands steady at 9 and 3 o'clock until calibration reaches `READY`, rotate left/right to verify comfortable sensitivity, and test spreading both palms open to brake.

### Remaining Limitations
- First-time camera mode initialization downloads the ~4.5 MB MediaPipe `hand_landmarker.task` float16 model weight file from Google Storage (`storage.googleapis.com/mediapipe-models/...`), requiring an internet connection on first load (subsequent loads are cached by the browser).
- Strong backlighting (e.g., bright sunlight directly behind the player) or very dark rooms can reduce webcam landmark confidence; if tracking drops, the game safely eases steering to neutral and allows instant keyboard assist.
