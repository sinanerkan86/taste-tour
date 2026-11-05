// Takes the Play Store screenshots (1080x2160) for every language with headless Edge.
// The dev server must be running (npm run dev).
//
//   node tools/store/screenshots.mjs [baseUrl] [locale ...]     (SHOT=03 takes a single shot)
//
// Each shot writes a demo save into localStorage, reloads the game, lets the restaurant fill
// with customers, optionally opens a tab or dialog, and saves a PNG to
// ../../Google Play - Docs/<locale>/screenshots/.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchEdge, sleep } from './cdp.mjs';
import { SHOTS } from './shots.mjs';

const OUT = '../../Google Play - Docs';
const ALL_LOCALES = ['en', 'tr', 'fr', 'zh'];

const [baseArg, ...localeArgs] = process.argv.slice(2);
const BASE = baseArg ?? 'http://localhost:5173/';
const locales = localeArgs.length > 0 ? localeArgs : ALL_LOCALES;
const only = process.env.SHOT;

const edge = await launchEdge();
// 540x1080 CSS pixels at 2x: a 1080x2160 image, the tallest a Play screenshot may be (2:1).
await edge.send('Emulation.setDeviceMetricsOverride', { width: 540, height: 1080, deviceScaleFactor: 2, mobile: true });

try {
  for (const locale of locales) {
    const dir = join(OUT, locale, 'screenshots');
    mkdirSync(dir, { recursive: true });
    for (const shot of SHOTS) {
      if (only && !shot.name.startsWith(only)) continue;
      const save = { version: 1, savedAt: Date.now(), economy: shot.economy, seenHints: ['bottleneck'] };
      const settings = { buyAmount: 1, sound: false, music: false, language: locale };
      // The game saves itself when the page closes, so write the demo save from a page of the
      // same origin that has no game running.
      await edge.navigate(new URL('sim.html', BASE).href);
      await edge.run(`localStorage.clear();
        localStorage.setItem('taste-tour.save', ${JSON.stringify(JSON.stringify(save))});
        localStorage.setItem('taste-tour.settings', ${JSON.stringify(JSON.stringify(settings))})`);
      await edge.navigate(BASE);
      await edge.waitFor('window.game && window.game.scene.isActive("Restaurant")');
      await edge.run(`window.scene = window.game.scene.getScene('Restaurant')`);
      if (shot.before) await edge.run(shot.before);
      await sleep(shot.waitMs ?? 25000);
      if (shot.action) {
        await edge.run(shot.action);
        await sleep(shot.afterMs ?? 1500);
      }
      const file = join(dir, `${locale}-${shot.name}.png`);
      writeFileSync(file, await edge.screenshot());
      console.log(`Saved ${file}`);
    }
  }
} finally {
  await edge.close();
}
