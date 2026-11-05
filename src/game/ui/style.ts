import Phaser from 'phaser';
import { FONT, PALETTE, toCss } from '../config';
import { type Ctx, css, paintTexture, roundRect, shade, vGradient } from '../view/paint';

// The shared look of the interface: chunky glossy buttons with a light rim, soft gradient cards
// and white text with a dark outline, like toys made of candy.

export const OUTLINE = 0x3a2016;
const RIM = 0xfff4dc;

// White (or colored) text with a dark outline and a small drop shadow.
export function outlined(
  size: number,
  options: { color?: number; stroke?: number; thickness?: number; weight?: 'bold' | 'normal' } = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  const stroke = options.stroke ?? OUTLINE;
  return {
    fontFamily: FONT,
    fontSize: `${size}px`,
    fontStyle: options.weight ?? 'bold',
    color: toCss(options.color ?? 0xffffff),
    stroke: toCss(stroke),
    strokeThickness: options.thickness ?? Math.max(4, Math.round(size / 6)),
    shadow: { offsetX: 0, offsetY: Math.max(2, Math.round(size / 14)), color: 'rgba(40,20,10,0.45)', blur: 0, fill: true, stroke: true },
  };
}

// Plain text in the game font, for body copy on light cards.
export function plain(size: number, color: number = PALETTE.ink, bold = false): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color: toCss(color) };
}

export interface Gloss {
  // Main color of the face; the gradient and lip are derived from it.
  face: number;
  // Rim around the face (light) and the outline around everything (dark).
  rim?: number;
  outline?: number;
}

// A glossy candy button face. The bottom LIP pixels are the darker side that makes it look raised.
export const LIP = 9;

export function glossyButton(scene: Phaser.Scene, width: number, height: number, gloss: Gloss): string {
  const rim = gloss.rim ?? RIM;
  const outline = gloss.outline ?? shade(gloss.face, -0.55);
  const key = `btn-${width}x${height}-${gloss.face.toString(16)}-${rim.toString(16)}`;
  return paintTexture(scene, key, width + 8, height + 8, (ctx) => {
    ctx.translate(4, 4);
    paintPill(ctx, width, height, gloss.face, rim, outline);
  });
}

export function paintPill(ctx: Ctx, width: number, height: number, face: number, rim: number, outline: number): void {
  const radius = Math.min(height / 2, 34);
  // Soft drop shadow.
  ctx.fillStyle = 'rgba(40,20,10,0.28)';
  roundRect(ctx, 0, 4, width, height, radius);
  ctx.fill();
  // Dark outline, then the light rim.
  ctx.fillStyle = css(outline);
  roundRect(ctx, 0, 0, width, height, radius);
  ctx.fill();
  ctx.fillStyle = vGradient(ctx, 2, height - 2, [
    [0, css(rim, 0.3)],
    [1, css(rim, -0.18)],
  ]);
  roundRect(ctx, 2.5, 2, width - 5, height - 5, radius - 2);
  ctx.fill();
  // The raised face: lip below, gradient face above.
  const inset = 7;
  const faceH = height - inset * 2 - 1;
  ctx.fillStyle = css(face, -0.38);
  roundRect(ctx, inset, inset, width - inset * 2, faceH, radius - inset);
  ctx.fill();
  ctx.fillStyle = vGradient(ctx, inset, inset + faceH - LIP, [
    [0, css(face, 0.35)],
    [0.5, css(face, 0.05)],
    [1, css(face, -0.12)],
  ]);
  roundRect(ctx, inset, inset, width - inset * 2, faceH - LIP + 3, radius - inset);
  ctx.fill();
  // Gloss: a soft white band across the top half.
  ctx.fillStyle = vGradient(ctx, inset + 2, inset + faceH * 0.45, [
    [0, 'rgba(255,255,255,0.55)'],
    [1, 'rgba(255,255,255,0.05)'],
  ]);
  roundRect(ctx, inset + 8, inset + 3, width - inset * 2 - 16, faceH * 0.42, Math.max(4, radius - inset - 6));
  ctx.fill();
  // A tiny sparkle at the top left.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(inset + radius * 0.55, inset + 8, 6, 3.5, -0.4, 0, Math.PI * 2);
  ctx.fill();
}

// A soft card: light gradient face, white inner edge, colored border, soft shadow.
export function card(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  options: { top: number; bottom: number; border: number; radius?: number; borderWidth?: number },
): string {
  return paintTexture(scene, key, width + 12, height + 16, (ctx) => {
    ctx.translate(6, 4);
    const r = options.radius ?? 26;
    const bw = options.borderWidth ?? 4;
    ctx.fillStyle = 'rgba(60,30,15,0.22)';
    roundRect(ctx, 0, 6, width, height, r);
    ctx.fill();
    ctx.fillStyle = css(options.border);
    roundRect(ctx, 0, 0, width, height, r);
    ctx.fill();
    ctx.fillStyle = vGradient(ctx, bw, height - bw, [
      [0, css(options.top)],
      [1, css(options.bottom)],
    ]);
    roundRect(ctx, bw, bw, width - bw * 2, height - bw * 2, r - bw);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2;
    roundRect(ctx, bw + 2, bw + 2, width - bw * 2 - 4, height - bw * 2 - 4, r - bw - 2);
    ctx.stroke();
  });
}

