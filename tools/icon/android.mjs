// Turns the rendered icon layers in assets/ into Android launcher icons and the Play Store icon.
// Usage: node tools/icon/android.mjs (run by tools/icon/export.sh).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const RES = 'android/app/src/main/res';
const PLAY_ICON = '../../Google Play - Docs/graphics/icon-512.png';
// Launcher icons are 48 dp; adaptive icon layers are 108 dp (the launcher shows the middle 72).
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

async function resize(source, size, out) {
  mkdirSync(dirname(out), { recursive: true });
  await sharp(source).resize(size, size).png().toFile(out);
}

async function round(source, size, out) {
  const mask = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`);
  await sharp(source).resize(size, size).composite([{ input: mask, blend: 'dest-in' }]).png().toFile(out);
}

for (const [name, scale] of Object.entries(DENSITIES)) {
  const dir = join(RES, `mipmap-${name}`);
  await resize('assets/icon-only.png', 48 * scale, join(dir, 'ic_launcher.png'));
  await round('assets/icon-only.png', 48 * scale, join(dir, 'ic_launcher_round.png'));
  await resize('assets/icon-foreground.png', 108 * scale, join(dir, 'ic_launcher_foreground.png'));
  await resize('assets/icon-background.png', 108 * scale, join(dir, 'ic_launcher_background.png'));
}

const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
for (const file of ['ic_launcher.xml', 'ic_launcher_round.xml']) writeFileSync(join(RES, 'mipmap-anydpi-v26', file), adaptive);

await resize('assets/icon-only.png', 512, PLAY_ICON);
// The web loading screen in index.html shows the foreground layer on the same red.
await resize('assets/icon-foreground.png', 480, 'public/splash-icon.png');
console.log('Android icons and the Play Store icon are up to date.');
