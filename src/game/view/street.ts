import Phaser from 'phaser';
import { FONT, GAME_WIDTH } from '../config';
import { ICON_COLORS, SIZE as ICON_SIZE, paintForeground } from '../../../tools/icon/paint';
import { CROSSWALK, DOOR_WIDTH, DOOR_X, DRIVEWAYS, FRONT, STREET } from './layout';
import { type Ctx, addArt, css, ellipse, floorShadow, hGradient, paintTexture, radial, rgba, roundRect, seeded, vGradient } from './paint';
import type { StreetTheme } from './streetThemes';

// The front of the restaurant and the street, painted like the room (2D canvas into textures):
// - the ground: the threshold, the pavement, the curb, the road and the far pavement, behind
//   everyone;
// - the front wall, cut low like a doll's house, in front of people inside and behind people
//   outside (depth = its face);
// - street furniture (lamps, a tree, a planter, a bin, bollards), each sorted by where it stands.

const GROUND_TOP = FRONT.capTop - 6;
const FACADE_TOP = FRONT.capTop - 46;
const DOOR_LEFT = DOOR_X - DOOR_WIDTH / 2;
const DOOR_RIGHT = DOOR_X + DOOR_WIDTH / 2;
const POST = 18;
// The restaurant's sign on the front wall, right of the door.
const SIGN = { left: 455, right: 815, top: FRONT.faceTop + 7, bottom: FRONT.faceBottom - 17 } as const;
const CENTER_LINE = (STREET.roadTop + STREET.roadBottom) / 2;
// The floor's vanishing point (see room.ts): pavement joints run toward it too.
const VANISH = { x: GAME_WIDTH / 2, y: -700 };

export const LAMPS = [590, 868];
export const TREE = { x: 985, y: 1318 } as const;
const PLANTER = { x: 110, y: 1180 } as const;
const BIN = { x: 520, y: 1332 } as const;
// On the far pavement, clear of the driveways and the zebra.
const BOLLARDS = [250, 450, 640, 860];

export function drawStreet(scene: Phaser.Scene, street: StreetTheme): void {
  const key = `street-${street.facadeColor.toString(16)}-${street.pavingA.toString(16)}-${street.road}`;
  const groundHeight = STREET.bottom - GROUND_TOP;
  addArt(scene, 0, GROUND_TOP, paintTexture(scene, `${key}-ground`, GAME_WIDTH, groundHeight, (ctx) => paintGround(ctx, street)), 0, 0).setDepth(
    -995,
  );
  const facadeHeight = FRONT.faceBottom + 6 - FACADE_TOP;
  addArt(scene, 0, FACADE_TOP, paintTexture(scene, `${key}-facade`, GAME_WIDTH, facadeHeight, (ctx) => paintFacade(ctx, street)), 0, 0).setDepth(
    FRONT.faceTop,
  );

  const lamp = paintTexture(scene, 'street-lamp', 120, 360, paintLamp);
  LAMPS.forEach((x) => addArt(scene, x, STREET.curb - 8, lamp, 60, 350).setDepth(STREET.curb - 8));
  const tree = paintTexture(scene, `street-tree-${street.tree.kind}-${street.tree.leaf.toString(16)}`, 300, 360, (ctx) => paintTree(ctx, street));
  addArt(scene, TREE.x, TREE.y, tree, 150, 345).setDepth(TREE.y);
  const planter = paintTexture(scene, `street-planter-${street.trim.toString(16)}`, 190, 110, (ctx) => paintPlanter(ctx, street));
  addArt(scene, PLANTER.x, PLANTER.y, planter, 95, 100).setDepth(PLANTER.y);
  addArt(scene, BIN.x, BIN.y, paintTexture(scene, 'street-bin', 60, 90, paintBin), 30, 84).setDepth(BIN.y);
  const bollard = paintTexture(scene, 'street-bollard', 40, 70, paintBollard);
  BOLLARDS.forEach((x) => addArt(scene, x, STREET.bottom - 22, bollard, 20, 64).setDepth(STREET.bottom - 22));
}

// --- Ground ------------------------------------------------------------------------------

function paintGround(ctx: Ctx, street: StreetTheme): void {
  ctx.translate(0, -GROUND_TOP);
  paintThreshold(ctx, street);
  paintPavement(ctx, street, STREET.pavementTop, STREET.curb);
  // The front wall shades the pavement next to it.
  ctx.fillStyle = vGradient(ctx, STREET.pavementTop, STREET.pavementTop + 46, [
    [0, 'rgba(25,15,5,0.42)'],
    [1, 'rgba(25,15,5,0)'],
  ]);
  ctx.fillRect(0, STREET.pavementTop, GAME_WIDTH, 46);
  paintTreePit(ctx);
  paintCurb(ctx, STREET.curb, true);
  paintRoad(ctx, street);
  paintCurb(ctx, STREET.roadBottom, false);
  paintPavement(ctx, street, STREET.roadBottom + 12, STREET.bottom);
  paintDriveway(ctx, DRIVEWAYS.left.from, DRIVEWAYS.left.to);
  paintDriveway(ctx, DRIVEWAYS.right.from, DRIVEWAYS.right.to);
}

