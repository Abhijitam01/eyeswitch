# eyeswitch

**Look at a screen. It gets focus.**

[![npm](https://img.shields.io/npm/v/eyeswitch)](https://www.npmjs.com/package/eyeswitch)
[![npm downloads](https://img.shields.io/npm/dm/eyeswitch)](https://www.npmjs.com/package/eyeswitch)
[![license](https://img.shields.io/github/license/Abhijitam01/eyeswitch)](LICENSE)
[![platform](https://img.shields.io/badge/platform-macOS-lightgrey)](https://github.com/Abhijitam01/eyeswitch)

eyeswitch uses your webcam and TensorFlow.js to track where your head is pointing, then automatically moves macOS focus to whichever monitor you're looking at — no keyboard shortcut, no clicking, no magic.

---

## Demo

> Calibrate once. Then just look at a screen — focus follows your gaze automatically.

---

## Requirements

- **macOS** (uses CoreGraphics + Accessibility APIs)
- Node.js ≥ 18
- Xcode Command Line Tools — `xcode-select --install`
- A webcam

---

## Installation

```bash
npm install -g eyeswitch
```

The native helper binary compiles automatically on install. If it fails:

```bash
npm run build:helper
```

**Grant two permissions (one-time):**

| Permission | Where |
|---|---|
| Camera | System Settings → Privacy & Security → Camera |
| Accessibility | System Settings → Privacy & Security → Accessibility → enable your terminal app |

---

## Quick start

```bash
# 1. Check everything is set up correctly
eyeswitch doctor

# 2. Calibrate — look at each monitor when prompted
eyeswitch calibrate

# 3. Start tracking
eyeswitch
```

That's it. Look at a different screen — focus follows.

Press **`p`** to pause/resume. **Ctrl+C** to stop.

---

## Commands

### `eyeswitch` — start tracking

```
Options:
  --sensitivity <level>    Preset: low | medium | high
  --no-click               Warp cursor only, no synthetic click
  --dry-run                Log gaze without switching focus
  --verbose                Print yaw/pitch values on every frame
  --camera <index>         Camera index (default: 0)
  --calibration-file <path>  Custom path to calibration JSON
  --calibrate              Force recalibration on startup
```

### `eyeswitch calibrate`

Walk through per-monitor calibration. Look at each screen and press Enter — eyeswitch samples your gaze for ~8 seconds per monitor and saves the result.

```bash
eyeswitch calibrate               # calibrate all monitors
eyeswitch calibrate --monitor 2   # recalibrate only monitor 2 (1-based)
```

### `eyeswitch doctor`

Diagnose your setup — checks the native helper, camera, accessibility permission, calibration data, and TF.js model:

```
  ✓  Native helper binary
  ✓  Accessibility permission
  ✓  Camera access
  ✓  Calibration data          2 monitors calibrated
  ✓  TF.js model
```

Exits 0 if everything is healthy, 1 if any check fails.

### `eyeswitch config get [key]`

Print the current config (or a single value).

```bash
eyeswitch config get
eyeswitch config get smoothingFactor
```

### `eyeswitch config set <key> <value>`

Persist a config value to `~/.config/eyeswitch/config.json`.

```bash
eyeswitch config set smoothingFactor 0.4
eyeswitch config set switchCooldownMs 300
```

### `eyeswitch status`

Show whether eyeswitch is calibrated and which monitor is currently focused.

### `eyeswitch reset`

Delete saved calibration data.

### `eyeswitch calibration export`

Export calibration data to stdout or a file.

```bash
eyeswitch calibration export > ~/cal-backup.json
eyeswitch calibration export -o ~/cal-backup.json
```

### `eyeswitch calibration import <file>`

Import calibration from a JSON file (restore a backup or share across machines).

```bash
eyeswitch calibration import ~/cal-backup.json
```

---

## Configuration

All values live in `~/.config/eyeswitch/config.json`. Edit with `eyeswitch config set` or directly.

| Key | Default | Description |
|---|---|---|
| `smoothingFactor` | `0.3` | EMA smoothing — 0 = raw, closer to 1 = very smooth |
| `switchCooldownMs` | `500` | Minimum ms between focus switches |
| `hysteresisFactor` | `0.25` | Bias toward staying on the current monitor (0–1) |
| `minFaceConfidence` | `0.4` | Minimum detection confidence to process a frame |
| `cameraIndex` | `0` | Which webcam to use |
| `targetFps` | `30` | Frame capture rate |
| `verticalSwitching` | `false` | Enable pitch-based switching for top/bottom monitor layouts |

### Sensitivity presets

Instead of tuning individual values, use `--sensitivity`:

| Preset | smoothingFactor | hysteresisFactor | switchCooldownMs |
|---|---|---|---|
| `low` | 0.5 | 0.40 | 800 ms |
| `medium` | 0.3 | 0.25 | 500 ms (default) |
| `high` | 0.1 | 0.10 | 200 ms |

```bash
eyeswitch --sensitivity high   # snappier switching
eyeswitch --sensitivity low    # more stable, fewer accidental switches
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Focus doesn't switch | Check Accessibility permission — `eyeswitch doctor` |
| Camera not found | Try `--camera 1` if you have multiple webcams |
| Switching feels jittery | Use `--sensitivity low` or `eyeswitch config set switchCooldownMs 800` |
| Slow to detect face | Lower `minFaceConfidence` — `eyeswitch config set minFaceConfidence 0.3` |
| `npm run build:helper` fails | Run `xcode-select --install` first |
| "Native helper not available" | Run `npm run build:helper` manually |
| Wrong monitor gets focus | Recalibrate — `eyeswitch calibrate` |

---

## How it works

1. Your webcam captures frames via `node-webcam`
2. TensorFlow.js + MediaPipe FaceMesh extracts 468 3D facial landmarks per frame
3. Yaw (horizontal) and pitch (vertical) are computed from jaw-outline and nose-tip landmarks — specifically designed to be glasses-agnostic
4. An EMA filter smooths the pose to prevent jitter
5. A calibration map translates your current gaze angles to the nearest monitor using Euclidean distance with hysteresis (so you don't accidentally switch while glancing)
6. The native ObjC helper (`eyeswitch-helper`) uses CoreGraphics to warp the cursor and the Accessibility API to fire a synthetic click, transferring focus

---

## Platform support

| Platform | Status |
|---|---|
| macOS | Full support |
| Linux | Not supported (native helper is macOS-only) |
| Windows | Not supported |

---

## Development

```bash
git clone https://github.com/Abhijitam01/eyeswitch.git
cd eyeswitch
npm install          # also compiles the native helper
npm run build        # tsc → dist/
npm test             # jest — 115 tests
npm run typecheck    # tsc --noEmit
```

To iterate on the native ObjC helper:

```bash
npm run build:helper
```

### Project structure

```
src/
  index.ts                  CLI entry point (Commander.js)
  cli.ts                    Output helpers (chalk, ora)
  config.ts                 Config schema, load/save, sensitivity presets
  types.ts                  Shared TypeScript interfaces
  camera/
    frame-capture.ts        Webcam → FrameBuffer
  face/
    face-detector.ts        TF.js MediaPipe FaceMesh wrapper
    pose-estimator.ts       Landmarks → yaw/pitch with EMA smoothing
  calibration/
    calibration-manager.ts  Sample collection, persistence, gaze→monitor mapping
    sample-aggregator.ts    Immutable median aggregator for calibration samples
  monitor/
    focus-switcher.ts       Calls native helper to switch focus
    monitor-detector.ts     Queries monitor layout via native helper
    monitor-mapper.ts       Maps gaze to MonitorLayout using calibration data
  native/
    macos-bridge.ts         TypeScript wrapper around the ObjC binary
    helper/
      eyeswitch-helper.m    Native ObjC binary (CoreGraphics, Accessibility)
```

---

## License

MIT — see [LICENSE](LICENSE)

---

<p align="center">Built by <a href="https://github.com/Abhijitam01">Abhijitam01</a></p>
