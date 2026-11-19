import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { ROOF, STAIR_DOOR } from './layout';
import { type Ctx, css, ellipse, floorShadow, hGradient, paintTexture, radial, rgba, roundRect, seeded, vGradient } from './paint';
import type { CityTheme } from './themes';

// Art of the roof terrace: the sky and skyline behind the building, the roof itself, the open-air
// furniture and the stairs (the doorway in the room's back wall and the hatch on the roof).
// Everything is painted in world coordinates or around an origin named in each comment.

const W = GAME_WIDTH;
const BACKDROP_BOTTOM = ROOF.parapetTop + 50;
export const BASE_TOP = ROOF.parapetTop - 180;
const BASE_BOTTOM = ROOF.edgeBottom + 28;
const WARM = 0xffd99a;

const themeKey = (theme: CityTheme) => `${theme.sky.toString(16)}-${theme.wall.toString(16)}-${theme.tileA.toString(16)}-${theme.accent.toString(16)}`;

// --- Sky and skyline ---------------------------------------------------------------------

// Sky gradient with a sun glow, clouds and a hazy row of far buildings. World y from ROOF.top.
export function roofBackdropTexture(scene: Phaser.Scene, theme: CityTheme): string {
  return paintTexture(scene, `roof-backdrop-${themeKey(theme)}`, W, BACKDROP_BOTTOM - ROOF.top, (ctx) => {
    ctx.translate(0, -ROOF.top);
    const random = seeded(theme.wall);
    ctx.fillStyle = vGradient(ctx, ROOF.top, BACKDROP_BOTTOM, [
      [0, css(theme.sky, -0.3)],
      [0.5, css(theme.sky, -0.04)],
      [1, css(theme.sky, 0.55)],
    ]);
    ctx.fillRect(0, ROOF.top, W, BACKDROP_BOTTOM - ROOF.top);
    // Low sun behind the landmark.
    const sunX = 180 + random() * 700;
    ctx.fillStyle = radial(ctx, sunX, ROOF.parapetTop - 110, 0, 300, [
      [0, 'rgba(255,248,225,0.75)'],
      [0.25, 'rgba(255,240,200,0.3)'],
      [1, 'rgba(255,240,200,0)'],
    ]);
    ctx.fillRect(0, ROOF.top, W, BACKDROP_BOTTOM - ROOF.top);
    // Clouds: a few soft puffs.
    for (let i = 0; i < 7; i++) {
      const cx = random() * W;
      const cy = ROOF.top + 40 + random() * 190;
      const size = 0.7 + random() * 0.9;
      for (let p = 0; p < 5; p++) {
        const px = cx + (p - 2) * 34 * size;
        const py = cy + Math.sin(p * 1.7) * 8 * size;
        ctx.fillStyle = radial(ctx, px, py, 0, 40 * size, [
          [0, 'rgba(255,255,255,0.8)'],
          [1, 'rgba(255,255,255,0)'],
        ]);
        ellipse(ctx, px, py, 52 * size, 22 * size);
        ctx.fill();
      }
    }
    // Far buildings, hazy and a little lighter than the sky's lower edge.
    const far = css(theme.sky, -0.22, 0.85);
    for (let x = -20; x < W; ) {
      const w = 46 + random() * 70;
      const h = 40 + random() * 120;
      ctx.fillStyle = vGradient(ctx, BACKDROP_BOTTOM - h, BACKDROP_BOTTOM, [
        [0, far],
        [1, css(theme.sky, -0.1, 0.9)],
      ]);
      ctx.fillRect(x, BACKDROP_BOTTOM - h, w, h);
      if (random() < 0.3) {
        ctx.fillRect(x + w / 2 - 1.5, BACKDROP_BOTTOM - h - 26, 3, 28);
      } else if (random() < 0.3) {
        ctx.beginPath();
        ctx.arc(x + w / 2, BACKDROP_BOTTOM - h, w * 0.35, Math.PI, 0);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      for (let wy = BACKDROP_BOTTOM - h + 10; wy < BACKDROP_BOTTOM - 8; wy += 16) {
        for (let wx = x + 8; wx < x + w - 8; wx += 14) if (random() < 0.55) ctx.fillRect(wx, wy, 5, 7);
      }
      x += w + random() * 6;
    }
  });
}

// A veil of haze that softens the landmark and the far buildings toward the horizon.
export function roofHazeTexture(scene: Phaser.Scene, theme: CityTheme): string {
  return paintTexture(scene, `roof-haze-${theme.sky.toString(16)}`, W, 200, (ctx) => {
    ctx.fillStyle = vGradient(ctx, 0, 200, [
      [0, rgba(theme.sky, 0)],
      [1, rgba(theme.sky, 0.55)],
    ]);
    ctx.fillRect(0, 0, W, 200);
  });
}

// --- The roof ----------------------------------------------------------------------------

function building(ctx: Ctx, theme: CityTheme, x: number, w: number, top: number, bottom: number, random: () => number): void {
  ctx.fillStyle = hGradient(ctx, x, x + w, [
    [0, css(theme.tileA, -0.18)],
    [1, css(theme.tileA, -0.4)],
  ]);
  ctx.fillRect(x, top, w, bottom - top);
  // Roof edge and little rooftop boxes.
  ctx.fillStyle = css(theme.tileA, -0.5);
  ctx.fillRect(x - 2, top - 5, w + 4, 7);
  if (random() < 0.7) ctx.fillRect(x + 8 + random() * (w - 36), top - 18, 22, 14);
  // Lit and dark windows.
  for (let wy = top + 14; wy < bottom - 10; wy += 22) {
    for (let wx = x + 9; wx < x + w - 14; wx += 19) {
      ctx.fillStyle = random() < 0.35 ? rgba(WARM, 0.85) : 'rgba(20,25,45,0.55)';
      ctx.fillRect(wx, wy, 9, 13);
    }
  }
}

// The roof: nearby buildings framing the view, the back parapet, the tar-paper deck and the
// building's front edge. World y from BASE_TOP; the deck is plain until the terrace is opened.
export function roofBaseTexture(scene: Phaser.Scene, theme: CityTheme): string {
  return paintTexture(scene, `roof-base-${themeKey(theme)}`, W, BASE_BOTTOM - BASE_TOP, (ctx) => {
    ctx.translate(0, -BASE_TOP);
    const random = seeded(theme.tileA + 7);
    // Near buildings on both sides, so the skyline is framed.
    [
      [-10, 92, 150],
      [78, 70, 96],
      [140, 84, 60],
      [880, 80, 70],
      [956, 70, 124],
      [1020, 84, 168],
    ].forEach(([x, w, h]) => building(ctx, theme, x, w, ROOF.parapetTop - h, ROOF.parapetTop + 30, random));

    // Back parapet: coping, wall face with pilasters, and its shadow on the deck.
    const faceTop = ROOF.parapetTop + 14;
    ctx.fillStyle = vGradient(ctx, faceTop, ROOF.deckTop, [
      [0, css(theme.wall, -0.02)],
      [1, css(theme.wall, -0.22)],
    ]);
    ctx.fillRect(0, faceTop, W, ROOF.deckTop - faceTop);
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = random() < 0.5 ? 'rgba(255,255,255,0.1)' : 'rgba(80,50,30,0.1)';
      ctx.fillRect(random() * W, faceTop + random() * (ROOF.deckTop - faceTop), 2, 1.5);
    }
    for (let x = 0; x <= W; x += 270) {
      ctx.fillStyle = hGradient(ctx, x - 16, x + 16, [
        [0, css(theme.wall, -0.16)],
        [0.45, css(theme.wall, 0.1)],
        [1, css(theme.wall, -0.24)],
      ]);
      ctx.fillRect(x - 16, faceTop, 32, ROOF.deckTop - faceTop);
    }
    ctx.fillStyle = vGradient(ctx, ROOF.parapetTop, faceTop, [
      [0, css(0xf3ece0, 0.12)],
      [1, css(0xf3ece0, -0.18)],
    ]);
    ctx.fillRect(0, ROOF.parapetTop, W, faceTop - ROOF.parapetTop);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillRect(0, ROOF.parapetTop, W, 2.5);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(0, faceTop, W, 3);

    // Deck: roofing membrane with seams, gravel and stains.
    ctx.fillStyle = vGradient(ctx, ROOF.deckTop, ROOF.deckBottom, [
      [0, '#6b6965'],
      [1, '#8a8780'],
    ]);
    ctx.fillRect(0, ROOF.deckTop, W, ROOF.deckBottom - ROOF.deckTop);
    ctx.strokeStyle = 'rgba(30,28,25,0.35)';
    ctx.lineWidth = 2;
    for (let x = 60; x < W; x += 150) {
      ctx.beginPath();
      ctx.moveTo(x, ROOF.deckTop);
      ctx.lineTo(x + (x - W / 2) * 0.08, ROOF.deckBottom);
      ctx.stroke();
    }
    for (let i = 0; i < 3400; i++) {
      const tone = random();
      ctx.fillStyle = tone < 0.4 ? 'rgba(40,38,34,0.3)' : tone < 0.8 ? 'rgba(230,225,215,0.22)' : 'rgba(120,115,105,0.4)';
      ellipse(ctx, random() * W, ROOF.deckTop + random() * (ROOF.deckBottom - ROOF.deckTop), 1.4 + random() * 2.2, 1 + random() * 1.3);
      ctx.fill();
    }
    for (let i = 0; i < 4; i++) {
      const x = 120 + random() * 840;
      const y = ROOF.deckTop + 70 + random() * 160;
      ctx.fillStyle = radial(ctx, x, y, 0, 70, [
        [0, 'rgba(130,150,165,0.4)'],
        [1, 'rgba(130,150,165,0)'],
      ]);
      ellipse(ctx, x, y, 70, 16);
      ctx.fill();
    }
    ctx.fillStyle = vGradient(ctx, ROOF.deckTop, ROOF.deckTop + 40, [
      [0, 'rgba(20,12,5,0.4)'],
      [1, 'rgba(20,12,5,0)'],
    ]);
    ctx.fillRect(0, ROOF.deckTop, W, 40);

    // The building's front edge: coping on top, a concrete band with blocks, and its shadow on the wall below.
    const copingTop = ROOF.deckBottom - 4;
    ctx.fillStyle = vGradient(ctx, copingTop, copingTop + 14, [
      [0, '#e9e4da'],
      [1, '#b9b3a6'],
    ]);
    ctx.fillRect(0, copingTop, W, 14);
    ctx.fillStyle = vGradient(ctx, copingTop + 14, ROOF.edgeBottom, [
      [0, css(theme.wall, -0.18)],
      [1, css(theme.wall, -0.4)],
    ]);
    ctx.fillRect(0, copingTop + 14, W, ROOF.edgeBottom - copingTop - 14);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    for (let x = 12; x < W; x += 30) ctx.fillRect(x, copingTop + 22, 14, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(0, copingTop, W, 2);
    ctx.fillStyle = vGradient(ctx, ROOF.edgeBottom, BASE_BOTTOM, [
      [0, 'rgba(20,10,0,0.4)'],
      [1, 'rgba(20,10,0,0)'],
    ]);
    ctx.fillRect(0, ROOF.edgeBottom, W, BASE_BOTTOM - ROOF.edgeBottom);
  });
}

export const TANK = { w: 110, h: 190, ox: 55, oy: 190 };

// A water tank on a steel frame. Origin: the middle of its feet.
export function waterTankTexture(scene: Phaser.Scene): string {
  return paintTexture(scene, 'roof-tank', TANK.w, TANK.h, (ctx) => {
    ctx.translate(TANK.ox, TANK.oy);
    floorShadow(ctx, 6, -2, 52, 9, 0.4);
    // Frame: legs and cross braces.
    ctx.strokeStyle = '#4a4f55';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-40, 0);
    ctx.lineTo(-34, -90);
    ctx.moveTo(40, 0);
    ctx.lineTo(34, -90);
    ctx.moveTo(-14, 2);
    ctx.lineTo(-12, -90);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-38, -10);
    ctx.lineTo(36, -80);
    ctx.moveTo(38, -10);
    ctx.lineTo(-36, -80);
    ctx.stroke();
    // Barrel with hoops.
    ctx.fillStyle = hGradient(ctx, -46, 46, [
      [0, '#7a5430'],
      [0.35, '#c08a52'],
      [0.7, '#9a6a3a'],
      [1, '#5e3f22'],
    ]);
    roundRect(ctx, -46, -170, 92, 84, 10);
    ctx.fill();
    ctx.fillStyle = 'rgba(60,40,20,0.35)';
    for (let x = -34; x < 46; x += 17) ctx.fillRect(x, -168, 1.5, 80);
    ctx.fillStyle = '#3c4249';
    ctx.fillRect(-47, -156, 94, 6);
    ctx.fillRect(-47, -112, 94, 6);
    ctx.fillStyle = hGradient(ctx, -46, 46, [
      [0, '#4a2f1a'],
      [0.4, '#8a5a30'],
      [1, '#3a2312'],
    ]);
    ctx.beginPath();
    ctx.moveTo(-50, -168);
    ctx.lineTo(0, -194 + 14);
    ctx.lineTo(50, -168);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3c4249';
    ctx.fillRect(-4, -190 + 12, 8, 14);
    // Pipe down the side.
    ctx.strokeStyle = '#5a6068';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(32, -86);
    ctx.lineTo(32, -4);
    ctx.stroke();
  });
}