// A lowered curb and a concrete apron across the far pavement, into the parking lot.
function paintDriveway(ctx: Ctx, from: number, to: number): void {
  const top = STREET.roadBottom;
  const bottom = STREET.bottom;
  ctx.fillStyle = vGradient(ctx, top, bottom, [
    [0, '#bdb9b0'],
    [0.15, '#aaa69d'],
    [1, '#9c988f'],
  ]);
  ctx.fillRect(from, top, to - from, bottom - top);
  // Expansion joints and tyre marks.
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(from, top + 12, to - from, 2);
  for (let x = from + 60; x < to - 20; x += 60) ctx.fillRect(x, top + 12, 2, bottom - top - 12);
  ctx.fillStyle = 'rgba(30,30,30,0.08)';
  [0.3, 0.7].forEach((f) => ctx.fillRect(from + (to - from) * f - 14, top, 28, bottom - top));
  // Ramps down at both ends.
  [from, to].forEach((x, i) => {
    ctx.fillStyle = hGradient(ctx, x - 14, x + 14, i === 0 ? [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.22)']] : [[0, 'rgba(0,0,0,0.22)'], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(x - 14, top, 28, bottom - top);
  });
}

// The floor runs out through the door onto a stone sill and a step down to the pavement.
function paintThreshold(ctx: Ctx, street: StreetTheme): void {
  ctx.fillStyle = css(street.pavingA, -0.15);
  ctx.fillRect(0, GROUND_TOP, GAME_WIDTH, STREET.pavementTop - GROUND_TOP);
  const stepTop = FRONT.faceBottom - 30;
  ctx.fillStyle = vGradient(ctx, GROUND_TOP, stepTop, [
    [0, css(street.trim, -0.35)],
    [0.25, css(street.trim, -0.12)],
    [1, css(street.trim, -0.22)],
  ]);
  ctx.fillRect(DOOR_LEFT, GROUND_TOP, DOOR_WIDTH, stepTop - GROUND_TOP);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let x = DOOR_LEFT + 50; x < DOOR_RIGHT; x += 50) ctx.fillRect(x, GROUND_TOP, 2, stepTop - GROUND_TOP);
  // Step: top surface and a lit front edge.
  ctx.fillStyle = vGradient(ctx, stepTop, FRONT.faceBottom - 8, [
    [0, css(street.trim, -0.12)],
    [1, css(street.trim, 0.05)],
  ]);
  ctx.fillRect(DOOR_LEFT - 6, stepTop, DOOR_WIDTH + 12, FRONT.faceBottom - 8 - stepTop);
  ctx.fillStyle = vGradient(ctx, FRONT.faceBottom - 8, FRONT.faceBottom + 4, [
    [0, css(street.trim, -0.2)],
    [1, css(street.trim, -0.45)],
  ]);
  ctx.fillRect(DOOR_LEFT - 6, FRONT.faceBottom - 8, DOOR_WIDTH + 12, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(DOOR_LEFT - 6, FRONT.faceBottom - 9, DOOR_WIDTH + 12, 2);
  // Door mat on the step.
  ctx.fillStyle = vGradient(ctx, stepTop + 6, stepTop + 20, [
    [0, '#5a4636'],
    [1, '#3e2f24'],
  ]);
  roundRect(ctx, DOOR_X - 50, stepTop + 5, 100, 15, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,230,190,0.25)';
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1.5;
  roundRect(ctx, DOOR_X - 45, stepTop + 8, 90, 9, 3);
  ctx.stroke();
  ctx.setLineDash([]);
}

// x at height y of a line that crosses the pavement's top edge at x0 (lines run to VANISH).
function perspectiveX(x0: number, y0: number, y: number): number {
  return VANISH.x + ((x0 - VANISH.x) * (y - VANISH.y)) / (y0 - VANISH.y);
}

function paintPavement(ctx: Ctx, street: StreetTheme, top: number, bottom: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top, GAME_WIDTH, bottom - top);
  ctx.clip();
  const random = seeded(Math.round(top));
  ctx.fillStyle = vGradient(ctx, top, bottom, [
    [0, css(street.pavingA, -0.06)],
    [1, css(street.pavingA, 0.04)],
  ]);
  ctx.fillRect(0, top, GAME_WIDTH, bottom - top);

  if (street.paving === 'slabs') {
    // Large square slabs; joints along the street are level, the others run to the vanishing point.
    const rowHeight = 46;
    for (let y = top, row = 0; y < bottom; y += rowHeight, row++) {
      const offset = row % 2 === 0 ? 0 : 45;
      for (let x0 = -540 + offset; x0 < GAME_WIDTH + 540; x0 += 90) {
        const a = perspectiveX(x0, top, y);
        const b = perspectiveX(x0 + 90, top, y);
        const c = perspectiveX(x0 + 90, top, y + rowHeight);
        const d = perspectiveX(x0, top, y + rowHeight);
        const tone = (random() - 0.5) * 0.1;
        ctx.fillStyle = vGradient(ctx, y, y + rowHeight, [
          [0, css(row % 3 === 1 ? street.pavingB : street.pavingA, tone + 0.04)],
          [1, css(row % 3 === 1 ? street.pavingB : street.pavingA, tone - 0.04)],
        ]);
        ctx.beginPath();
        ctx.moveTo(a + 1.5, y + 1.5);
        ctx.lineTo(b - 1.5, y + 1.5);
        ctx.lineTo(c - 1.5, y + rowHeight - 1.5);
        ctx.lineTo(d + 1.5, y + rowHeight - 1.5);
        ctx.closePath();
        ctx.fill();
        // A lit upper edge and a worn speckle or two.
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.fillRect(a + 2, y + 2, b - a - 4, 2);
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = random() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)';
          ellipse(ctx, a + 8 + random() * (b - a - 16), y + 8 + random() * (rowHeight - 16), 2 + random() * 4, 1.5 + random() * 2);
          ctx.fill();
        }
      }
    }
  } else if (street.paving === 'cobbles') {
    // Rounded setts in staggered rows, each lit from above.
    const rowHeight = 17;
    for (let y = top, row = 0; y < bottom + rowHeight; y += rowHeight, row++) {
      for (let x = row % 2 === 0 ? -10 : 2; x < GAME_WIDTH + 20; ) {
        const w = 20 + random() * 8;
        const color = random() < 0.5 ? street.pavingA : street.pavingB;
        const tone = (random() - 0.5) * 0.16;
        ctx.fillStyle = vGradient(ctx, y, y + rowHeight, [
          [0, css(color, tone + 0.18)],
          [0.5, css(color, tone)],
          [1, css(color, tone - 0.2)],
        ]);
        roundRect(ctx, x + 1.5, y + 1.5, w - 3, rowHeight - 3, 6);
        ctx.fill();
        x += w;
      }
    }
    // Dark joints between the setts read as depth.
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = top + rowHeight - 1; y < bottom; y += rowHeight) ctx.fillRect(0, y, GAME_WIDTH, 2);
  } else if (street.paving === 'bricks') {
    const rowHeight = 22;
    for (let y = top, row = 0; y < bottom; y += rowHeight, row++) {
      for (let x = row % 2 === 0 ? -24 : 0; x < GAME_WIDTH; x += 48) {
        const color = random() < 0.35 ? street.pavingB : street.pavingA;
        ctx.fillStyle = vGradient(ctx, y, y + rowHeight, [
          [0, css(color, 0.08 + (random() - 0.5) * 0.1)],
          [1, css(color, -0.08)],
        ]);
        ctx.fillRect(x + 1.5, y + 1.5, 45, rowHeight - 3);
      }
    }
  } else if (street.paving === 'waves') {
    // Black and white stone waves, like a seaside promenade.
    ctx.fillStyle = css(street.pavingA);
    ctx.fillRect(0, top, GAME_WIDTH, bottom - top);
    ctx.fillStyle = css(street.pavingB);
    for (let band = top - 40; band < bottom + 40; band += 62) {
      ctx.beginPath();
      for (let x = 0; x <= GAME_WIDTH; x += 8) {
        const y = band + Math.sin((x / 150) * Math.PI * 2) * 15;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      for (let x = GAME_WIDTH; x >= 0; x -= 8) ctx.lineTo(x, band + 24 + Math.sin((x / 150) * Math.PI * 2 + 0.5) * 15);
      ctx.closePath();
      ctx.fill();
    }
    // The tiny stones of the mosaic.
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = random() < 0.5 ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
      ctx.fillRect(random() * GAME_WIDTH, top + random() * (bottom - top), 3, 2);
    }
  }
  ctx.restore();
}