// A dark translucent pill for counters (money, stars), with an icon overlapping its left end.
export function counterPill(scene: Phaser.Scene, width: number, height: number): string {
  return paintTexture(scene, `pill-${width}x${height}`, width + 6, height + 8, (ctx) => {
    ctx.translate(3, 2);
    ctx.fillStyle = 'rgba(40,10,5,0.42)';
    roundRect(ctx, 0, 0, width, height, height / 2);
    ctx.fill();
    ctx.fillStyle = vGradient(ctx, 0, height, [
      [0, 'rgba(0,0,0,0.25)'],
      [0.5, 'rgba(0,0,0,0)'],
    ]);
    roundRect(ctx, 0, 0, width, height, height / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    roundRect(ctx, 1, 1, width - 2, height - 2, height / 2 - 1);
    ctx.stroke();
  });
}

const AWNING_STRIPE = 90;
export const AWNING_HEIGHT = 190;
const SCALLOP = 24;

// The HUD background: a red and cream striped awning with a scalloped hem.
export function paintHudAwning(scene: Phaser.Scene): string {
  const width = 1080;
  return paintTexture(scene, 'hud-awning', width, AWNING_HEIGHT + SCALLOP + 14, (ctx) => {
    const r = AWNING_STRIPE / 2;
    const hem = (offset: number) => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(width, 0);
      ctx.lineTo(width, AWNING_HEIGHT + offset);
      for (let x = width; x > 0; x -= AWNING_STRIPE) ctx.arc(x - r, AWNING_HEIGHT + offset, r, 0, Math.PI);
      ctx.closePath();
    };
    // Soft shadow of the hem on the room.
    ctx.fillStyle = 'rgba(40,15,5,0.28)';
    ctx.save();
    ctx.translate(0, 10);
    ctx.scale(1, (AWNING_HEIGHT + SCALLOP * 0.6) / (AWNING_HEIGHT + r));
    hem(0);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.scale(1, (AWNING_HEIGHT + SCALLOP) / (AWNING_HEIGHT + r));
    hem(0);
    ctx.clip();
    for (let i = 0; i * AWNING_STRIPE < width; i++) {
      const red = i % 2 === 0;
      ctx.fillStyle = vGradient(ctx, 0, AWNING_HEIGHT + r, red
        ? [[0, '#ff6a55'], [0.55, '#e8463a'], [1, '#b8281e']]
        : [[0, '#fffaf0'], [0.55, '#ffeccc'], [1, '#e8c9a0']]);
      ctx.fillRect(i * AWNING_STRIPE, 0, AWNING_STRIPE, AWNING_HEIGHT + r);
    }
    // Folds: each stripe is rounded like fabric.
    for (let i = 0; i * AWNING_STRIPE < width; i++) {
      const x = i * AWNING_STRIPE;
      const g = ctx.createLinearGradient(x, 0, x + AWNING_STRIPE, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.12)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.12)');
      g.addColorStop(1, 'rgba(0,0,0,0.16)');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, AWNING_STRIPE, AWNING_HEIGHT + r);
    }
    // A darker band under the HUD contents so text pops, and a hem trim.
    ctx.fillStyle = vGradient(ctx, 0, AWNING_HEIGHT, [
      [0, 'rgba(90,20,10,0.35)'],
      [1, 'rgba(90,20,10,0.05)'],
    ]);
    ctx.fillRect(0, 0, width, AWNING_HEIGHT);
    ctx.restore();
    ctx.save();
    ctx.scale(1, (AWNING_HEIGHT + SCALLOP) / (AWNING_HEIGHT + r));
    ctx.strokeStyle = '#f2c94c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = width; x > 0; x -= AWNING_STRIPE) ctx.arc(x - r, AWNING_HEIGHT - 6, r, 0, Math.PI);
    ctx.stroke();
    ctx.restore();
  });
}

// Chinese and Japanese characters can break anywhere; everything else breaks at spaces.
// Tokens: one CJK character, a run of spaces, or a run of anything else (a word).
const WRAP_TOKENS = /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]|\s+|[^\s\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]+/g;
// Punctuation that must not start a line.
const NO_LINE_START = /^[\uff0c\u3002\uff01\uff1f\u3001\uff1a\uff1b\uff09\u300d\u300f\u201d\u2019!?,.:;)]/;

// Word wrapping for Phaser text that also breaks Chinese text, which has no spaces.
export function wrapStyle(width: number): Phaser.Types.GameObjects.Text.TextWordWrap {
  return {
    width,
    callback: (text: string, textObject: Phaser.GameObjects.Text) => {
      const ctx = textObject.context;
      return text.split('\n').flatMap((paragraph) => {
        const tokens = paragraph.match(WRAP_TOKENS) ?? [''];
        const lines: string[] = [];
        let line = '';
        for (const token of tokens) {
          const candidate = line + token;
          if (line.trim() !== '' && ctx.measureText(candidate).width > width && !/^\s+$/.test(token) && !NO_LINE_START.test(token)) {
            lines.push(line.trimEnd());
            line = token.trimStart();
          } else {
            line = candidate;
          }
        }
        lines.push(line.trimEnd());
        return lines;
      });
    },
  };
}
