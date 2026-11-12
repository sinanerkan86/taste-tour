// Dev screenshots of the restaurant scene with headless Edge, for judging the art.
// The dev server must be running (npm run dev).
//
//   node tools/street/shot.mjs <out.png> [query] [x,y,zoom] [waitMs] [setup code]
//
// query is appended to the game URL (e.g. "city=3&money=1e9"); x,y,zoom points the room camera
// at a world position (zoom 0 shows the whole world as far as the camera allows).
import { writeFileSync } from 'node:fs';
import { launchEdge, sleep } from '../store/cdp.mjs';

const [out, query = '', view = '', waitMs = '8000', before = ''] = process.argv.slice(2);
const edge = await launchEdge();
await edge.send('Emulation.setDeviceMetricsOverride', { width: 540, height: 1170, deviceScaleFactor: 2, mobile: true });
try {
  await edge.navigate(`http://localhost:5173/sim.html`);
  await edge.run(`localStorage.clear(); localStorage.setItem('taste-tour.settings', JSON.stringify({ buyAmount: 1, sound: false, music: false, language: 'en' }))`);
  await edge.navigate(`http://localhost:5173/?${query}`);
  await edge.waitFor('window.game && window.game.scene.isActive("Restaurant")');
  await edge.run(`window.scene = window.game.scene.getScene('Restaurant')`);
  // No first-time hint over the picture; then optional code to set the scene up (e.g. raise
  // section levels).
  await edge.run(`window.scene.seenHints.push('bottleneck')`);
  if (before) await edge.run(before);
  await sleep(Number(waitMs));
  if (view) {
    const [x, y, zoom] = view.split(',').map(Number);
    await edge.run(`(() => { const cam = window.scene.room.camera; if (${zoom} > 0) cam.setZoom(${zoom}); cam.centerOn(${x}, ${y}); })()`);
    await sleep(300);
  }
  writeFileSync(out, await edge.screenshot());
  console.log(`Saved ${out}`);
} finally {
  await edge.close();
}