function paintTreePit(ctx: Ctx): void {
  const w = 120;
  const h = 34;
  const x = TREE.x - w / 2;
  const y = TREE.y - h + 6;
  ctx.fillStyle = '#4a3a2a';
  roundRect(ctx, x, y, w, h, 3);
  ctx.fill();
  // A cast iron grate around the trunk.
  ctx.strokeStyle = '#2c2a28';
  ctx.lineWidth = 3;
  roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 3);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 10; i++) {
    ctx.beginPath();
    ctx.moveTo(x + (w * i) / 10, y + 3);
    ctx.lineTo(x + (w * i) / 10, y + h - 3);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x + 3, y + 3, w - 6, 1.5);
}

// A granite curb: its top, and its face when it faces the viewer.
function paintCurb(ctx: Ctx, y: number, withFace: boolean): void {
  ctx.fillStyle = vGradient(ctx, y, y + 12, [
    [0, '#e4e1da'],
    [1, '#c3bfb6'],
  ]);
  ctx.fillRect(0, y, GAME_WIDTH, 12);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let x = 120; x < GAME_WIDTH; x += 150) ctx.fillRect(x, y, 2, withFace ? 22 : 12);
  if (!withFace) return;
  ctx.fillStyle = vGradient(ctx, y + 12, y + 22, [
    [0, '#9d998f'],
    [1, '#6f6b63'],
  ]);
  ctx.fillRect(0, y + 12, GAME_WIDTH, 10);
}