export const AC = { w: 150, h: 84, ox: 75, oy: 82 };

// Two air-conditioning units with fans. Origin: the middle of their base.
export function airConditionersTexture(scene: Phaser.Scene): string {
  return paintTexture(scene, 'roof-ac', AC.w, AC.h, (ctx) => {
    ctx.translate(AC.ox, AC.oy);
    floorShadow(ctx, 4, 0, 72, 8, 0.4);
    [
      [-38, 62, 52],
      [34, 52, 40],
    ].forEach(([cx, w, h]) => {
      ctx.fillStyle = vGradient(ctx, -h, 0, [
        [0, '#e8ebee'],
        [1, '#aab0b7'],
      ]);
      roundRect(ctx, cx - w / 2, -h, w, h - 4, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#6b7178';
      ctx.fillRect(cx - w / 2 + 3, -4, 8, 4);
      ctx.fillRect(cx + w / 2 - 11, -4, 8, 4);
      // Fan grille.
      const r = Math.min(w, h) * 0.34;
      ctx.fillStyle = '#4a4f55';
      ctx.beginPath();
      ctx.arc(cx, -h / 2 - 2, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#9aa1a9';
      ctx.lineWidth = 1.2;
      for (let k = 1; k <= 3; k++) {
        ctx.beginPath();
        ctx.arc(cx, -h / 2 - 2, (r * k) / 3.2, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(cx - r, -h / 2 - 2);
      ctx.lineTo(cx + r, -h / 2 - 2);
      ctx.moveTo(cx, -h / 2 - 2 - r);
      ctx.lineTo(cx, -h / 2 - 2 + r);
      ctx.stroke();
    });
    // Pipes between them.
    ctx.strokeStyle = '#d7d2c8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-6, -14);
    ctx.quadraticCurveTo(0, -4, 10, -14);
    ctx.stroke();
  });
}

// --- Closed terrace -----------------------------------------------------------------------

export const BANNER = { w: 380, h: 250, ox: 190, oy: 240 };

// A tarpaulin banner on two poles with a parasol and a padlock, under building-site tape. Origin:
// the middle between the pole feet.
export function roofBannerTexture(scene: Phaser.Scene, theme: CityTheme): string {
  return paintTexture(scene, `roof-banner-${theme.accent.toString(16)}`, BANNER.w, BANNER.h, (ctx) => {
    ctx.translate(BANNER.ox, BANNER.oy);
    floorShadow(ctx, 0, 0, 170, 12, 0.35);
    // Poles with concrete feet.
    [-160, 160].forEach((x) => {
      ctx.fillStyle = vGradient(ctx, -14, 0, [
        [0, '#cfcac0'],
        [1, '#8f8a81'],
      ]);
      roundRect(ctx, x - 20, -14, 40, 14, 3);
      ctx.fill();
      ctx.fillStyle = hGradient(ctx, x - 4, x + 4, [
        [0, '#4a5057'],
        [0.5, '#b9c0c7'],
        [1, '#3e444a'],
      ]);
      ctx.fillRect(x - 4, -220, 8, 208);
    });
    // The tarp, sagging slightly at the bottom.
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    roundRect(ctx, -152, -204, 312, 160, 8);
    ctx.fill();
    ctx.fillStyle = vGradient(ctx, -212, -52, [
      [0, '#6f8da4'],
      [1, '#4c6a80'],
    ]);
    ctx.beginPath();
    ctx.moveTo(-160, -212);
    ctx.lineTo(160, -212);
    ctx.lineTo(160, -66);
    ctx.quadraticCurveTo(0, -42, -160, -66);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(-150 + k * 100, -212);
      ctx.quadraticCurveTo(-140 + k * 100, -140, -150 + k * 100 + 8, -62);
      ctx.stroke();
    }
    // Grommets.
    ctx.fillStyle = '#d9dde0';
    [-150, -50, 50, 150].forEach((x) => {
      ctx.beginPath();
      ctx.arc(x, -206, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    // A painted parasol over a little table, and a padlock beside it.
    ctx.save();
    ctx.translate(-40, -52);
    ctx.fillStyle = css(theme.accent, 0.05);
    ctx.beginPath();
    ctx.moveTo(-62, -92);
    ctx.quadraticCurveTo(0, -176, 62, -92);
    ctx.quadraticCurveTo(46, -80, 31, -92);
    ctx.quadraticCurveTo(15, -80, 0, -92);
    ctx.quadraticCurveTo(-15, -80, -31, -92);
    ctx.quadraticCurveTo(-46, -80, -62, -92);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, -140);
    ctx.lineTo(0, -4);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-34, -34, 68, 6);
    ctx.fillRect(-3, -28, 6, 28);
    ctx.fillRect(-18, -4, 36, 5);
    ctx.restore();
    ctx.save();
    ctx.translate(92, -108);
    ctx.fillStyle = '#f4b400';
    roundRect(ctx, -22, -4, 44, 38, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(80,50,0,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#d6dadd';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(0, -4, 13, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#5a3a00';
    ctx.beginPath();
    ctx.arc(0, 12, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-2, 12, 4, 12);
    ctx.restore();
    // Hazard tape across the poles.
    ctx.save();
    ctx.translate(0, -172);
    ctx.rotate(-0.025);
    ctx.fillStyle = '#f2c230';
    ctx.fillRect(-190, -9, 380, 18);
    ctx.beginPath();
    ctx.rect(-190, -9, 380, 18);
    ctx.clip();
    ctx.fillStyle = '#2a2a2a';
    for (let x = -210; x < 210; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 9);
      ctx.lineTo(x + 9, -9);
      ctx.lineTo(x + 20, -9);
      ctx.lineTo(x + 11, 9);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  });
}

// Mesh fence panels on concrete feet along the front edge. Origin: the base line, left edge.
export const FENCE = { h: 100 };
export function roofFenceTexture(scene: Phaser.Scene): string {
  return paintTexture(scene, 'roof-fence', W, FENCE.h + 14, (ctx) => {
    const base = FENCE.h + 4;
    for (let x = 6; x < W; x += 118) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ellipse(ctx, x + 59, base + 3, 64, 6);
      ctx.fill();
      ctx.strokeStyle = '#b9bec4';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 2, base - 84, 114, 78);
      ctx.strokeStyle = 'rgba(200,205,210,0.55)';
      ctx.lineWidth = 1;
      for (let gx = x + 10; gx < x + 116; gx += 10) {
        ctx.beginPath();
        ctx.moveTo(gx, base - 84);
        ctx.lineTo(gx, base - 6);
        ctx.stroke();
      }
      for (let gy = base - 74; gy < base - 6; gy += 10) {
        ctx.beginPath();
        ctx.moveTo(x + 2, gy);
        ctx.lineTo(x + 116, gy);
        ctx.stroke();
      }
      ctx.fillStyle = vGradient(ctx, base - 10, base + 2, [
        [0, '#cfcac0'],
        [1, '#8f8a81'],
      ]);
      roundRect(ctx, x - 8, base - 10, 22, 12, 3);
      ctx.fill();
    }
  });
}

// --- Open terrace -------------------------------------------------------------------------

// The wooden deck over the roof membrane. World y from ROOF.deckTop + 6 to ROOF.deckBottom - 4.
export const DECK = { top: ROOF.deckTop + 6, bottom: ROOF.deckBottom - 2 };
export function deckTexture(scene: Phaser.Scene): string {
  return paintTexture(scene, 'roof-deck', W, DECK.bottom - DECK.top, (ctx) => {
    ctx.translate(0, -DECK.top);
    const random = seeded(77);
    const plank = 26;
    for (let y = DECK.top, row = 0; y < DECK.bottom; y += plank, row++) {
      // Planks run along the width; each row is joined at its own places.
      let x = -((row * 137) % 220);
      while (x < W) {
        const len = 160 + random() * 140;
        const tone = random();
        const base = tone < 0.33 ? 0xb88652 : tone < 0.66 ? 0xc79560 : 0xad7d4a;
        ctx.fillStyle = vGradient(ctx, y, y + plank, [
          [0, css(base, 0.12)],
          [1, css(base, -0.12)],
        ]);
        ctx.fillRect(x, y, len, plank - 1);
        ctx.fillStyle = 'rgba(70,40,15,0.12)';
        for (let g = 0; g < 3; g++) ctx.fillRect(x + random() * len, y + 4 + random() * (plank - 10), 20 + random() * 60, 1);
        ctx.fillStyle = 'rgba(40,20,5,0.5)';
        ctx.fillRect(x + len - 1, y, 1.5, plank - 1);
        x += len;
      }
      ctx.fillStyle = 'rgba(30,15,5,0.35)';
      ctx.fillRect(0, y + plank - 1, W, 1.5);
    }
    // Shade under the back parapet and light along the front.
    ctx.fillStyle = vGradient(ctx, DECK.top, DECK.top + 50, [
      [0, 'rgba(30,15,5,0.4)'],
      [1, 'rgba(30,15,5,0)'],
    ]);
    ctx.fillRect(0, DECK.top, W, 50);
    ctx.fillStyle = vGradient(ctx, DECK.bottom - 40, DECK.bottom, [
      [0, 'rgba(255,230,180,0)'],
      [1, 'rgba(255,230,180,0.18)'],
    ]);
    ctx.fillRect(0, DECK.bottom - 40, W, 40);
  });
}

export const RAIL = { h: 112 };

// A glass railing with steel posts and a handrail. Origin: the base line, left edge.
export function glassRailTexture(scene: Phaser.Scene): string {
  return paintTexture(scene, 'roof-rail', W, RAIL.h + 10, (ctx) => {
    const base = RAIL.h;
    const top = base - 70;
    for (let x = 0; x < W; x += 180) {
      // A glass panel between two posts.
      ctx.fillStyle = hGradient(ctx, x, x + 180, [
        [0, 'rgba(190,225,240,0.28)'],
        [0.3, 'rgba(235,248,255,0.45)'],
        [0.4, 'rgba(190,225,240,0.2)'],
        [1, 'rgba(160,205,225,0.3)'],
      ]);
      ctx.fillRect(x + 6, top + 6, 168, base - top - 14);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(x + 30, top + 6);
      ctx.lineTo(x + 52, top + 6);
      ctx.lineTo(x + 20, base - 8);
      ctx.lineTo(x + 8, base - 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 6, top + 6, 168, base - top - 14);
    }
    for (let x = 0; x <= W; x += 180) {
      ctx.fillStyle = hGradient(ctx, x - 5, x + 5, [
        [0, '#5c636b'],
        [0.5, '#d4dade'],
        [1, '#4a5057'],
      ]);
      roundRect(ctx, x - 5, top - 2, 10, base - top + 6, 3);
      ctx.fill();
    }
    // Handrail and the shadow the posts throw.
    ctx.fillStyle = vGradient(ctx, top - 6, top + 4, [
      [0, '#e6eaed'],
      [1, '#7e868d'],
    ]);
    roundRect(ctx, 0, top - 6, W, 10, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(0, base + 2, W, 4);
  });
}

export const LIGHTS = { top: ROOF.deckTop - 160, bottom: ROOF.deckTop + 8 };

// Posts across the back of the deck with strings of warm bulbs. World y from LIGHTS.top.
export function stringLightsTexture(scene: Phaser.Scene, glow: boolean): string {
  return paintTexture(scene, glow ? 'roof-lights-glow' : 'roof-lights', W, LIGHTS.bottom - LIGHTS.top + 40, (ctx) => {
    ctx.translate(0, -LIGHTS.top);
    const posts = [24, 540, 1056];
    const topY = LIGHTS.top + 20;
    if (!glow) {
      posts.forEach((x) => {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ellipse(ctx, x + 4, LIGHTS.bottom, 16, 4);
        ctx.fill();
        ctx.fillStyle = hGradient(ctx, x - 5, x + 5, [
          [0, '#4a2f1a'],
          [0.5, '#9a6a3c'],
          [1, '#3a2312'],
        ]);
        ctx.fillRect(x - 5, topY, 10, LIGHTS.bottom - topY);
        ctx.fillStyle = '#2a2018';
        ctx.fillRect(x - 8, topY - 4, 16, 6);
      });
    }
    // Two strings between the posts, each hanging in a curve.
    const strings: [number, number, number][] = [
      [posts[0], posts[1], 34],
      [posts[1], posts[2], 34],
    ];
    strings.forEach(([x0, x1, sag], s) => {
      const bulbs = 15;
      if (!glow) {
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(x0, topY);
        ctx.quadraticCurveTo((x0 + x1) / 2, topY + sag * 2, x1, topY);
        ctx.stroke();
      }
      for (let i = 1; i < bulbs; i++) {
        const t = i / bulbs;
        const x = x0 + (x1 - x0) * t;
        const y = topY + sag * 2 * t * (1 - t) * 2 + (s === 0 ? 0 : 0);
        if (glow) {
          ctx.fillStyle = radial(ctx, x, y + 8, 0, 34, [
            [0, rgba(WARM, 0.75)],
            [1, rgba(WARM, 0)],
          ]);
          ctx.fillRect(x - 34, y - 26, 68, 68);
        } else {
          ctx.fillStyle = '#2a2a2a';
          ctx.fillRect(x - 2, y, 4, 4);
          ctx.fillStyle = '#fff3c4';
          ctx.beginPath();
          ctx.ellipse(x, y + 9, 4.5, 6, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });
  });
}

// Outdoor table: a round bistro top with a cloth border, no drape. Origin: the middle of the top (80, 46).
export function terraceTableTexture(scene: Phaser.Scene, theme: CityTheme): string {
  return paintTexture(scene, `terrace-table-${theme.accent.toString(16)}`, 160, 100, (ctx) => {
    ctx.translate(80, 46);
    floorShadow(ctx, 6, 46, 50, 8, 0.4);
    // Iron pedestal.
    ctx.fillStyle = hGradient(ctx, -7, 7, [
      [0, '#22262a'],
      [0.45, '#5b636b'],
      [1, '#1c1f23'],
    ]);
    ctx.fillRect(-5, 10, 10, 34);
    ctx.fillStyle = '#2a2e33';
    ellipse(ctx, 0, 44, 30, 6);
    ctx.fill();
    ctx.fillStyle = '#3a3f45';
    ellipse(ctx, 0, 44, 22, 4);
    ctx.fill();
    // Round top.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ellipse(ctx, 2, 10, 66, 18);
    ctx.fill();
    ctx.fillStyle = vGradient(ctx, -10, 12, [
      [0, '#6a4a2c'],
      [1, '#3a2514'],
    ]);
    ellipse(ctx, 0, 4, 66, 18);
    ctx.fill();
    ctx.fillStyle = vGradient(ctx, -16, 6, [
      [0, '#fffdf6'],
      [1, css(0xfff8ec, -0.1)],
    ]);
    ellipse(ctx, 0, -2, 62, 16);
    ctx.fill();
    ctx.strokeStyle = css(theme.accent, 0, 0.9);
    ctx.lineWidth = 4;
    ellipse(ctx, 0, -2, 56, 13);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ellipse(ctx, -22, -9, 18, 3);
    ctx.fill();
    // Parasol pole going up through the middle, and a candle jar.
    ctx.fillStyle = '#7a4f2a';
    ctx.fillRect(-2.5, -6, 5, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ellipse(ctx, 26, -4, 8, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,210,230,0.75)';
    roundRect(ctx, 21, -18, 10, 13, 3);
    ctx.fill();
    ctx.fillStyle = '#ffd34d';
    ellipse(ctx, 26, -13, 2.5, 4);
    ctx.fill();
  });
}

// Bistro chair with a rounded wrought-iron back. Origin: the floor under the middle of the seat (32, 80).
export function terraceChairTexture(scene: Phaser.Scene, theme: CityTheme): string {
  return paintTexture(scene, `terrace-chair-${theme.accent.toString(16)}`, 64, 92, (ctx) => {
    ctx.translate(32, 80);
    const iron = (x0: number, x1: number) =>
      hGradient(ctx, x0, x1, [
        [0, '#1c1f23'],
        [0.45, '#586068'],
        [1, '#1c1f23'],
      ]);
    // Legs.
    ctx.fillStyle = iron(-22, -16);
    ctx.fillRect(-22, -26, 5, 26);
    ctx.fillRect(17, -26, 5, 26);
    // Curved back.
    ctx.strokeStyle = '#2f343a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-23, -24);
    ctx.lineTo(-23, -62);
    ctx.quadraticCurveTo(0, -84, 23, -62);
    ctx.lineTo(23, -24);
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#586068';
    ctx.beginPath();
    ctx.moveTo(-14, -34);
    ctx.quadraticCurveTo(-8, -52, 0, -36);
    ctx.quadraticCurveTo(8, -52, 14, -34);
    ctx.stroke();
    // Cushioned seat in the accent color.
    ctx.fillStyle = vGradient(ctx, -28, -12, [
      [0, css(theme.accent, 0.2)],
      [1, css(theme.accent, -0.15)],
    ]);
    ellipse(ctx, 0, -20, 28, 9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
}

export const PARASOL = { w: 190, h: 200, ox: 95, oy: 196 };

// A parasol in the city's accent color with scalloped edges. Origin: where the pole meets the
// table (the canopy is about 150 above it).
export function parasolTexture(scene: Phaser.Scene, theme: CityTheme): string {
  return paintTexture(scene, `terrace-parasol-${theme.accent.toString(16)}`, PARASOL.w, PARASOL.h, (ctx) => {
    ctx.translate(PARASOL.ox, PARASOL.oy);
    // Pole.
    ctx.fillStyle = hGradient(ctx, -3, 3, [
      [0, '#7a5a3a'],
      [0.5, '#d9b88a'],
      [1, '#6a4a2a'],
    ]);
    ctx.fillRect(-2.5, -150, 5, 148);
    // Canopy: a shallow dome with a scalloped edge, striped in two tones.
    const rx = 82;
    const edgeY = -124;
    const topY = -186;
    const shape = () => {
      ctx.beginPath();
      ctx.moveTo(-rx, edgeY);
      ctx.quadraticCurveTo(0, topY - 28, rx, edgeY);
      const scallops = 6;
      for (let i = 0; i < scallops; i++) {
        const x0 = rx - (i * 2 * rx) / scallops;
        const x1 = rx - ((i + 1) * 2 * rx) / scallops;
        ctx.quadraticCurveTo((x0 + x1) / 2, edgeY + 16, x1, edgeY);
      }
      ctx.closePath();
    };
    shape();
    ctx.fillStyle = css(theme.accent, 0.05);
    ctx.fill();
    ctx.save();
    shape();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,248,236,0.9)';
    for (let i = -3; i < 3; i += 2) {
      ctx.beginPath();
      ctx.moveTo(0, topY - 8);
      ctx.lineTo((i * rx) / 3, edgeY + 20);
      ctx.lineTo(((i + 1) * rx) / 3, edgeY + 20);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = vGradient(ctx, topY - 20, edgeY + 16, [
      [0, 'rgba(255,255,255,0.28)'],
      [0.5, 'rgba(255,255,255,0)'],
      [1, 'rgba(40,10,0,0.28)'],
    ]);
    ctx.fillRect(-rx, topY - 30, rx * 2, 80);
    ctx.restore();
    ctx.strokeStyle = 'rgba(60,25,10,0.35)';
    ctx.lineWidth = 1.5;
    shape();
    ctx.stroke();
    ctx.fillStyle = '#d9b88a';
    ctx.beginPath();
    ctx.arc(0, topY - 18, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

// A long wooden planter with shrubs and flowers. Origin: the middle of its base (60, 100).
export function terracePlanterTexture(scene: Phaser.Scene, theme: CityTheme): string {
  return paintTexture(scene, `terrace-planter-${theme.accent.toString(16)}`, 120, 112, (ctx) => {
    ctx.translate(60, 100);
    const random = seeded(theme.accent);
    floorShadow(ctx, 4, 0, 56, 8, 0.4);
    // Shrubs.
    for (let i = 0; i < 16; i++) {
      const x = -42 + random() * 84;
      const r = 14 + random() * 14;
      const y = -52 - random() * 28;
      ctx.fillStyle = radial(ctx, x - 4, y - 4, 1, r, [
        [0, '#7fcf5d'],
        [1, '#2e6a28'],
      ]);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 9; i++) {
      const x = -44 + random() * 88;
      const y = -52 - random() * 44;
      ctx.fillStyle = i % 2 === 0 ? css(theme.accent, 0.2) : '#ffd34d';
      ctx.beginPath();
      ctx.arc(x, y, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(x - 1.5, y - 1.5, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Box.
    ctx.fillStyle = vGradient(ctx, -52, 0, [
      [0, '#a8743f'],
      [1, '#5e3b1d'],
    ]);
    roundRect(ctx, -52, -52, 104, 52, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,20,5,0.35)';
    ctx.lineWidth = 1.5;
    for (let x = -26; x < 52; x += 26) {
      ctx.beginPath();
      ctx.moveTo(x, -50);
      ctx.lineTo(x, -2);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,230,190,0.3)';
    ctx.fillRect(-50, -50, 100, 3);
  });
}

export const BAR = { w: 250, h: 230, ox: 125, oy: 214 };

// The roof bar: a counter with a stone top, a shelf of bottles behind it and a string of bulbs
// under a little canopy. Origin: the middle of the counter's foot line.
export function roofBarTexture(scene: Phaser.Scene, theme: CityTheme): string {
  return paintTexture(scene, `roof-bar-${theme.accent.toString(16)}`, BAR.w, BAR.h, (ctx) => {
    ctx.translate(BAR.ox, BAR.oy);
    floorShadow(ctx, 6, 0, 112, 12, 0.4);
    // Back shelves with bottles (the bartender stands in front of them).
    ctx.fillStyle = vGradient(ctx, -200, -60, [
      [0, '#3a2a20'],
      [1, '#5a4030'],
    ]);
    roundRect(ctx, -104, -200, 208, 150, 6);
    ctx.fill();
    const colors = ['#2f8f55', '#c9a227', '#b5412c', '#d9d2c0', '#3f6fb0', '#7a4ca0'];
    [-168, -128, -88].forEach((shelfY, row) => {
      ctx.fillStyle = '#8a6240';
      ctx.fillRect(-100, shelfY + 24, 200, 5);
      for (let i = 0; i < 9; i++) {
        const x = -90 + i * 22;
        const h = 22 + ((i * 7 + row * 5) % 12);
        ctx.fillStyle = colors[(i + row * 2) % colors.length];
        roundRect(ctx, x - 5, shelfY + 24 - h, 10, h, 3);
        ctx.fill();
        ctx.fillRect(x - 2, shelfY + 24 - h - 8, 4, 9);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(x - 3, shelfY + 24 - h + 4, 2, h - 8);
      }
    });
    // Canopy on two posts.
    ctx.fillStyle = css(theme.accent, 0.05);
    ctx.beginPath();
    ctx.moveTo(-122, -190);
    ctx.lineTo(122, -190);
    ctx.lineTo(112, -214);
    ctx.lineTo(-112, -214);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = css(theme.accent, -0.15);
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.moveTo(-122 + i * 20.4, -190);
      ctx.lineTo(-122 + i * 20.4 + 20.4, -190);
      ctx.lineTo(-122 + i * 20.4 + 10.2, -178);
      ctx.closePath();
      ctx.fill();
    }
    // Counter: stone top over a paneled front.
    ctx.fillStyle = vGradient(ctx, -62, 0, [
      [0, css(theme.accent, -0.28)],
      [1, css(theme.accent, -0.5)],
    ]);
    roundRect(ctx, -112, -62, 224, 62, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    for (let x = -100; x < 112; x += 54) ctx.strokeRect(x, -50, 46, 38);
    ctx.fillStyle = vGradient(ctx, -74, -58, [
      [0, '#f1ece2'],
      [1, '#b8b0a2'],
    ]);
    roundRect(ctx, -120, -74, 240, 16, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(-112, -73, 224, 2);
    // Glasses on the counter.
    [-70, -50, 62].forEach((x) => {
      ctx.fillStyle = 'rgba(190,225,240,0.85)';
      ctx.beginPath();
      ctx.moveTo(x - 6, -96);
      ctx.lineTo(x + 6, -96);
      ctx.lineTo(x + 4, -74);
      ctx.lineTo(x - 4, -74);
      ctx.closePath();
      ctx.fill();
    });
    // Bulbs under the canopy.
    for (let i = 0; i < 8; i++) {
      const x = -96 + i * 27;
      ctx.fillStyle = radial(ctx, x, -166, 0, 22, [
        [0, rgba(WARM, 0.7)],
        [1, rgba(WARM, 0)],
      ]);
      ctx.fillRect(x - 22, -190, 44, 44);
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.arc(x, -170, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// A bar stool. Origin: the foot (22, 80).
export function barStoolTexture(scene: Phaser.Scene, theme: CityTheme): string {
  return paintTexture(scene, `roof-stool-${theme.accent.toString(16)}`, 44, 84, (ctx) => {
    ctx.translate(22, 80);
    floorShadow(ctx, 2, 0, 18, 4, 0.4);
    ctx.strokeStyle = '#2f343a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-12, -48);
    ctx.lineTo(-16, 0);
    ctx.moveTo(12, -48);
    ctx.lineTo(16, 0);
    ctx.moveTo(-14, -22);
    ctx.lineTo(14, -22);
    ctx.stroke();
    ctx.fillStyle = vGradient(ctx, -64, -44, [
      [0, css(theme.accent, 0.2)],
      [1, css(theme.accent, -0.2)],
    ]);
    ellipse(ctx, 0, -52, 20, 8);
    ctx.fill();
    ctx.fillRect(-20, -52, 40, 8);
    ellipse(ctx, 0, -44, 20, 6);
    ctx.fill();
    ctx.fillStyle = css(theme.accent, 0.3);
    ellipse(ctx, 0, -52, 20, 7);
    ctx.fill();
  });
}

// --- Stairs ---------------------------------------------------------------------------------

export const HATCH = { w: 220, h: 230, ox: 110, oy: 222 };

// The stair head on the roof: a small stairwell house with a flat roof, an open doorway with
// steps going down, a railing on each side and the same sign as the door below.
// Origin: the middle of its foot line.
export function stairHeadTexture(scene: Phaser.Scene, theme: CityTheme): string {
  return paintTexture(scene, `roof-hatch-${themeKey(theme)}`, HATCH.w, HATCH.h, (ctx) => {
    ctx.translate(HATCH.ox, HATCH.oy);
    floorShadow(ctx, 8, 2, 100, 12, 0.4);
    // Side railings.
    [-1, 1].forEach((side) => {
      ctx.strokeStyle = '#d4dade';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(side * 74, -56);
      ctx.lineTo(side * 104, -56);
      ctx.moveTo(side * 98, -56);
      ctx.lineTo(side * 98, 0);
      ctx.moveTo(side * 74, -28);
      ctx.lineTo(side * 98, -28);
      ctx.stroke();
    });
    // The house.
    ctx.fillStyle = vGradient(ctx, -150, 0, [
      [0, css(theme.wall, -0.02)],
      [1, css(theme.wall, -0.24)],
    ]);
    ctx.fillRect(-76, -150, 152, 150);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(56, -150, 20, 150);
    // Flat roof with an overhang.
    ctx.fillStyle = vGradient(ctx, -178, -148, [
      [0, '#f1ece2'],
      [1, '#b4ad9f'],
    ]);
    roundRect(ctx, -92, -178, 184, 30, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(-92, -150, 184, 4);
    // The doorway: warm light inside and steps going down.
    const dx = -34;
    const dw = 68;
    ctx.fillStyle = css(theme.floorDark, -0.2);
    roundRect(ctx, dx - 7, -128, dw + 14, 134, [dw / 2 + 7, dw / 2 + 7, 0, 0]);
    ctx.fill();
    ctx.save();
    roundRect(ctx, dx, -121, dw, 121, [dw / 2, dw / 2, 0, 0]);
    ctx.clip();
    ctx.fillStyle = vGradient(ctx, -121, 0, [
      [0, '#3a2a22'],
      [1, '#7a5238'],
    ]);
    ctx.fillRect(dx, -121, dw, 121);
    ctx.fillStyle = radial(ctx, 0, -20, 0, 70, [
      [0, rgba(WARM, 0.8)],
      [1, rgba(WARM, 0)],
    ]);
    ctx.fillRect(dx, -121, dw, 121);
    // Steps descending into the building, the lowest ones in front.
    for (let i = 0; i < 4; i++) {
      const y = -4 - i * 15;
      const inset = i * 5;
      ctx.fillStyle = css(0xd9c3a0, -0.06 * i);
      ctx.fillRect(dx + inset, y - 7, dw - inset * 2, 8);
      ctx.fillStyle = css(0xa88a64, -0.1 * i);
      ctx.fillRect(dx + inset, y + 1, dw - inset * 2, 7);
    }
    ctx.restore();
    // Sign above the door: a sun on a plaque.
    paintSign(ctx, 0, -146, 0.62);
  });
}

// A round plaque with an up arrow and a parasol: the stairs to the terrace. Centered on (x, y).
function paintSign(ctx: Ctx, x: number, y: number, scale: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.arc(2, 4, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = radial(ctx, -8, -10, 2, 36, [
    [0, '#ffe08a'],
    [1, '#e8a317'],
  ]);
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.stroke();
  // Parasol.
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(-18, -2);
  ctx.quadraticCurveTo(0, -30, 18, -2);
  ctx.quadraticCurveTo(9, 3, 0, -2);
  ctx.quadraticCurveTo(-9, 3, -18, -2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#5a3218';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.lineTo(0, 14);
  ctx.stroke();
  // Up arrow below it.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.lineTo(10, 20);
  ctx.lineTo(4, 20);
  ctx.lineTo(4, 27);
  ctx.lineTo(-4, 27);
  ctx.lineTo(-4, 20);
  ctx.lineTo(-10, 20);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export const STAIR_DOOR_ART = { w: 270, top: STAIR_DOOR.top - 62 };

// The stairwell in the room's back wall, over the city poster: a wooden door surround, an arched
// opening with the first steps going up into light, and the stairs sign above. Texture y starts
// at STAIR_DOOR_ART.top and runs down to the floor line; the origin is the middle of the width.
export function stairDoorTexture(scene: Phaser.Scene, theme: CityTheme): string {
  const height = STAIR_DOOR.bottom - STAIR_DOOR_ART.top + 6;
  return paintTexture(scene, `stair-door-${themeKey(theme)}`, STAIR_DOOR_ART.w, height, (ctx) => {
    const cx = STAIR_DOOR_ART.w / 2;
    ctx.translate(cx, -STAIR_DOOR_ART.top);
    const half = STAIR_DOOR.width / 2;
    const archTop = STAIR_DOOR.top;
    const bottom = STAIR_DOOR.bottom;
    const outer = half + 34;
    // Surround: stone-like panel with a drop shadow on the wall.
    ctx.fillStyle = 'rgba(30,15,5,0.28)';
    roundRect(ctx, -outer + 5, STAIR_DOOR_ART.top + 8, outer * 2 + 4, bottom - STAIR_DOOR_ART.top - 2, 10);
    ctx.fill();
    ctx.fillStyle = hGradient(ctx, -outer, outer, [
      [0, css(theme.floorDark, 0.1)],
      [0.5, css(theme.floorDark, 0.28)],
      [1, css(theme.floorDark, -0.12)],
    ]);
    roundRect(ctx, -outer, STAIR_DOOR_ART.top, outer * 2, bottom - STAIR_DOOR_ART.top, [12, 12, 0, 0]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,190,0.35)';
    ctx.lineWidth = 2;
    roundRect(ctx, -outer + 3, STAIR_DOOR_ART.top + 3, outer * 2 - 6, bottom - STAIR_DOOR_ART.top - 3, [10, 10, 0, 0]);
    ctx.stroke();
    // Inner molding around the opening.
    ctx.fillStyle = css(theme.floorDark, -0.3);
    roundRect(ctx, -half - 9, archTop - 9, half * 2 + 18, bottom - archTop + 9, [half + 9, half + 9, 0, 0]);
    ctx.fill();

    // The opening, clipped to its arch.
    ctx.save();
    roundRect(ctx, -half, archTop, half * 2, bottom - archTop, [half, half, 0, 0]);
    ctx.clip();
    ctx.fillStyle = vGradient(ctx, archTop, bottom, [
      [0, '#fff0c8'],
      [0.35, '#d9a86c'],
      [1, '#4a3022'],
    ]);
    ctx.fillRect(-half, archTop, half * 2, bottom - archTop);
    // Daylight spilling from the roof at the top of the stairs.
    ctx.fillStyle = radial(ctx, 0, archTop + 30, 0, 120, [
      [0, 'rgba(255,255,235,0.95)'],
      [1, 'rgba(255,240,200,0)'],
    ]);
    ctx.fillRect(-half, archTop, half * 2, 160);
    // Steps climbing away from the viewer: each one narrower and farther up.
    const steps = 7;
    const first = bottom - 6;
    for (let i = 0; i < steps; i++) {
      const rise = 25 - i * 1.6;
      const y = first - i * rise;
      const inset = i * 9;
      const light = i * 0.07;
      ctx.fillStyle = css(0xd9c3a0, -0.12 + light);
      ctx.fillRect(-half + inset, y - rise + 5, half * 2 - inset * 2, rise - 5);
      ctx.fillStyle = css(0xe9d7b4, -0.02 + light * 0.5);
      ctx.fillRect(-half + inset, y - rise, half * 2 - inset * 2, 6);
      ctx.fillStyle = 'rgba(40,20,5,0.25)';
      ctx.fillRect(-half + inset, y - rise + 6, half * 2 - inset * 2, 2);
    }
    // Side walls darken toward the front.
    ctx.fillStyle = hGradient(ctx, -half, half, [
      [0, 'rgba(30,15,5,0.45)'],
      [0.2, 'rgba(30,15,5,0)'],
      [0.8, 'rgba(30,15,5,0)'],
      [1, 'rgba(30,15,5,0.45)'],
    ]);
    ctx.fillRect(-half, archTop, half * 2, bottom - archTop);
    // Handrail on the right, rising with the steps.
    ctx.strokeStyle = '#2f343a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(half - 8, bottom - 50);
    ctx.lineTo(half - 8 - 64, archTop + 100);
    ctx.stroke();
    ctx.restore();
    // Sill in front of the first step.
    ctx.fillStyle = vGradient(ctx, bottom - 8, bottom, [
      [0, css(theme.floorDark, 0.2)],
      [1, css(theme.floorDark, -0.3)],
    ]);
    ctx.fillRect(-half - 9, bottom - 8, half * 2 + 18, 8);
    // Sign in the band above the arch.
    paintSign(ctx, 0, archTop - 40, 0.95);
  });
}

// A soft light pool on the deck in front of the stair head and the bar, drawn under people.
export function lightPoolTexture(scene: Phaser.Scene): string {
  return paintTexture(scene, 'roof-light-pool', 200, 60, (ctx) => {
    ctx.fillStyle = radial(ctx, 100, 30, 0, 100, [
      [0, rgba(WARM, 0.4)],
      [1, rgba(WARM, 0)],
    ]);
    ellipse(ctx, 100, 30, 100, 30);
    ctx.fill();
  });
}

