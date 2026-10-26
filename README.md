# MOTION DRIVE 3D

**Your hands. Your steering wheel. Your race.**

Motion Drive 3D is a playable, browser-native **3D highway car racing game controlled by real-time webcam hand gestures**, built with **Three.js**, **MediaPipe Hand Landmarker**, **GSAP**, and plain **JavaScript (ES Modules)**.

Sit in front of your webcam, hold both hands up as if gripping an imaginary steering wheel at 9 and 3 o'clock, and rotate your hands left or right to steer a sculpted 3D GT supercar through endless nocturnal highway traffic. All webcam frames are processed **100% locally in your browser** — no camera images or video streams are ever uploaded to a server.

---

## Features

- **Real-Time Two-Hand Webcam Steering (Primary Control):**
  - Uses MediaPipe `HandLandmarker` locally in the browser to track 21 landmarks per hand.
  - Calculates steering from the relative axle angle between your left and right palm hubs in mirrored screen space, so you steer naturally by rotating your imaginary wheel rather than sliding your body across the room.
  - Interactive **Steering Calibration Studio** with automatic neutral-grip hold detection, manual one-click neutral capture, adjustable sensitivity, center dead zone, jitter low-pass smoothing, and maximum wheel-lock angle.
  - Configurable **Gesture Throttle & Brake** modes (including *Auto-Accelerate + Open Both Palms to Brake*, *Closed Grip = Gas / Open Palms = Brake*, and *Auto-Accelerate Only*).
  - **Safe Tracking-Loss Recovery:** If one or both hands leave the camera frame, steering smoothly returns toward center neutral (`0°`) and displays `TRACKING LOST — SHOW BOTH HANDS`.
- **Full Keyboard Fallback & Assist:**
  - `A` / `Left Arrow` — Steer Left
  - `D` / `Right Arrow` — Steer Right
  - `W` / `Up Arrow` — Accelerate / Boost
  - `S` / `Down Arrow` — Brake
  - `Escape` — Pause / Resume
  - `R` — Instant Restart
  - `H` — Hide / Show Bottom Steering Gauge
- **3D Highway World & Procedural Audio:**
  - Multi-part sculpted GT player car with clearcoat paint, rotating 5-spoke wheels, articulated front steering knuckles, dynamic brake lights, projected road headlights, suspension micro-bumps, and collision sparks.
  - Endless 4-lane highway with high-anisotropy procedural asphalt, dashed lane markers, reflective studs, concrete barriers, cantilevered streetlights, pine groves, and an illuminated distant skyline.
  - Object-pooled multi-part traffic vehicles (sedans, coupes, SUVs, heavy cargo trucks) with fair wave spawning that always leaves at least one unobstructed lane.
  - 3-point hull integrity shield system, near-miss overtake bonuses (`+50`), progressive speed/traffic difficulty tiers, procedural Web Audio GT engine synthesizer (with mute toggle), and `localStorage` personal-best persistence.

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
- **Vercel:** Import your GitHub repository at [vercel.com/new](https://vercel.com/new). Framework preset: **Vite**, Build Command: `npm run build`, Output Directory: `dist`.
- **Netlify:** Import your GitHub repository, set Build Command to `npm run build` and Publish Directory to `dist`.

### 3. Deploy to GitHub Pages
1. If deploying to `https://<your-username>.github.io/<your-repo-name>/`, set `base: './'` in `vite.config.ts` (note: in `src/controls/HandTracker.js`, MediaPipe automatically falls back to the jsDelivr CDN WASM bundle if `/wasm` is hosted under a subpath).
2. Build and deploy using `gh-pages` or GitHub Actions:
   ```powershell
   npm run build
   npx gh-pages -d dist
   ```
3. Open your HTTPS GitHub Pages URL and grant webcam permission when starting Camera Mode.

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