function paintRoad(ctx: Ctx, street: StreetTheme): void {
  const top = STREET.roadTop;
  const bottom = STREET.roadBottom;
  const random = seeded(11);
  if (street.road === 'cobbles') {
    paintPavement(ctx, { ...street, paving: 'cobbles', pavingA: 0x56524e, pavingB: 0x45413d }, top, bottom);
  } else {
    ctx.fillStyle = vGradient(ctx, top, bottom, [
      [0, '#4b4c4f'],
      [0.5, '#56575a'],
      [1, '#4a4b4e'],
    ]);
    ctx.fillRect(0, top, GAME_WIDTH, bottom - top);
    // Aggregate: thousands of tiny light and dark grains.
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = random() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)';
      ctx.fillRect(random() * GAME_WIDTH, top + random() * (bottom - top), 1.5 + random() * 1.5, 1.2);
    }
    // Soft stains of oil and newer asphalt.
    for (let i = 0; i < 7; i++) {
      const x = random() * GAME_WIDTH;
      const y = top + 30 + random() * (bottom - top - 60);
      const r = 30 + random() * 50;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.35);
      ctx.fillStyle = radial(ctx, 0, 0, 0, r, [
        [0, 'rgba(15,15,18,0.16)'],
        [1, 'rgba(15,15,18,0)'],
      ]);
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(15,15,15,0.25)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) {
      let x = random() * GAME_WIDTH;
      let y = top + 30 + random() * (bottom - top - 60);
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 6; s++) {
        x += 8 + random() * 14;
        y += (random() - 0.5) * 10;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  // Wheel tracks: each lane is a little darker where the tyres run.
  STREET.lanes.forEach((lane) =>
    [-34, 34].forEach((dy) => {
      ctx.fillStyle = vGradient(ctx, lane + dy - 12, lane + dy + 12, [
        [0, 'rgba(0,0,0,0)'],
        [0.5, 'rgba(0,0,0,0.08)'],
        [1, 'rgba(0,0,0,0)'],
      ]);
      ctx.fillRect(0, lane + dy - 12, GAME_WIDTH, 24);
    }),
  );
  // Gutters along both curbs.
  ctx.fillStyle = vGradient(ctx, top, top + 14, [
    [0, 'rgba(0,0,0,0.35)'],
    [1, 'rgba(0,0,0,0)'],
  ]);
  ctx.fillRect(0, top, GAME_WIDTH, 14);
  paintDrain(ctx, 560, top + 3);
  paintManhole(ctx, 260, STREET.lanes[1] - 10);

  // Markings.
  const paint = (x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = rgba(street.roadLine, 0.88);
    ctx.fillRect(x, y, w, h);
    // Worn by traffic.
    for (let i = 0; i < (w * h) / 30; i++) {
      ctx.fillStyle = 'rgba(60,60,62,0.35)';
      ctx.fillRect(x + random() * w, y + random() * h, 2, 1.5);
    }
  };
  if (street.road === 'asphalt') {
    if (street.roadLine === 0xf2f2ee) {
      for (let x = -20; x < GAME_WIDTH; x += 110) if (x + 60 < CROSSWALK.left - 10 || x > CROSSWALK.right + 10) paint(x, CENTER_LINE - 4, 60, 8);
    } else {
      // Double solid center line.
      [CENTER_LINE - 9, CENTER_LINE + 3].forEach((y) => {
        paint(0, y, CROSSWALK.left - 14, 6);
        paint(CROSSWALK.right + 14, y, GAME_WIDTH - CROSSWALK.right - 14, 6);
      });
    }
  }
  // Zebra crossing: bars along the traffic, across the whole road.
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(CROSSWALK.left - 4, top + 14, CROSSWALK.right - CROSSWALK.left + 8, bottom - top - 22);
  const random2 = seeded(5);
  for (let y = top + 18; y < bottom - 20; y += 40) {
    const left = perspectiveX(CROSSWALK.left, top, y);
    const right = perspectiveX(CROSSWALK.right, top, y);
    ctx.fillStyle = 'rgba(245,245,240,0.92)';
    ctx.fillRect(left, y, right - left, 22);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = 'rgba(70,70,72,0.35)';
      ctx.fillRect(left + random2() * (right - left), y + random2() * 22, 2.5, 1.5);
    }
  }
}

function paintDrain(ctx: Ctx, x: number, y: number): void {
  ctx.fillStyle = '#2a2b2d';
  roundRect(ctx, x, y, 70, 18, 3);
  ctx.fill();
  ctx.fillStyle = '#16171a';
  for (let i = 0; i < 7; i++) ctx.fillRect(x + 6 + i * 9, y + 4, 4, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(x, y, 70, 1.5);
}

function paintManhole(ctx: Ctx, x: number, y: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ellipse(ctx, x, y + 2, 44, 17);
  ctx.fill();
  ctx.fillStyle = radial(ctx, x, y, 0, 44, [
    [0, '#5c5a57'],
    [1, '#3a3836'],
  ], x - 10, y - 6);
  ellipse(ctx, x, y, 42, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,20,20,0.6)';
  ctx.lineWidth = 1.5;
  [30, 18].forEach((r) => {
    ellipse(ctx, x, y, r, r * 0.38);
    ctx.stroke();
  });
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * 8, y - 13);
    ctx.lineTo(x + i * 8, y + 13);
    ctx.stroke();
  }
}

// --- Front wall ---------------------------------------------------------------------------

