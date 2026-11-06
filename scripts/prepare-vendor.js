// Copies the MediaPipe runtime out of node_modules and downloads the hand model, so the app works offline.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = path.join(root, 'node_modules', '@mediapipe', 'tasks-vision');
const out = path.join(root, 'renderer', 'vendor');
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

(async () => {
  if (!fs.existsSync(pkg)) { console.error('Run ./setup.sh (or npm install) first.'); process.exit(1); }
  fs.mkdirSync(out, { recursive: true });
  fs.copyFileSync(path.join(pkg, 'vision_bundle.mjs'), path.join(out, 'vision_bundle.mjs'));
  fs.cpSync(path.join(pkg, 'wasm'), path.join(out, 'wasm'), { recursive: true });

  const model = path.join(out, 'hand_landmarker.task');
  if (!fs.existsSync(model)) {
    console.log('Downloading hand model…');
    try {
      const res = await fetch(MODEL_URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1e6) throw new Error('file too small');
      fs.writeFileSync(model, buf);
    } catch (e) {
      console.error('Model download failed (' + e.message + ').\nDownload it manually from:\n' + MODEL_URL + '\nand save it as renderer/vendor/hand_landmarker.task');
      process.exit(1);
    }
  }
  console.log('Vendor files ready in renderer/vendor');
})();
