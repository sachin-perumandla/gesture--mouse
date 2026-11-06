#!/usr/bin/env bash
# One-shot setup: installs dependencies and bundles the MediaPipe runtime + model for offline use.
set -e
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js not found. Install it (brew install node, or https://nodejs.org) and re-run."; exit 1; }
echo "Installing dependencies…"
npm install --save-dev electron electron-builder @mediapipe/tasks-vision@0.10.14
npm install @nut-tree-fork/nut-js
echo "Bundling MediaPipe runtime and hand model…"
node scripts/prepare-vendor.js
echo
echo "Done. Start the app with:  npm start"
