// Copies the debug APK to the APK folder next to the project, named after the app version
// (e.g. ../../APK/TasteTour-1.1.0-debug.apk), so the newest build is easy to spot.
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const source = resolve(root, 'android/app/build/outputs/apk/debug/app-debug.apk');
const targetDir = resolve(root, '../../APK');
const target = resolve(targetDir, `TasteTour-${version}-debug.apk`);
mkdirSync(targetDir, { recursive: true });
copyFileSync(source, target);
console.log(`APK: ${target}`);