function paintFacade(ctx: Ctx, street: StreetTheme): void {
  ctx.translate(0, -FACADE_TOP);
  const faceTop = FRONT.faceTop;
  const faceBottom = FRONT.faceBottom;
  // The outer face in the city's material, then a stone plinth at the foot.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, faceTop, GAME_WIDTH, faceBottom - faceTop);
  ctx.clip();
  paintMaterial(ctx, street, faceTop, faceBottom - 12);
  ctx.restore();
  ctx.fillStyle = vGradient(ctx, faceBottom - 12, faceBottom, [
    [0, css(street.trim, -0.32)],
    [1, css(street.trim, -0.5)],
  ]);
  ctx.fillRect(0, faceBottom - 12, GAME_WIDTH, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(0, faceBottom - 12, GAME_WIDTH, 1.5);
  // The coping overhangs a little and casts a shadow on the face.
  ctx.fillStyle = vGradient(ctx, faceTop, faceTop + 12, [
    [0, 'rgba(15,8,2,0.4)'],
    [1, 'rgba(15,8,2,0)'],
  ]);
  ctx.fillRect(0, faceTop, GAME_WIDTH, 12);
  // Coping: the top of the cut wall and its rounded front edge.
  ctx.fillStyle = vGradient(ctx, FRONT.capTop, faceTop - 8, [
    [0, css(street.trim, -0.18)],
    [1, css(street.trim, -0.02)],
  ]);
  ctx.fillRect(0, FRONT.capTop, GAME_WIDTH, faceTop - 8 - FRONT.capTop);
  ctx.fillStyle = vGradient(ctx, faceTop - 8, faceTop, [
    [0, css(street.trim, 0.25)],
    [1, css(street.trim, -0.3)],
  ]);
  ctx.fillRect(0, faceTop - 8, GAME_WIDTH, 8);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillRect(0, faceTop - 8, GAME_WIDTH, 1.5);
  // Joints in the coping.
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  for (let x = 90; x < GAME_WIDTH; x += 180) ctx.fillRect(x, FRONT.capTop, 2, faceTop - FRONT.capTop);

  paintSign(ctx);

  // The doorway: cut out, then framed by two posts.
  ctx.clearRect(DOOR_LEFT, FACADE_TOP, DOOR_WIDTH, faceBottom + 10 - FACADE_TOP);
  [DOOR_LEFT - POST, DOOR_RIGHT].forEach((x) => paintPost(ctx, x, street));
}

function paintMaterial(ctx: Ctx, street: StreetTheme, top: number, bottom: number): void {
  const random = seeded(23);
  const color = street.facadeColor;
  const height = bottom - top;
  ctx.fillStyle = vGradient(ctx, top, bottom, [
    [0, css(color, 0.06)],
    [1, css(color, -0.1)],
  ]);
  ctx.fillRect(0, top, GAME_WIDTH, height);

  switch (street.facade) {
    case 'stone': {
      const course = height / 3;
      for (let r = 0; r < 3; r++) {
        const y = top + r * course;
        for (let x = r % 2 === 0 ? 0 : -50; x < GAME_WIDTH; ) {
          const w = 80 + random() * 50;
          const tone = (random() - 0.5) * 0.14;
          ctx.fillStyle = vGradient(ctx, y, y + course, [
            [0, css(color, tone + 0.1)],
            [1, css(color, tone - 0.1)],
          ]);
          ctx.fillRect(x + 1.5, y + 1.5, w - 3, course - 3);
          ctx.fillStyle = 'rgba(255,255,255,0.22)';
          ctx.fillRect(x + 2, y + 2, w - 4, 1.5);
          ctx.fillStyle = 'rgba(0,0,0,0.14)';
          ctx.fillRect(x + 2, y + course - 3.5, w - 4, 1.5);
          for (let i = 0; i < 6; i++) {
            ctx.fillStyle = random() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
            ctx.fillRect(x + random() * w, y + random() * course, 2, 2);
          }
          x += w;
        }
      }
      break;
    }
    case 'brick': {
      const course = 11;
      ctx.fillStyle = css(0xcfc6b8, -0.2);
      ctx.fillRect(0, top, GAME_WIDTH, height);
      for (let y = top, r = 0; y < bottom; y += course, r++) {
        for (let x = r % 2 === 0 ? 0 : -17; x < GAME_WIDTH; x += 34) {
          const tone = (random() - 0.5) * 0.22 + (random() < 0.08 ? -0.15 : 0);
          ctx.fillStyle = vGradient(ctx, y, y + course, [
            [0, css(color, tone + 0.08)],
            [1, css(color, tone - 0.12)],
          ]);
          ctx.fillRect(x + 1, y + 1, 32, course - 2);
        }
      }
      break;
    }
    case 'stucco': {
      // Smooth render with rusticated grooves, like a palazzo's ground floor.
      for (let i = 0; i < 1800; i++) {
        ctx.fillStyle = random() < 0.5 ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)';
        ctx.fillRect(random() * GAME_WIDTH, top + random() * height, 2, 2);
      }
      for (let y = top + height / 3; y < bottom - 4; y += height / 3) {
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.fillRect(0, y - 2, GAME_WIDTH, 3);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(0, y + 1, GAME_WIDTH, 1.5);
      }
      break;
    }
    case 'wood': {
      // Painted panelling: raised fields between rails and stiles, with a fine pin line.
      const panel = 120;
      for (let x = 6; x < GAME_WIDTH; x += panel) {
        const y = top + 8;
        const w = panel - 14;
        const h = height - 16;
        ctx.fillStyle = vGradient(ctx, y, y + h, [
          [0, css(color, 0.12)],
          [1, css(color, -0.12)],
        ]);
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(x, y, w, 2);
        ctx.fillRect(x, y, 2, h);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x, y + h - 2, w, 2);
        ctx.fillRect(x + w - 2, y, 2, h);
        ctx.strokeStyle = css(street.trim, 0, 0.55);
        ctx.lineWidth = 1.2;
        ctx.strokeRect(x + 8, y + 8, w - 16, h - 16);
        // Grain.
        ctx.strokeStyle = 'rgba(0,0,0,0.07)';
        for (let g = 0; g < 4; g++) {
          const gy = y + 10 + random() * (h - 20);
          ctx.beginPath();
          ctx.moveTo(x + 4, gy);
          ctx.bezierCurveTo(x + w * 0.3, gy - 3, x + w * 0.6, gy + 3, x + w - 4, gy);
          ctx.stroke();
        }
      }
      break;
    }
    case 'tiles': {
      // Glazed tiles: white with a painted pattern in the city color.
      const size = height / 3;
      for (let y = top; y < bottom - 1; y += size) {
        for (let x = 0; x < GAME_WIDTH; x += size) {
          ctx.fillStyle = vGradient(ctx, y, y + size, [
            [0, '#fbf8f0'],
            [1, '#e6e1d4'],
          ]);
          ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
          const cx = x + size / 2;
          const cy = y + size / 2;
          ctx.fillStyle = css(color);
          ctx.beginPath();
          for (let i = 0; i < 4; i++) {
            const a = (i * Math.PI) / 2;
            ctx.moveTo(cx, cy);
            ctx.arc(cx + Math.cos(a) * size * 0.2, cy + Math.sin(a) * size * 0.2, size * 0.16, 0, Math.PI * 2);
          }
          ctx.fill();
          ctx.fillStyle = '#fbf8f0';
          ctx.beginPath();
          ctx.arc(cx, cy, size * 0.09, 0, Math.PI * 2);
          ctx.fill();
          // Quarter circles in the corners join into rings across tiles.
          ctx.strokeStyle = css(color, 0, 0.8);
          ctx.lineWidth = 2;
          [
            [x, y, 0],
            [x + size, y, Math.PI / 2],
            [x + size, y + size, Math.PI],
            [x, y + size, -Math.PI / 2],
          ].forEach(([px, py, a]) => {
            ctx.beginPath();
            ctx.arc(px, py, size * 0.3, a, a + Math.PI / 2);
            ctx.stroke();
          });
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.fillRect(x + 3, y + 3, size * 0.4, 1.5);
        }
      }
      break;
    }
  }
}

