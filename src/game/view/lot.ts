import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { CROSSWALK, DRIVEWAYS, LOT, LOT_SLOTS } from './layout';
import { type Ctx, css, ellipse, floorShadow, hGradient, paintTexture, radial, roundRect, seeded, vGradient } from './paint';
import type { StreetTheme } from './streetThemes';

// Art of the parking lot across the street (see ParkingLot for the cars and people):
// - the ground: asphalt, the aisle with one-way arrows, the slot lines and wheel stops;
// - before the lot is bought, a fenced plot of gravel over it;
// - furniture: the P sign, cones on slots that are not open yet, the valet stand, and a low wall
//   with shrubs along the front edge.

const SLOT_WIDTH = LOT_SLOTS[1] - LOT_SLOTS[0];
// Lines run toward this point, like the pavement joints.
const VANISH = { x: GAME_WIDTH / 2, y: -700 };
export const WALL_TOP = LOT.slotBottom + 36;

function perspectiveX(x0: number, y0: number, y: number): number {
  return VANISH.x + ((x0 - VANISH.x) * (y - VANISH.y)) / (y0 - VANISH.y);
}

// direction: the way cars drive along the aisle (+1 to the right).
export function lotGroundTexture(scene: Phaser.Scene, direction: 1 | -1): string {
  return paintTexture(scene, `lot-ground-${direction}`, GAME_WIDTH, LOT.bottom - LOT.top, (ctx) => {
    ctx.translate(0, -LOT.top);
    paintAsphalt(ctx);
    paintMarkings(ctx, direction);
  });
}

function paintAsphalt(ctx: Ctx): void {
  const random = seeded(23);
  ctx.fillStyle = vGradient(ctx, LOT.top, LOT.bottom, [
    [0, '#55575b'],
    [0.5, '#5d5f63'],
    [1, '#505256'],
  ]);
  ctx.fillRect(0, LOT.top, GAME_WIDTH, LOT.bottom - LOT.top);
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = random() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)';
    ctx.fillRect(random() * GAME_WIDTH, LOT.top + random() * (LOT.bottom - LOT.top), 1.5 + random() * 1.5, 1.2);
  }
  // Oil stains where cars stand.
  LOT_SLOTS.forEach((x) => {
    ctx.save();
    ctx.translate(x + (random() - 0.5) * 30, LOT.slot - 40);
    ctx.scale(1, 0.4);
    const r = 34 + random() * 20;
    ctx.fillStyle = radial(ctx, 0, 0, 0, r, [
      [0, 'rgba(15,15,18,0.2)'],
      [1, 'rgba(15,15,18,0)'],
    ]);
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  });
  // A concrete edge along the far pavement, and a gutter in front of it.
  ctx.fillStyle = vGradient(ctx, LOT.top, LOT.top + 12, [
    [0, '#d8d4cb'],
    [1, '#b2aea5'],
  ]);
  [
    [DRIVEWAYS.left.to, DRIVEWAYS.right.from],
    [-10, DRIVEWAYS.left.from],
    [DRIVEWAYS.right.to, GAME_WIDTH + 10],
  ].forEach(([a, b]) => ctx.fillRect(a, LOT.top, b - a, 12));
  ctx.fillStyle = vGradient(ctx, LOT.top + 12, LOT.top + 26, [
    [0, 'rgba(0,0,0,0.3)'],
    [1, 'rgba(0,0,0,0)'],
  ]);
  ctx.fillRect(0, LOT.top + 12, GAME_WIDTH, 14);
  // Grass verge at the front.
  ctx.fillStyle = vGradient(ctx, WALL_TOP + 20, LOT.bottom, [
    [0, '#5f8f45'],
    [1, '#4a7a36'],
  ]);
  ctx.fillRect(0, WALL_TOP + 20, GAME_WIDTH, LOT.bottom - WALL_TOP - 20);
}

