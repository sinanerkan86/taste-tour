// Renders the Play Store feature graphic (1024x500) for every language from feature.html,
// with that language's restaurant screenshot in the phone. Run screenshots.mjs first; the dev
// server must be running (npm run dev).
//
//   node tools/store/feature.mjs [baseUrl] [locale ...]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchEdge, sleep } from './cdp.mjs';

const OUT = '../../Google Play - Docs';
const ALL_LOCALES = ['en', 'tr', 'fr', 'zh'];

const [baseArg, ...localeArgs] = process.argv.slice(2);
const BASE = baseArg ?? 'http://localhost:5173/';
const locales = localeArgs.length > 0 ? localeArgs : ALL_LOCALES;

const edge = await launchEdge();
await edge.send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 500, deviceScaleFactor: 1, mobile: false });

try {
  for (const locale of locales) {
    const shot = readFileSync(join(OUT, locale, 'screenshots', `${locale}-01-restaurant.png`)).toString('base64');
    await edge.navigate(new URL(`tools/store/feature.html?lang=${locale}`, BASE).href);
    await edge.waitFor('window.ready');
    await edge.evaluate(`window.setShot('data:image/png;base64,${shot}').then(() => true)`);
    await sleep(300);
    const file = join(OUT, locale, `feature-graphic-${locale}.png`);
    writeFileSync(file, await edge.screenshot());
    console.log(`Saved ${file}`);
  }
} finally {
  await edge.close();
}
