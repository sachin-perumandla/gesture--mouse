// Turns MediaPipe hand landmarks into mouse actions. Tweak CFG to taste.
export const CFG = {
  region: { x0: 0.2, x1: 0.8, y0: 0.15, y1: 0.7 }, // part of the camera view mapped to the whole screen
  smoothing: 0.35,       // 0..1, lower = smoother but laggier
  pinchOn: 0.25,         // pinch distance / palm size to start a pinch
  pinchOff: 0.35,        // ...to release it (the gap stops flicker)
  clickMaxMs: 350,       // pinch shorter than this = click
  dragHoldMs: 350,       // pinch held longer than this = drag
  clickCooldownMs: 300,
  scrollGain: 600,       // flip the sign if scrolling feels backwards
  pauseHoldMs: 700       // hold a fist this long to pause/resume
};

const clamp = (v) => Math.min(1, Math.max(0, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const up = (lm, tip, pip) => lm[tip].y < lm[pip].y - 0.025;

export function createController(api) {
  const noop = () => {};
  const m = { move: noop, click: noop, rightClick: noop, down: noop, up: noop, scroll: noop, ...(api || {}) };
  let paused = false, sx = null, sy = null;
  let pinching = false, dragging = false, pinchStart = 0, rpinching = false, lastClick = 0;
  let fistStart = 0, fistToggled = false, lastScrollY = null;

  function reset() {
    if (dragging) m.up();
    pinching = dragging = rpinching = false;
    fistStart = 0; fistToggled = false; lastScrollY = null;
  }

  function target(p) {
    const r = CFG.region;
    const nx = clamp((1 - p.x - r.x0) / (r.x1 - r.x0)); // 1 - x because the camera view is mirrored
    const ny = clamp((p.y - r.y0) / (r.y1 - r.y0));
    if (sx === null) { sx = nx; sy = ny; }
    sx += (nx - sx) * CFG.smoothing;
    sy += (ny - sy) * CFG.smoothing;
    return [sx, sy];
  }

  function update(lm) {
    const now = performance.now();
    const idx = up(lm, 8, 6), mid = up(lm, 12, 10), ring = up(lm, 16, 14), pinky = up(lm, 20, 18);
    const palm = dist(lm[0], lm[9]) || 1;               // wrist -> middle knuckle, so thresholds scale with hand size
    const pinchD = dist(lm[4], lm[8]) / palm;
    const rpinchD = dist(lm[4], lm[12]) / palm;

    // Fist: hold to pause / resume
    if (!idx && !mid && !ring && !pinky && pinchD > CFG.pinchOn) {
      if (!fistStart) fistStart = now;
      if (!fistToggled && now - fistStart > CFG.pauseHoldMs) {
        paused = !paused; fistToggled = true;
        if (dragging) { m.up(); dragging = false; }
      }
      return fistToggled ? (paused ? 'Paused' : 'Resumed') : 'Fist (hold to pause/resume)';
    }
    fistStart = 0; fistToggled = false;
    if (paused) return 'Paused — hold a fist to resume';

    // Right click: thumb + middle pinch
    const wasR = rpinching;
    rpinching = !pinching && rpinchD < (wasR ? CFG.pinchOff : CFG.pinchOn);
    if (rpinching) {
      if (!wasR && now - lastClick > CFG.clickCooldownMs) { m.rightClick(); lastClick = now; }
      return 'Right click (thumb + middle)';
    }

    // Left click / drag: thumb + index pinch (cursor is frozen while pinching, so clicks land where you aimed)
    const wasP = pinching;
    pinching = pinchD < (wasP ? CFG.pinchOff : CFG.pinchOn);
    if (pinching && !wasP) pinchStart = now;
    if (!pinching && wasP) {
      if (dragging) { m.up(); dragging = false; }
      else if (now - pinchStart < CFG.clickMaxMs && now - lastClick > CFG.clickCooldownMs) { m.click(); lastClick = now; }
    }
    if (pinching) {
      if (!dragging && now - pinchStart > CFG.dragHoldMs) { dragging = true; m.down(); }
      if (dragging) { const [x, y] = target(lm[8]); m.move(x, y); }
      return dragging ? 'Dragging (pinch + hold)' : 'Pinch';
    }

    // Scroll: two fingers up, move hand up/down
    if (idx && mid && !ring && !pinky) {
      const y = (lm[8].y + lm[12].y) / 2;
      if (lastScrollY !== null) m.scroll(Math.round((y - lastScrollY) * CFG.scrollGain));
      lastScrollY = y;
      return 'Scroll (two fingers)';
    }
    lastScrollY = null;

    // Move pointer: index finger only
    if (idx && !mid && !ring && !pinky) { const [x, y] = target(lm[8]); m.move(x, y); return 'Move pointer'; }
    if (idx && mid && ring && pinky) return 'Open hand';
    return 'Hand detected';
  }

  return { update, reset, togglePause() { paused = !paused; reset(); } };
}