function paintMarkings(ctx: Ctx, direction: 1 | -1): void {
  const random = seeded(31);
  const paint = (draw: () => void) => {
    ctx.fillStyle = 'rgba(245,245,238,0.9)';
    draw();
  };
  // Slot lines between and at both ends of the row.
  for (let i = 0; i <= LOT_SLOTS.length; i++) {
    const x0 = LOT_SLOTS[0] - SLOT_WIDTH / 2 + i * SLOT_WIDTH;
    paint(() => {
      ctx.beginPath();
      ctx.moveTo(perspectiveX(x0 - 3, LOT.slotTop, LOT.slotTop), LOT.slotTop);
      ctx.lineTo(perspectiveX(x0 + 3, LOT.slotTop, LOT.slotTop), LOT.slotTop);
      ctx.lineTo(perspectiveX(x0 + 3, LOT.slotTop, LOT.slotBottom), LOT.slotBottom);
      ctx.lineTo(perspectiveX(x0 - 3, LOT.slotTop, LOT.slotBottom), LOT.slotBottom);
      ctx.closePath();
      ctx.fill();
    });
  }
  // The line that closes the row toward the aisle.
  paint(() => ctx.fillRect(LOT_SLOTS[0] - SLOT_WIDTH / 2 - 3, LOT.slotTop - 3, SLOT_WIDTH * LOT_SLOTS.length + 6, 5));
  // Wheel stops.
  LOT_SLOTS.forEach((x) => {
    const y = LOT.slotBottom - 8;
    floorShadow(ctx, x, y + 6, 46, 5, 0.3);
    ctx.fillStyle = vGradient(ctx, y - 6, y + 6, [
      [0, '#e6e2d8'],
      [1, '#a8a49b'],
    ]);
    roundRect(ctx, x - 42, y - 6, 84, 12, 5);
    ctx.fill();
    ctx.fillStyle = '#e8b730';
    ctx.fillRect(x - 30, y - 5, 12, 4);
    ctx.fillRect(x + 18, y - 5, 12, 4);
  });
  // One-way arrows along the aisle, and dashes where people walk to the zebra.
  const arrowY = LOT.aisle - 46;
  for (let x = 220; x < GAME_WIDTH - 120; x += 300) {
    if (x > CROSSWALK.left - 80 && x < CROSSWALK.right + 40) continue;
    paint(() => {
      ctx.save();
      ctx.translate(x, arrowY);
      ctx.scale(direction, 0.45);
      ctx.beginPath();
      ctx.moveTo(-50, -8);
      ctx.lineTo(18, -8);
      ctx.lineTo(18, -24);
      ctx.lineTo(50, 0);
      ctx.lineTo(18, 24);
      ctx.lineTo(18, 8);
      ctx.lineTo(-50, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  }
  const walkX = (CROSSWALK.left + CROSSWALK.right) / 2;
  for (let y = LOT.top + 30; y < LOT.slotTop - 10; y += 26) {
    paint(() => ctx.fillRect(walkX - 34, y, 68, 12));
  }
  // Wear on the paint.
  for (let i = 0; i < 700; i++) {
    ctx.fillStyle = 'rgba(70,70,72,0.3)';
    ctx.fillRect(random() * GAME_WIDTH, LOT.top + random() * (LOT.slotBottom - LOT.top), 2, 1.5);
  }
}

// Before it is bought: a gravel plot behind a builder's fence with a covered P sign.
export const CLOSED_TOP = LOT.top - 60;

export function lotClosedTexture(scene: Phaser.Scene): string {
  const top = LOT.top + 12;
  return paintTexture(scene, 'lot-closed', GAME_WIDTH, WALL_TOP + 24 - CLOSED_TOP, (ctx) => {
    ctx.translate(0, -CLOSED_TOP);
    const random = seeded(41);
    ctx.fillStyle = vGradient(ctx, top, WALL_TOP + 24, [
      [0, '#a49a88'],
      [1, '#b5ab97'],
    ]);
    ctx.fillRect(0, top, GAME_WIDTH, WALL_TOP + 24 - top);
    for (let i = 0; i < 5000; i++) {
      const tone = random();
      ctx.fillStyle = tone < 0.4 ? 'rgba(80,70,55,0.25)' : tone < 0.8 ? 'rgba(255,250,235,0.25)' : 'rgba(120,110,95,0.4)';
      ellipse(ctx, random() * GAME_WIDTH, top + random() * (WALL_TOP + 24 - top), 1.5 + random() * 2.5, 1 + random() * 1.5);
      ctx.fill();
    }
    // Puddles and weeds.
    for (let i = 0; i < 4; i++) {
      const x = 80 + random() * (GAME_WIDTH - 160);
      const y = LOT.aisle + random() * 140;
      ctx.fillStyle = radial(ctx, x, y, 0, 60, [
        [0, 'rgba(120,140,155,0.55)'],
        [1, 'rgba(120,140,155,0)'],
      ]);
      ellipse(ctx, x, y, 60, 14);
      ctx.fill();
    }
    for (let i = 0; i < 26; i++) {
      const x = random() * GAME_WIDTH;
      const y = top + 70 + random() * (WALL_TOP - top - 60);
      ctx.strokeStyle = random() < 0.5 ? '#5d7f3a' : '#76954a';
      ctx.lineWidth = 2;
      for (let b = 0; b < 6; b++) {
        ctx.beginPath();
        ctx.moveTo(x + b * 2, y);
        ctx.quadraticCurveTo(x + b * 2 + (random() - 0.5) * 10, y - 10, x + b * 3 - 6 + random() * 6, y - 14 - random() * 10);
        ctx.stroke();
      }
    }
    paintFence(ctx, top + 56);
  });
}

// Mesh panels on concrete feet along the plot.
function paintFence(ctx: Ctx, base: number): void {
  const height = 84;
  for (let x = 6; x < GAME_WIDTH; x += 118) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ellipse(ctx, x + 59, base + 4, 64, 6);
    ctx.fill();
    ctx.strokeStyle = '#b9bec4';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 2, base - height, 114, height - 6);
    ctx.strokeStyle = 'rgba(200,205,210,0.55)';
    ctx.lineWidth = 1;
    for (let gx = x + 10; gx < x + 116; gx += 10) {
      ctx.beginPath();
      ctx.moveTo(gx, base - height);
      ctx.lineTo(gx, base - 6);
      ctx.stroke();
    }
    for (let gy = base - height + 10; gy < base - 6; gy += 10) {
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
  // Banner on the fence: a big P under construction stripes.
  const bx = GAME_WIDTH / 2 - 120;
  const by = base - height + 8;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, bx + 4, by + 5, 240, 64, 6);
  ctx.fill();
  ctx.fillStyle = '#f7f4ec';
  roundRect(ctx, bx, by, 240, 64, 6);
  ctx.fill();
  ctx.save();
  roundRect(ctx, bx, by + 48, 240, 16, [0, 0, 6, 6]);
  ctx.clip();
  for (let x = bx - 20; x < bx + 260; x += 24) {
    ctx.fillStyle = '#e8b730';
    ctx.beginPath();
    ctx.moveTo(x, by + 64);
    ctx.lineTo(x + 12, by + 48);
    ctx.lineTo(x + 24, by + 48);
    ctx.lineTo(x + 12, by + 64);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = '#2f6fc4';
  roundRect(ctx, bx + 98, by + 6, 44, 38, 6);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('P', bx + 120, by + 26);
}

// A blue P sign on a post. Origin: the foot of the post (40, 160).
export function parkingSignTexture(scene: Phaser.Scene): string {
  return paintTexture(scene, 'lot-sign', 80, 164, (ctx) => {
    ctx.translate(40, 160);
    floorShadow(ctx, 4, -2, 16, 5, 0.35);
    ctx.fillStyle = hGradient(ctx, -4, 4, [
      [0, '#6b7177'],
      [0.5, '#c9ced3'],
      [1, '#5b6166'],
    ]);
    ctx.fillRect(-3, -90, 6, 90);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(ctx, -30, -154, 64, 64, 9);
    ctx.fill();
    ctx.fillStyle = vGradient(ctx, -156, -94, [
      [0, '#4f95f0'],
      [1, '#1f5fb8'],
    ]);
    roundRect(ctx, -32, -156, 64, 64, 9);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    roundRect(ctx, -27, -151, 54, 54, 6);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P', 0, -122);
  });
}

// A traffic cone. Origin: its foot (22, 60).
export function coneTexture(scene: Phaser.Scene): string {
  return paintTexture(scene, 'lot-cone', 44, 62, (ctx) => {
    ctx.translate(22, 60);
    floorShadow(ctx, 3, -2, 18, 5, 0.35);
    ctx.fillStyle = '#2b2b2b';
    roundRect(ctx, -19, -8, 38, 8, 2);
    ctx.fill();
    ctx.fillStyle = hGradient(ctx, -14, 14, [
      [0, '#c4401a'],
      [0.4, '#ff7a3a'],
      [1, '#b5361a'],
    ]);
    ctx.beginPath();
    ctx.moveTo(-14, -8);
    ctx.lineTo(-4, -54);
    ctx.lineTo(4, -54);
    ctx.lineTo(14, -8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f4f4f0';
    ctx.beginPath();
    ctx.moveTo(-10.5, -24);
    ctx.lineTo(-7.5, -38);
    ctx.lineTo(7.5, -38);
    ctx.lineTo(10.5, -24);
    ctx.closePath();
    ctx.fill();
  });
}

// The valet stand: a wooden lectern with a key box under a striped umbrella. Origin: its foot (90, 230).
export function valetStandTexture(scene: Phaser.Scene, street: StreetTheme): string {
  return paintTexture(scene, `lot-valet-${street.trim.toString(16)}`, 180, 234, (ctx) => {
    ctx.translate(90, 230);
    floorShadow(ctx, 0, -2, 70, 10, 0.3);
    // Umbrella pole and canopy.
    ctx.fillStyle = '#d9d5cc';
    ctx.fillRect(34, -200, 5, 200);
    const canopyY = -196;
    for (let i = 0; i < 6; i++) {
      const a0 = Math.PI + (i / 6) * Math.PI;
      const a1 = Math.PI + ((i + 1) / 6) * Math.PI;
      ctx.fillStyle = i % 2 === 0 ? '#c0392b' : '#f7f1e3';
      ctx.beginPath();
      ctx.moveTo(36, canopyY - 18);
      ctx.lineTo(36 + Math.cos(a0) * 86, canopyY + 12 + Math.sin(a0) * 6);
      ctx.lineTo(36 + Math.cos(a1) * 86, canopyY + 12 + Math.sin(a1) * 6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(-50, canopyY + 10, 172, 4);
    // Lectern.
    ctx.fillStyle = vGradient(ctx, -96, 0, [
      [0, '#8a5a34'],
      [1, '#5a3a20'],
    ]);
    ctx.beginPath();
    ctx.moveTo(-34, 0);
    ctx.lineTo(-26, -86);
    ctx.lineTo(26, -86);
    ctx.lineTo(34, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = vGradient(ctx, -102, -84, [
      [0, '#b07848'],
      [1, '#7a4e2c'],
    ]);
    ctx.beginPath();
    ctx.moveTo(-34, -86);
    ctx.lineTo(-30, -102);
    ctx.lineTo(30, -102);
    ctx.lineTo(34, -86);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = css(street.trim, -0.1);
    ctx.fillRect(-26, -60, 52, 6);
    // Key box with little keys on hooks.
    ctx.fillStyle = '#2d2d33';
    roundRect(ctx, -18, -48, 36, 30, 3);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = ['#e8b730', '#c94b4b', '#4f95f0', '#5fae4a'][i];
      ctx.fillRect(-13 + i * 8, -42, 4, 10);
    }
    ctx.fillStyle = '#f4efe2';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VALET', 0, -66);
  });
}

// A low brick wall with clipped shrubs along the front of the lot. Origin: top-left at WALL_TOP - 40.
export function lotWallTexture(scene: Phaser.Scene, street: StreetTheme): string {
  const height = LOT.bottom - WALL_TOP + 40;
  return paintTexture(scene, `lot-wall-${street.tree.leaf.toString(16)}`, GAME_WIDTH, height, (ctx) => {
    ctx.translate(0, -(WALL_TOP - 40));
    const random = seeded(53);
    // Shrubs behind the wall.
    for (let x = 20; x < GAME_WIDTH; x += 70 + random() * 30) {
      const r = 30 + random() * 12;
      ctx.fillStyle = radial(ctx, x - 8, WALL_TOP - r * 0.6, 2, r * 1.2, [
        [0, css(street.tree.leaf, 0.25)],
        [1, css(street.tree.leaf, -0.3)],
      ]);
      ellipse(ctx, x, WALL_TOP - r * 0.3, r * 1.1, r);
      ctx.fill();
    }
    // Wall: coping and two courses of brick.
    ctx.fillStyle = vGradient(ctx, WALL_TOP, WALL_TOP + 40, [
      [0, '#a5543a'],
      [1, '#7d3a26'],
    ]);
    ctx.fillRect(0, WALL_TOP, GAME_WIDTH, 40);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let row = 0; row < 3; row++) {
      const y = WALL_TOP + 8 + row * 11;
      ctx.fillRect(0, y, GAME_WIDTH, 1.5);
      for (let x = row % 2 === 0 ? 0 : 18; x < GAME_WIDTH; x += 36) ctx.fillRect(x, y, 1.5, 11);
    }
    ctx.fillStyle = vGradient(ctx, WALL_TOP - 8, WALL_TOP + 4, [
      [0, '#e6e1d6'],
      [1, '#b9b3a7'],
    ]);
    ctx.fillRect(0, WALL_TOP - 6, GAME_WIDTH, 10);
    ctx.fillStyle = vGradient(ctx, WALL_TOP + 40, WALL_TOP + 56, [
      [0, 'rgba(0,0,0,0.3)'],
      [1, 'rgba(0,0,0,0)'],
    ]);
    ctx.fillRect(0, WALL_TOP + 40, GAME_WIDTH, 16);
  });
}
