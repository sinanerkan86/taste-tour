// Puts a language's screenshots side by side at a small scale, for a quick review.
//   node tools/store/contact.mjs <locale> <out.png>
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const [locale, out] = process.argv.slice(2);
const dir = join('../../Google Play - Docs', locale, 'screenshots');
const files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
const w = 432;
const h = 864;
const tiles = await Promise.all(files.map((f) => sharp(join(dir, f)).resize(w, h).toBuffer()));
await sharp({ create: { width: w * tiles.length, height: h, channels: 3, background: '#333' } })
  .composite(tiles.map((input, i) => ({ input, left: i * w, top: 0 })))
  .png()
  .toFile(out);