function paintPost(ctx: Ctx, x: number, street: StreetTheme): void {
  const top = FRONT.capTop - 34;
  const bottom = FRONT.faceBottom;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(x + POST, top + 6, 5, bottom - top - 6);
  ctx.fillStyle = hGradient(ctx, x, x + POST, [
    [0, css(street.trim, -0.25)],
    [0.35, css(street.trim, 0.12)],
    [1, css(street.trim, -0.32)],
  ]);
  ctx.fillRect(x, top, POST, bottom - top);
  // A cap on top and a base at the foot.
  ctx.fillStyle = vGradient(ctx, top - 10, top, [
    [0, css(street.trim, 0.3)],
    [1, css(street.trim, -0.2)],
  ]);
  roundRect(ctx, x - 4, top - 10, POST + 8, 12, 3);
  ctx.fill();
  ctx.fillStyle = css(street.trim, -0.4);
  ctx.fillRect(x - 3, bottom - 14, POST + 6, 14);
}

// The restaurant's name board with the globe-chef emblem, lit by two small lamps on the coping.
function paintSign(ctx: Ctx): void {
  const { left, right, top, bottom } = SIGN;
  const h = bottom - top;
  [left + 70, right - 70].forEach((x) => {
    // Light falling on the board.
    ctx.fillStyle = radial(ctx, x, top + 4, 0, 110, [
      [0, 'rgba(255,236,190,0.45)'],
      [1, 'rgba(255,236,190,0)'],
    ]);
    ctx.fillRect(x - 110, top - 20, 220, h + 40);
  });
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, left + 4, top + 5, right - left, h, 6);
  ctx.fill();
  ctx.fillStyle = vGradient(ctx, top, bottom, [
    [0, '#d9b25a'],
    [0.5, '#a8812e'],
    [1, '#7a5a1c'],
  ]);
  roundRect(ctx, left, top, right - left, h, 6);
  ctx.fill();
  ctx.fillStyle = vGradient(ctx, top + 4, bottom - 4, [
    [0, '#3a2a20'],
    [1, '#22170f'],
  ]);
  roundRect(ctx, left + 4, top + 4, right - left - 8, h - 8, 4);
  ctx.fill();
  // Emblem: the app icon's globe in a red medallion.
  const ex = left + 34;
  const ey = top + h / 2;
  const er = h / 2 - 6;
  ctx.fillStyle = radial(ctx, ex, ey - er * 0.3, 2, er, [
    [0, ICON_COLORS.inner],
    [1, ICON_COLORS.outer],
  ]);
  ctx.beginPath();
  ctx.arc(ex, ey, er, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e8c46a';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.arc(ex, ey, er - 1, 0, Math.PI * 2);
  ctx.clip();
  const size = er * 2.3;
  ctx.translate(ex - size / 2, ey - size / 2);
  ctx.scale(size / ICON_SIZE, size / ICON_SIZE);
  paintForeground(ctx, 0.85);
  ctx.restore();
  // Name in raised gold letters.
  const textX = (left + 62 + right) / 2;
  ctx.font = `600 34px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillText('TASTE TOUR', textX + 1.5, ey + 3);
  ctx.fillStyle = vGradient(ctx, ey - 14, ey + 14, [
    [0, '#fff1c2'],
    [0.5, '#f0c560'],
    [1, '#b8862b'],
  ]);
  ctx.fillText('TASTE TOUR', textX, ey + 1);
  // Lamps on goosenecks over the board.
  [left + 70, right - 70].forEach((x) => {
    ctx.strokeStyle = '#2b2b2b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, FRONT.capTop + 6);
    ctx.quadraticCurveTo(x, FRONT.capTop - 18, x + 14, FRONT.capTop - 16);
    ctx.stroke();
    ctx.fillStyle = vGradient(ctx, FRONT.capTop - 24, FRONT.capTop - 6, [
      [0, '#4a4a4a'],
      [1, '#1c1c1c'],
    ]);
    ctx.beginPath();
    ctx.moveTo(x + 6, FRONT.capTop - 22);
    ctx.lineTo(x + 24, FRONT.capTop - 18);
    ctx.lineTo(x + 26, FRONT.capTop - 6);
    ctx.lineTo(x + 4, FRONT.capTop - 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,240,200,0.9)';
    ellipse(ctx, x + 15, FRONT.capTop - 8, 10, 3);
    ctx.fill();
  });
}

// --- Street furniture ----------------------------------------------------------------------

// A cast iron street lamp. Texture origin: the foot of the post (60, 350).
function paintLamp(ctx: Ctx): void {
  ctx.translate(60, 350);
  floorShadow(ctx, 6, -2, 30, 8, 0.35);
  const iron = (x0: number, x1: number) =>
    hGradient(ctx, x0, x1, [
      [0, '#1b2420'],
      [0.4, '#4e5d56'],
      [1, '#141a17'],
    ]);
  // Base, fluted post and collars.
  ctx.fillStyle = iron(-16, 16);
  ctx.beginPath();
  ctx.moveTo(-16, 0);
  ctx.lineTo(16, 0);
  ctx.lineTo(10, -40);
  ctx.lineTo(-10, -40);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = iron(-6, 6);
  ctx.fillRect(-5, -290, 10, 252);
  [-40, -120, -288].forEach((y) => {
    ctx.fillStyle = iron(-10, 10);
    roundRect(ctx, -9, y - 6, 18, 8, 3);
    ctx.fill();
  });
  // Lantern: a cap, warm glass and a finial.
  const top = -340;
  ctx.fillStyle = radial(ctx, 0, top + 30, 0, 60, [
    [0, 'rgba(255,226,150,0.45)'],
    [1, 'rgba(255,226,150,0)'],
  ]);
  ctx.fillRect(-60, top - 30, 120, 120);
  ctx.fillStyle = iron(-12, 12);
  ctx.fillRect(-4, top + 44, 8, 10);
  ctx.fillStyle = vGradient(ctx, top + 8, top + 46, [
    [0, '#fff6d8'],
    [1, '#f3c46a'],
  ]);
  ctx.beginPath();
  ctx.moveTo(-15, top + 8);
  ctx.lineTo(15, top + 8);
  ctx.lineTo(10, top + 46);
  ctx.lineTo(-10, top + 46);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#1b2420';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, top + 8);
  ctx.lineTo(0, top + 46);
  ctx.stroke();
  ctx.fillStyle = iron(-22, 22);
  ctx.beginPath();
  ctx.moveTo(-22, top + 9);
  ctx.lineTo(22, top + 9);
  ctx.lineTo(8, top - 6);
  ctx.lineTo(-8, top - 6);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, top - 10, 4, 0, Math.PI * 2);
  ctx.fill();
}

// Texture origin: the foot of the trunk (150, 345).
function paintTree(ctx: Ctx, street: StreetTheme): void {
  ctx.translate(150, 345);
  const random = seeded(31);
  const { kind, leaf, blossom } = street.tree;
  floorShadow(ctx, 10, -4, 90, 16, 0.3);
  const bark = (x0: number, x1: number) =>
    hGradient(ctx, x0, x1, [
      [0, '#4a3324'],
      [0.4, '#8a6448'],
      [1, '#3a281c'],
    ]);
  const clump = (x: number, y: number, r: number, color: number) => {
    ctx.fillStyle = radial(ctx, x - r * 0.3, y - r * 0.4, r * 0.1, r * 1.1, [
      [0, css(color, 0.25)],
      [0.6, css(color, 0)],
      [1, css(color, -0.3)],
    ]);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  if (kind === 'palm') {
    // A gently curved, ringed trunk.
    ctx.fillStyle = bark(-12, 14);
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.quadraticCurveTo(-4, -150, 18, -290);
    ctx.lineTo(28, -288);
    ctx.quadraticCurveTo(10, -150, 12, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,25,15,0.4)';
    ctx.lineWidth = 2;
    for (let y = -14; y > -280; y -= 14) {
      const t = -y / 290;
      const x = -12 + 30 * t * t;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 24 - 6 * t, y - 3);
      ctx.stroke();
    }
    const crown = { x: 23, y: -292 };
    for (let i = 0; i < 11; i++) {
      const angle = -Math.PI + (i / 10) * Math.PI + (random() - 0.5) * 0.25;
      const length = 95 + random() * 40;
      const tipX = crown.x + Math.cos(angle) * length;
      const tipY = crown.y + Math.sin(angle) * length * 0.55 + 40;
      ctx.strokeStyle = css(leaf, i % 2 === 0 ? -0.15 : 0.05);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(crown.x, crown.y);
      ctx.quadraticCurveTo((crown.x + tipX) / 2, crown.y - 30, tipX, tipY);
      ctx.stroke();
      // Leaflets along the frond.
      for (let s = 0.15; s < 1; s += 0.08) {
        const px = crown.x + (tipX - crown.x) * s;
        const py = crown.y + (tipY - crown.y) * s - 30 * Math.sin(s * Math.PI);
        ctx.strokeStyle = css(leaf, (random() - 0.5) * 0.2 + (i % 2 === 0 ? -0.1 : 0.08));
        ctx.lineWidth = 2;
        [-1, 1].forEach((side) => {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + side * 6 + (tipX > crown.x ? 8 : -8), py + 20 * (1 - s * 0.5));
          ctx.stroke();
        });
      }
    }
    ctx.fillStyle = '#6b4a2a';
    ctx.beginPath();
    ctx.arc(crown.x, crown.y + 4, 9, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (kind === 'umbrella') {
    // A stone pine: a tall bare trunk and a wide, flat crown.
    ctx.fillStyle = bark(-10, 12);
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.quadraticCurveTo(-2, -120, 8, -230);
    ctx.lineTo(18, -230);
    ctx.quadraticCurveTo(12, -120, 12, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#4a3324';
    ctx.lineWidth = 5;
    [
      [10, -200, -50, -250],
      [14, -210, 70, -262],
    ].forEach(([x0, y0, x1, y1]) => {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    });
    for (let i = 0; i < 26; i++) {
      const x = -125 + random() * 270;
      const y = -262 - random() * 42 + Math.abs(x - 10) * 0.12;
      clump(x, y, 22 + random() * 16, shade2(leaf, i < 10 ? -0.15 : 0));
    }
    return;
  }

  // A round street tree with a few branches showing through.
  ctx.fillStyle = bark(-11, 13);
  ctx.beginPath();
  ctx.moveTo(-11, 0);
  ctx.lineTo(-7, -150);
  ctx.lineTo(9, -150);
  ctx.lineTo(13, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#5a3e2a';
  ctx.lineWidth = 6;
  [
    [0, -140, -50, -200],
    [2, -150, 46, -215],
  ].forEach(([x0, y0, x1, y1]) => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  });
  // Back clumps darker, front ones lighter: the crown reads as round.
  for (let i = 0; i < 30; i++) {
    const a = random() * Math.PI * 2;
    const r = random() * 82;
    const x = Math.cos(a) * r * 1.15;
    const y = -232 + Math.sin(a) * r * 0.85;
    clump(x, y, 26 + random() * 16, shade2(leaf, i < 12 ? -0.18 : (y + 232) / 300));
  }
  if (blossom !== undefined) {
    for (let i = 0; i < 140; i++) {
      const a = random() * Math.PI * 2;
      const r = random() * 105;
      ctx.fillStyle = css(blossom, (random() - 0.4) * 0.3, 0.9);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 1.1, -232 + Math.sin(a) * r * 0.8, 3 + random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function shade2(color: number, amount: number): number {
  const target = amount > 0 ? 255 : 0;
  const t = Math.min(1, Math.abs(amount));
  const mix = (c: number) => Math.round(c + (target - c) * t);
  return (mix((color >> 16) & 255) << 16) | (mix((color >> 8) & 255) << 8) | mix(color & 255);
}

// A long planter of flowers by the wall. Texture origin: bottom middle (95, 100).
function paintPlanter(ctx: Ctx, street: StreetTheme): void {
  ctx.translate(95, 100);
  const random = seeded(41);
  floorShadow(ctx, 4, -2, 92, 12, 0.35);
  // Greenery and flowers spilling over the top.
  for (let i = 0; i < 26; i++) {
    const x = -78 + random() * 156;
    const y = -52 - random() * 26;
    ctx.fillStyle = css(0x4f8a3c, (random() - 0.5) * 0.3);
    ellipse(ctx, x, y, 12 + random() * 8, 9 + random() * 6);
    ctx.fill();
  }
  const flowers = [0xe8475a, 0xf6c445, 0xf2f2ee, 0xd85aa0];
  for (let i = 0; i < 22; i++) {
    const x = -74 + random() * 148;
    const y = -58 - random() * 26;
    const color = flowers[i % flowers.length];
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      ctx.fillStyle = css(color, p === 0 ? 0.15 : 0);
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 3.5, y + Math.sin(a) * 3.5, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.arc(x, y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  // The trough.
  ctx.fillStyle = vGradient(ctx, -54, 0, [
    [0, css(street.trim, -0.05)],
    [1, css(street.trim, -0.4)],
  ]);
  roundRect(ctx, -86, -54, 172, 54, [3, 3, 6, 6]);
  ctx.fill();
  ctx.fillStyle = vGradient(ctx, -60, -50, [
    [0, css(street.trim, 0.2)],
    [1, css(street.trim, -0.15)],
  ]);
  roundRect(ctx, -90, -60, 180, 11, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.fillRect(-60, -46, 2, 44);
  ctx.fillRect(58, -46, 2, 44);
}

// Texture origin: bottom middle (30, 84).
function paintBin(ctx: Ctx): void {
  ctx.translate(30, 84);
  floorShadow(ctx, 3, -2, 24, 6, 0.35);
  ctx.fillStyle = hGradient(ctx, -20, 20, [
    [0, '#1f2a24'],
    [0.4, '#4a5d52'],
    [1, '#18201b'],
  ]);
  roundRect(ctx, -19, -66, 38, 64, [3, 3, 6, 6]);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let x = -14; x < 16; x += 7) ctx.fillRect(x, -60, 3, 52);
  ctx.fillStyle = hGradient(ctx, -23, 23, [
    [0, '#26302a'],
    [0.4, '#5d7064'],
    [1, '#1c241f'],
  ]);
  roundRect(ctx, -23, -76, 46, 12, 5);
  ctx.fill();
}

// A short iron bollard at the far curb. Texture origin: bottom middle (20, 64).
function paintBollard(ctx: Ctx): void {
  ctx.translate(20, 64);
  floorShadow(ctx, 3, -2, 15, 5, 0.35);
  ctx.fillStyle = hGradient(ctx, -9, 9, [
    [0, '#1b1f22'],
    [0.4, '#535a60'],
    [1, '#15181a'],
  ]);
  roundRect(ctx, -8, -52, 16, 52, [8, 8, 2, 2]);
  ctx.fill();
  ctx.fillStyle = '#c9a54a';
  ctx.fillRect(-8, -40, 16, 4);
}
