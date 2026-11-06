# Gesture Mouse

Control your Mac's cursor with hand gestures using your webcam.
Electron app · MediaPipe Hand Landmarker (runs locally, offline) · nut-js for mouse control.

## Setup (macOS)

Requires Node.js 20+ (`brew install node`).

```bash
chmod +x setup.sh && ./setup.sh   # installs deps, bundles the MediaPipe runtime + hand model
npm start
```

### Permissions (required, one time)
1. **Camera**: click Allow on the prompt.
2. **Accessibility**: System Settings → Privacy & Security → Accessibility → enable the app, then restart it.
   When running with `npm start` the app that needs permission is **Electron** (or your Terminal), not "Gesture Mouse".

Then click **Start camera & tracking** in the window. Closing the window keeps the app running in the menu bar.

## Gestures

| Gesture | Action |
|---|---|
| ☝️ Index finger up | Move cursor |
| 🤏 Quick thumb+index pinch | Left click |
| 🤏 Pinch and hold | Drag (release to drop) |
| Thumb + middle pinch | Right click |
| ✌️ Two fingers up, move hand up/down | Scroll |
| ✊ Hold a fist ~0.7 s | Pause / resume |

**Kill switch:** ⌘⇧G (or menu bar icon → Pause) toggles gesture control from anywhere.

## Tuning

Edit `CFG` at the top of `renderer/gesture-bridge.js`: smoothing, pinch thresholds, click/drag timing,
scroll speed (flip the sign of `scrollGain` for the opposite direction), and the camera region mapped to the screen.

## Build the .app / .dmg

```bash
npm run dist     # output in dist/
```
Unsigned builds work on the Mac that built them. To share with others, sign and notarize with an Apple Developer ID
(electron-builder docs: "Code Signing" and "Notarize"). Entitlements are already set in `build/entitlements.mac.plist`.

## Troubleshooting

- **Cursor doesn't move:** Accessibility permission missing, or the wrong app is enabled (see above). Restart after enabling.
- **Black camera / no prompt:** System Settings → Privacy & Security → Camera. Run `tccutil reset Camera` and relaunch if the prompt was dismissed.
- **Model/wasm errors:** run `npm run vendor`; confirm `renderer/vendor/hand_landmarker.task` exists (~7 MB).
- **Cursor can't reach screen edges / is offset:** run `CURSOR_SCALE=2 npm start` (or 0.5) to correct a Retina scaling mismatch.
- **Tracking freezes when the window is hidden:** minimize it instead of closing.
- **nut-js install fails:** make sure Xcode command line tools are installed (`xcode-select --install`).
- Only the primary display is controlled.

## Using VS Code

- Open this folder in VS Code (`code .`). Run tasks with Terminal → Run Task (Setup, Refresh MediaPipe files, Build).
- Press **F5** (Run and Debug → "Run Gesture Mouse") to launch with the debugger. Main-process breakpoints work in `main.js`;
  for the page, use **⌥⌘I** in the app window to open DevTools.
- Launched from VS Code, macOS may attribute permissions to **Visual Studio Code** and/or **Electron**. If the cursor doesn't move,
  enable both in Privacy & Security → Accessibility, then restart the app.
