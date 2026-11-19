import Phaser from 'phaser';
import { GAME_WIDTH, PALETTE } from '../config';
import { CASHIER_DESK, DISHPIT, DOOR_WIDTH, DOOR_X, FRONT, KITCHEN, POSTER, ROOM, SEAT_OFFSET_X, STOVES, TABLES, depthScale } from './layout';
import {
  type Ctx,
  ART_RES,
  addArt,
  css,
  ellipse,
  floorShadow,
  hGradient,
  paintTexture,
  radial,
  rgba,
  roundRect,
  seeded,
  vGradient,
} from './paint';
import { ROOM_MARGIN } from './RoomCamera';
import type { CityTheme } from './themes';

export interface RoomArt {
  // One per seat, in seat order: table index * 2, left chair first.
  chairs: Phaser.GameObjects.Image[];
  tables: Phaser.GameObjects.Image[];
}

// The painted background reaches past the room so zooming out shows more wall and floor.
const BG_TOP = ROOM.top - ROOM_MARGIN;
const BG_BOTTOM = ROOM.bottom + ROOM_MARGIN;
const TILE = 45;
const TILE_TOP = ROOM.wallBottom - 150;
const BASEBOARD = 16;
const WINDOW = { left: 40, right: 230, top: 222, bottom: 306 } as const;
const SCONCES = [268, 542];
const WARM_LIGHT = 0xffd99a;
// The side walls: narrow strips at both edges of the frame. Their floor lines run toward VANISH,
// so the strip is SIDE_WIDTH wide at the back wall and shrinks to nothing as the line leaves the frame.
const SIDE_WIDTH = 92;
// Warm light from the ceiling falls in pools over each column of tables (the lamps themselves
// are above the frame).
const PENDANTS = [{ x: 440 }, { x: 660 }, { x: 880 }];

// The room is painted once per city: a background texture behind everyone, and furniture as
// separate images whose depth is their floor position, so people walk in front of or behind them.
export function drawRoom(scene: Phaser.Scene, theme: CityTheme): RoomArt {
  const key = themeKey(theme);
  addArt(scene, 0, BG_TOP, paintTexture(scene, `${key}-bg`, GAME_WIDTH, BG_BOTTOM - BG_TOP, (ctx) => paintBackground(ctx, theme)), 0, 0).setDepth(
    -1000,
  );
  // The landmark is vector art drawn by the theme; glass shine goes on top of it.
  const landmark = scene.add.graphics().setDepth(-999);
  landmark.fillStyle(theme.sky, 1);
  theme.landmark(landmark, POSTER.x, POSTER.y);
  addArt(scene, POSTER.x, POSTER.y, paintTexture(scene, 'poster-glass', POSTER.width, POSTER.height, paintGlass), POSTER.width / 2, POSTER.height / 2).setDepth(
    -998,
  );

  const kitchen = paintTexture(scene, 'kitchen-counter', KITCHEN.right - KITCHEN.left + 24, 96, paintKitchenCounter);
  addArt(scene, KITCHEN.left - 12, KITCHEN.counterY - 80, kitchen, 0, 0).setDepth(KITCHEN.counterY);
  const dishpit = paintTexture(scene, 'dishpit-counter', DISHPIT.right - DISHPIT.left + 12, 102, paintDishpitCounter);
  addArt(scene, DISHPIT.left - 6, DISHPIT.counterY - 94, dishpit, 0, 0).setDepth(DISHPIT.counterY);
  const desk = paintTexture(scene, `${key}-desk`, 200, 124, (ctx) => paintCashierDesk(ctx, theme));
  addArt(scene, CASHIER_DESK.x, CASHIER_DESK.y, desk, 100, 64).setDepth(CASHIER_DESK.y + 40);

  const chairKey = paintTexture(scene, 'chair', 64, 92, paintChair);
  const art: RoomArt = { chairs: [], tables: [] };
  TABLES.forEach((t) => {
    // Chairs sit behind the table top; the table itself is above seated customers' legs.
    const scale = depthScale(t.y) / ART_RES;
    // Chairs face the table: the left one looks right, the right one is the same picture flipped.
    [-1, 1].forEach((side) =>
      art.chairs.push(addArt(scene, t.x + side * SEAT_OFFSET_X, t.y, chairKey, 32, 80).setDepth(t.y - 30).setScale(scale).setFlipX(side > 0)),
    );
    art.tables.push(addArt(scene, t.x, t.y, tableTexture(scene, theme, t.y, false), TABLE_ART.ox, TABLE_ART.oy).setDepth(t.y + 1).setScale(scale));
  });
  return art;
}

// One table texture per row: farther rows are flatter. The fancy look (section tier 1) paints
// its own pieces over the same top.
export function tableTexture(scene: Phaser.Scene, theme: CityTheme, y: number, fancy: boolean, decorate?: (ctx: Ctx) => void): string {
  const tilt = tableTilt(y);
  const key = `${themeKey(theme)}-table-${fancy ? 'fancy-' : ''}${Math.round(tilt * 100)}`;
  return paintTexture(scene, key, TABLE_ART.w, TABLE_ART.h, (ctx) => {
    paintTable(ctx, fancy ? { ...theme, accent: 0xd4a437 } : theme, tilt);
    decorate?.(ctx);
  });
}

function themeKey(theme: CityTheme): string {
  return `room-${theme.wall.toString(16)}-${theme.floor.toString(16)}-${theme.accent.toString(16)}-${theme.tileA.toString(16)}`;
}

// --- Background ------------------------------------------------------------------------

function paintBackground(ctx: Ctx, theme: CityTheme): void {
  ctx.translate(0, -BG_TOP);
  paintWall(ctx, theme);
  paintWindow(ctx, theme);
  paintPosterFrame(ctx, theme);
  paintKitchenBack(ctx);
  paintFaucet(ctx);
  SCONCES.forEach((x) => paintSconce(ctx, x, POSTER.y - 6));
  paintFloor(ctx, theme);
  paintSideWalls(ctx, theme);
  paintDoor(ctx);
  paintFurnitureShadows(ctx);
  paintAtmosphere(ctx);
  PENDANTS.forEach((lamp) => paintLightPool(ctx, lamp));
}

function paintWall(ctx: Ctx, theme: CityTheme): void {
  const span = ROOM.wallBottom - BG_TOP;
  const at = (y: number) => (y - BG_TOP) / span;
  ctx.fillStyle = vGradient(ctx, BG_TOP, ROOM.wallBottom, [
    [0, css(theme.wall, -0.3)],
    [at(ROOM.top), css(theme.wall, -0.12)],
    [at(ROOM.top + 120), css(theme.wall, 0.04)],
    [1, css(theme.wall, -0.08)],
  ]);
  ctx.fillRect(0, BG_TOP, GAME_WIDTH, span);
  // Faint wallpaper stripes.
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let x = 0; x < GAME_WIDTH; x += 40) ctx.fillRect(x, BG_TOP, 16, TILE_TOP - BG_TOP);

  // Wainscot panels below the tiles.
  const panelTop = TILE_TOP + TILE + 8;
  const panelBottom = ROOM.wallBottom - BASEBOARD;
  ctx.fillStyle = css(theme.wall, -0.14);
  ctx.fillRect(0, panelTop, GAME_WIDTH, panelBottom - panelTop);
  for (let x = 12; x < GAME_WIDTH; x += 118) {
    const w = 100;
    const y = panelTop + 12;
    const h = panelBottom - panelTop - 22;
    ctx.fillStyle = css(theme.wall, -0.08);
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = css(theme.wall, -0.26);
    ctx.fillRect(x, y, w, 3);
    ctx.fillRect(x, y, 3, h);
    ctx.fillStyle = css(theme.wall, 0.12);
    ctx.fillRect(x, y + h - 3, w, 3);
    ctx.fillRect(x + w - 3, y, 3, h);
  }

  // Glazed tiles with a bevel and a glossy corner.
  for (let i = 0, x = 0; x < GAME_WIDTH; i++, x += TILE) {
    const color = i % 2 === 0 ? theme.tileA : theme.tileB;
    ctx.fillStyle = vGradient(ctx, TILE_TOP, TILE_TOP + TILE, [
      [0, css(color, 0.12)],
      [1, css(color, -0.12)],
    ]);
    ctx.fillRect(x, TILE_TOP, TILE, TILE);
    ctx.fillStyle = css(color, 0.3, 0.9);
    ctx.fillRect(x + 1, TILE_TOP + 1, TILE - 2, 3);
    ctx.fillRect(x + 1, TILE_TOP + 1, 3, TILE - 2);
    ctx.fillStyle = css(color, -0.35, 0.9);
    ctx.fillRect(x + 1, TILE_TOP + TILE - 4, TILE - 2, 3);
    ctx.fillRect(x + TILE - 4, TILE_TOP + 1, 3, TILE - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.moveTo(x + 6, TILE_TOP + 6);
    ctx.lineTo(x + 22, TILE_TOP + 6);
    ctx.lineTo(x + 6, TILE_TOP + 22);
    ctx.fill();
  }
  // Wooden rails above and below the tiles.
  paintRail(ctx, TILE_TOP - 8, 8, theme.floorDark);
  paintRail(ctx, TILE_TOP + TILE, 10, theme.floorDark);
  // Baseboard, with a soft shadow on the wall above it.
  ctx.fillStyle = vGradient(ctx, panelBottom - 14, panelBottom, [
    [0, 'rgba(0,0,0,0)'],
    [1, 'rgba(0,0,0,0.12)'],
  ]);
  ctx.fillRect(0, panelBottom - 14, GAME_WIDTH, 14);
  paintRail(ctx, panelBottom, BASEBOARD, theme.floorDark);
}

function paintRail(ctx: Ctx, y: number, height: number, color: number): void {
  ctx.fillStyle = vGradient(ctx, y, y + height, [
    [0, css(color, 0.25)],
    [0.35, css(color, 0)],
    [1, css(color, -0.35)],
  ]);
  ctx.fillRect(0, y, GAME_WIDTH, height);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, y + height, GAME_WIDTH, 3);
}

// A window over the dish pit with a glimpse of the city sky.
function paintWindow(ctx: Ctx, theme: CityTheme): void {
  const { left, right, top, bottom } = WINDOW;
  const w = right - left;
  const h = bottom - top;
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  roundRect(ctx, left - 6, top - 4, w + 14, h + 16, 8);
  ctx.fill();
  ctx.fillStyle = hGradient(ctx, left - 10, right + 10, [
    [0, css(0x7a4a2a, 0.15)],
    [0.5, css(0x7a4a2a, 0)],
    [1, css(0x7a4a2a, -0.25)],
  ]);
  roundRect(ctx, left - 10, top - 10, w + 20, h + 20, 8);
  ctx.fill();
  ctx.fillStyle = vGradient(ctx, top, bottom, [
    [0, css(theme.sky, -0.1)],
    [1, css(theme.sky, 0.35)],
  ]);
  ctx.fillRect(left, top, w, h);
  // Clouds.
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  [
    [left + 50, top + 30, 18],
    [left + 72, top + 26, 22],
    [left + 96, top + 32, 16],
    [left + 140, top + 56, 12],
    [left + 156, top + 52, 15],
  ].forEach(([x, y, r]) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });
  // Window bars and glass shine.
  ctx.fillStyle = css(0x7a4a2a, -0.1);
  ctx.fillRect(left + w / 2 - 4, top, 8, h);
  ctx.fillRect(left, top + h / 2 - 3, w, 6);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.moveTo(left + 14, top);
  ctx.lineTo(left + 40, top);
  ctx.lineTo(left + 10, bottom);
  ctx.lineTo(left - 16 + 14, bottom);
  ctx.closePath();
  ctx.fill();
  // Sill.
  ctx.fillStyle = vGradient(ctx, bottom + 6, bottom + 18, [
    [0, css(0xf3e6d0, 0.3)],
    [1, css(0xf3e6d0, -0.2)],
  ]);
  roundRect(ctx, left - 18, bottom + 6, w + 36, 12, 4);
  ctx.fill();
}

function paintPosterFrame(ctx: Ctx, theme: CityTheme): void {
  const { x, y, width, height } = POSTER;
  const left = x - width / 2;
  const top = y - height / 2;
  ctx.fillStyle = 'rgba(40,20,5,0.25)';
  roundRect(ctx, left + 4, top + 8, width + 4, height + 6, 10);
  ctx.fill();
  ctx.fillStyle = vGradient(ctx, top, top + height, [
    [0, css(0x8a5530, 0.15)],
    [1, css(0x5a3218, -0.1)],
  ]);
  roundRect(ctx, left, top, width, height, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,230,190,0.35)';
  ctx.lineWidth = 2;
  roundRect(ctx, left + 2, top + 2, width - 4, height - 4, 7);
  ctx.stroke();
  ctx.fillStyle = vGradient(ctx, top + 10, top + height - 10, [
    [0, css(theme.sky, -0.08)],
    [1, css(theme.sky, 0.25)],
  ]);
  ctx.fillRect(left + 10, top + 10, width - 20, height - 20);
  // Inner shadow where the picture meets the frame.
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 3;
  ctx.strokeRect(left + 11.5, top + 11.5, width - 23, height - 23);
}

function paintGlass(ctx: Ctx): void {
  const { width, height } = POSTER;
  ctx.fillStyle = hGradient(ctx, 10, width - 10, [
    [0, 'rgba(255,255,255,0)'],
    [0.3, 'rgba(255,255,255,0.18)'],
    [0.42, 'rgba(255,255,255,0)'],
    [0.6, 'rgba(255,255,255,0.08)'],
    [0.66, 'rgba(255,255,255,0)'],
  ]);
  ctx.fillRect(10, 10, width - 20, height - 20);
}

function paintSconce(ctx: Ctx, x: number, y: number): void {
  // Warm glow on the wall first, then the fixture.
  ctx.fillStyle = radial(ctx, x, y - 6, 0, 110, [
    [0, rgba(WARM_LIGHT, 0.55)],
    [0.4, rgba(WARM_LIGHT, 0.18)],
    [1, rgba(WARM_LIGHT, 0)],
  ]);
  ctx.fillRect(x - 110, y - 116, 220, 220);
  ctx.fillStyle = css(0xb8862b, 0);
  roundRect(ctx, x - 5, y + 2, 10, 26, 4);
  ctx.fill();
  ctx.fillStyle = vGradient(ctx, y - 22, y + 6, [
    [0, '#fff6dc'],
    [1, '#f2c66b'],
  ]);
  ctx.beginPath();
  ctx.moveTo(x - 12, y - 22);
  ctx.lineTo(x + 12, y - 22);
  ctx.lineTo(x + 20, y + 6);
  ctx.lineTo(x - 20, y + 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(x - 9, y - 19, 5, 20);
}

function paintKitchenBack(ctx: Ctx): void {
  const left = KITCHEN.left;
  const right = KITCHEN.right;
  const top = ROOM.top + 16;
  // Glow of the hood light on the tiles below it.
  ctx.fillStyle = radial(ctx, (left + right) / 2, top + 100, 0, 260, [
    [0, 'rgba(255,240,200,0.35)'],
    [1, 'rgba(255,240,200,0)'],
  ]);
  ctx.fillRect(left - 40, top, right - left + 80, 280);
  // Range hood: a brushed steel trapezoid with a lip.
  const steel = hGradient(ctx, left, right, [
    [0, '#8e959c'],
    [0.18, '#e9ecef'],
    [0.45, '#c2c8ce'],
    [0.75, '#eef1f3'],
    [1, '#878e95'],
  ]);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(left + 6, top + 78, right - left - 4, 12);
  ctx.fillStyle = steel;
  ctx.beginPath();
  ctx.moveTo(left + 50, top);
  ctx.lineTo(right - 50, top);
  ctx.lineTo(right, top + 62);
  ctx.lineTo(left, top + 62);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let x = left + 120; x < right - 110; x += 26) ctx.fillRect(x, top + 22, 14, 4);
  ctx.fillStyle = vGradient(ctx, top + 62, top + 80, [
    [0, '#f4f6f8'],
    [1, '#9aa1a8'],
  ]);
  ctx.fillRect(left - 4, top + 62, right - left + 8, 18);
  // Shelf with jars.
  const shelfY = ROOM.top + 150;
  ctx.fillStyle = vGradient(ctx, shelfY + 12, shelfY + 30, [
    [0, 'rgba(0,0,0,0.22)'],
    [1, 'rgba(0,0,0,0)'],
  ]);
  ctx.fillRect(left + 20, shelfY + 12, right - left - 40, 18);
  [0xc0392b, 0xf4b400, 0x4a8c3a, 0x1f6f8b, 0xe08e0b].forEach((color, i) => paintJar(ctx, left + 68 + i * 90, shelfY, color));
  ctx.fillStyle = vGradient(ctx, shelfY, shelfY + 12, [
    [0, css(0x9a5530, 0.2)],
    [1, css(0x9a5530, -0.3)],
  ]);
  ctx.fillRect(left + 20, shelfY, right - left - 40, 12);
}

function paintJar(ctx: Ctx, x: number, bottom: number, color: number): void {
  const w = 38;
  const h = 40;
  ctx.fillStyle = hGradient(ctx, x - w / 2, x + w / 2, [
    [0, css(color, -0.3)],
    [0.35, css(color, 0.15)],
    [1, css(color, -0.4)],
  ]);
  roundRect(ctx, x - w / 2, bottom - h, w, h, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  roundRect(ctx, x - w / 2 + 6, bottom - h + 8, 5, h - 16, 3);
  ctx.fill();
  ctx.fillStyle = vGradient(ctx, bottom - h - 8, bottom - h + 2, [
    [0, '#8a6b4a'],
    [1, '#5e4630'],
  ]);
  roundRect(ctx, x - w / 2 - 2, bottom - h - 8, w + 4, 10, 3);
  ctx.fill();
}

function paintFaucet(ctx: Ctx): void {
  const metal = (x0: number, x1: number) =>
    hGradient(ctx, x0, x1, [
      [0, '#9aa1a8'],
      [0.4, '#f4f6f8'],
      [1, '#7d848b'],
    ]);
  const x = DISHPIT.left + 140;
  const y = DISHPIT.counterY - 132;
  ctx.fillStyle = metal(x, x + 12);
  roundRect(ctx, x, y, 12, 64, 4);
  ctx.fill();
  ctx.fillStyle = vGradient(ctx, y, y + 12, [
    [0, '#f4f6f8'],
    [1, '#8a9198'],
  ]);
  roundRect(ctx, x - 34, y, 46, 12, 5);
  ctx.fill();
}

// Floor boards run toward the viewer and narrow toward a vanishing point above the room, so
// the floor reads as a surface going back into the picture.
const VANISH = { x: GAME_WIDTH / 2, y: -700 };
const BOARD_WIDTH = 96; // at the bottom edge of the painted floor
const BOARD_LENGTH = 150; // at the bottom edge; shorter farther back

function paintFloor(ctx: Ctx, theme: CityTheme): void {
  const random = seeded(7);
  const depth = (y: number) => (y - VANISH.y) / (BG_BOTTOM - VANISH.y);
  // x of a board edge (given by its x at the bottom) at height y.
  const edgeX = (bottomX: number, y: number) => VANISH.x + (bottomX - VANISH.x) * depth(y);
  const top = ROOM.wallBottom;
  for (let i = 0, bx = -1400; bx < GAME_WIDTH + 1400; i++, bx += BOARD_WIDTH) {
    const left = bx;
    const right = bx + BOARD_WIDTH;
    if (edgeX(right, top) < 0 && edgeX(right, BG_BOTTOM) < 0) continue;
    if (edgeX(left, top) > GAME_WIDTH && edgeX(left, BG_BOTTOM) > GAME_WIDTH) continue;
    const base = i % 2 === 0 ? theme.floor : theme.floorDark;
    let y = top - random() * BOARD_LENGTH * depth(top);
    while (y < BG_BOTTOM) {
      const y0 = Math.max(y, top);
      const y1 = Math.min(y + BOARD_LENGTH * depth(y) * (0.8 + random() * 0.6), BG_BOTTOM);
      const tone = (random() - 0.5) * 0.14;
      ctx.fillStyle = hGradient(ctx, edgeX(left, y1), edgeX(right, y1), [
        [0, css(base, tone + 0.07)],
        [1, css(base, tone - 0.05)],
      ]);
      ctx.beginPath();
      ctx.moveTo(edgeX(left, y0), y0);
      ctx.lineTo(edgeX(right, y0), y0);
      ctx.lineTo(edgeX(right, y1), y1);
      ctx.lineTo(edgeX(left, y1), y1);
      ctx.closePath();
      ctx.fill();
      // Grain along the board.
      ctx.strokeStyle = css(base, -0.3, 0.1);
      ctx.lineWidth = 1.2;
      for (let g = 0; g < 2; g++) {
        const f = 0.3 + g * 0.35 + random() * 0.1;
        ctx.beginPath();
        ctx.moveTo(edgeX(left + BOARD_WIDTH * f, y0), y0 + 3);
        ctx.lineTo(edgeX(left + BOARD_WIDTH * (f + 0.04), y1), y1 - 3);
        ctx.stroke();
      }
      // Board end.
      ctx.fillStyle = 'rgba(40,20,8,0.3)';
      ctx.fillRect(edgeX(left, y1), y1 - 1.5, edgeX(right, y1) - edgeX(left, y1), 1.5 + depth(y1));
      y = y1;
    }
    // Seams along the board: a dark gap and a lit edge.
    ctx.strokeStyle = 'rgba(40,20,8,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(edgeX(right, top), top);
    ctx.lineTo(edgeX(right, BG_BOTTOM), BG_BOTTOM);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,220,0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(edgeX(left, top) + 1.5, top);
    ctx.lineTo(edgeX(left, BG_BOTTOM) + 2, BG_BOTTOM);
    ctx.stroke();
  }
  // Far floor is darker, near floor brighter; the wall casts a soft shadow onto it.
  ctx.fillStyle = vGradient(ctx, ROOM.wallBottom, BG_BOTTOM, [
    [0, 'rgba(20,10,0,0.32)'],
    [0.3, 'rgba(20,10,0,0.06)'],
    [0.6, 'rgba(255,240,220,0.05)'],
    [1, 'rgba(20,10,0,0.25)'],
  ]);
  ctx.fillRect(0, ROOM.wallBottom, GAME_WIDTH, BG_BOTTOM - ROOM.wallBottom);
  ctx.fillStyle = vGradient(ctx, ROOM.wallBottom, ROOM.wallBottom + 60, [
    [0, 'rgba(20,10,0,0.4)'],
    [1, 'rgba(20,10,0,0)'],
  ]);
  ctx.fillRect(0, ROOM.wallBottom, GAME_WIDTH, 60);
  // Warm pools of light around the tables, flattened by the perspective.
  TABLES.forEach((t) => {
    ctx.save();
    ctx.translate(t.x, t.y + 20);
    ctx.scale(1, 0.6);
    ctx.fillStyle = radial(ctx, 0, 0, 0, 200, [
      [0, rgba(WARM_LIGHT, 0.26)],
      [1, rgba(WARM_LIGHT, 0)],
    ]);
    ctx.fillRect(-200, -200, 400, 400);
    ctx.restore();
  });
  // Darker edges keep the eye in the middle of the room.
  ctx.fillStyle = hGradient(ctx, 0, GAME_WIDTH, [
    [0, 'rgba(20,10,0,0.25)'],
    [0.15, 'rgba(20,10,0,0)'],
    [0.85, 'rgba(20,10,0,0)'],
    [1, 'rgba(20,10,0,0.25)'],
  ]);
  ctx.fillRect(0, ROOM.wallBottom, GAME_WIDTH, BG_BOTTOM - ROOM.wallBottom);
}

// Daylight from the open front door falls in a soft fan across the floor.
function paintDoor(ctx: Ctx): void {
  const top = FRONT.floorEnd;
  ctx.fillStyle = vGradient(ctx, top - 260, top, [
    [0, 'rgba(255,248,225,0)'],
    [1, 'rgba(255,248,225,0.3)'],
  ]);
  ctx.beginPath();
  ctx.moveTo(DOOR_X - DOOR_WIDTH / 2, top);
  ctx.lineTo(DOOR_X + DOOR_WIDTH / 2, top);
  ctx.lineTo(DOOR_X + DOOR_WIDTH / 2 + 40, top - 260);
  ctx.lineTo(DOOR_X - DOOR_WIDTH / 2 - 70, top - 260);
  ctx.closePath();
  ctx.fill();
}

function paintFurnitureShadows(ctx: Ctx): void {
  // Light comes from the front left, so shadows fall a little to the right and back.
  TABLES.forEach((t) => {
    const k = depthScale(t.y);
    floorShadow(ctx, t.x + 16 * k, t.y + 46 * k, 104 * k, 24 * k, 0.4);
    floorShadow(ctx, t.x + 6 * k, t.y + 48 * k, 44 * k, 9 * k, 0.5);
  });
  floorShadow(ctx, CASHIER_DESK.x + 16, CASHIER_DESK.y + 54, 124, 20, 0.4);
  // Contact shadows in front of the counters.
  [
    [KITCHEN.left - 10, KITCHEN.right + 10],
    [DISHPIT.left - 6, DISHPIT.right + 6],
  ].forEach(([x0, x1]) => {
    ctx.fillStyle = vGradient(ctx, KITCHEN.counterY, KITCHEN.counterY + 44, [
      [0, 'rgba(20,10,0,0.5)'],
      [0.4, 'rgba(20,10,0,0.2)'],
      [1, 'rgba(20,10,0,0)'],
    ]);
    ctx.fillRect(x0, KITCHEN.counterY, x1 - x0, 44);
  });
}

// The two side walls as slanted strips with the same rails and panels as the back wall, so the
// room has corners. The left one is on the shadow side and is darker.
function paintSideWalls(ctx: Ctx, theme: CityTheme): void {
  const vx = VANISH.x;
  const vy = VANISH.y;
  // Maps a point on the back wall's edge (x = SIDE_WIDTH, height y) to where it lies at x on the side wall.
  const at = (x: number, y: number): [number, number] => [x, vy + (y - vy) * ((vx - x) / (vx - SIDE_WIDTH))];
  const band = (y0: number, y1: number, fill: string | CanvasGradient) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(...at(SIDE_WIDTH, y0));
    ctx.lineTo(...at(0, y0));
    ctx.lineTo(...at(0, y1));
    ctx.lineTo(...at(SIDE_WIDTH, y1));
    ctx.closePath();
    ctx.fill();
  };
  const panelTop = TILE_TOP + TILE + 8;
  const panelBottom = ROOM.wallBottom - BASEBOARD;
  const top = ROOM.top + 10;
  [false, true].forEach((right) => {
    ctx.save();
    if (right) {
      ctx.translate(GAME_WIDTH, 0);
      ctx.scale(-1, 1);
    }
    const lit = right ? 0.06 : -0.2;
    const across = (a: string, b: string) =>
      hGradient(ctx, 0, SIDE_WIDTH, [
        [0, a],
        [1, b],
      ]);
    // Plain wall above the tiles, rails, tiles and wainscot below.
    band(top, TILE_TOP - 8, across(css(theme.wall, lit - 0.14), css(theme.wall, lit)));
    band(TILE_TOP - 8, TILE_TOP, css(theme.floorDark, lit));
    band(TILE_TOP, TILE_TOP + TILE, across(css(theme.tileA, lit - 0.12), css(theme.tileA, lit)));
    band(TILE_TOP + TILE, TILE_TOP + TILE + 10, css(theme.floorDark, lit));
    band(panelTop, panelBottom, across(css(theme.wall, lit - 0.3), css(theme.wall, lit - 0.14)));
    band(panelBottom, ROOM.wallBottom, across(css(theme.floorDark, lit - 0.2), css(theme.floorDark, lit)));
    // Tile joints and panel lines converge on the vanishing point.
    ctx.strokeStyle = 'rgba(0,0,0,0.14)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 3; i++) {
      const x = i * 30;
      ctx.beginPath();
      ctx.moveTo(...at(x, TILE_TOP));
      ctx.lineTo(...at(x, TILE_TOP + TILE));
      ctx.moveTo(...at(x, panelTop + 12));
      ctx.lineTo(...at(x, panelBottom - 10));
      ctx.stroke();
    }
    // The cut end of the building's side wall above it (concrete).
    const t0 = at(SIDE_WIDTH, top);
    const t1 = at(0, top);
    ctx.fillStyle = across('#6f6a62', '#8a847a');
    ctx.beginPath();
    ctx.moveTo(0, ROOM.top - 20);
    ctx.lineTo(SIDE_WIDTH, ROOM.top - 20);
    ctx.lineTo(...t0);
    ctx.lineTo(...t1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(...t0);
    ctx.lineTo(...t1);
    ctx.stroke();
    // Ambient occlusion where the walls meet each other and the floor.
    ctx.fillStyle = hGradient(ctx, SIDE_WIDTH - 4, SIDE_WIDTH + 34, [
      [0, 'rgba(20,10,0,0.3)'],
      [1, 'rgba(20,10,0,0)'],
    ]);
    ctx.fillRect(SIDE_WIDTH - 4, top, 38, ROOM.wallBottom - top);
    const foot = at(0, ROOM.wallBottom);
    [
      [18, 0.1],
      [9, 0.16],
      [3, 0.3],
    ].forEach(([w, a]) => {
      ctx.strokeStyle = `rgba(20,10,0,${a})`;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(SIDE_WIDTH + w / 2, ROOM.wallBottom + 1);
      ctx.lineTo(foot[0] + w / 2, foot[1] + 1);
      ctx.stroke();
    });
    ctx.strokeStyle = 'rgba(255,235,210,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(...at(SIDE_WIDTH, panelBottom));
    ctx.lineTo(...at(0, panelBottom));
    ctx.stroke();
    ctx.restore();
  });
}

// Light and mood over the whole room: far things a little hazy and grey, and a warm vignette.
function paintAtmosphere(ctx: Ctx): void {
  ctx.fillStyle = vGradient(ctx, ROOM.wallBottom, ROOM.wallBottom + 260, [
    [0, 'rgba(110,100,115,0.18)'],
    [1, 'rgba(110,100,115,0)'],
  ]);
  ctx.fillRect(0, ROOM.wallBottom, GAME_WIDTH, 260);
  ctx.fillStyle = radial(ctx, GAME_WIDTH / 2, (ROOM.wallBottom + ROOM.bottom) / 2, 380, 780, [
    [0, 'rgba(40,15,0,0)'],
    [1, 'rgba(40,15,0,0.3)'],
  ]);
  ctx.fillRect(0, ROOM.top, GAME_WIDTH, BG_BOTTOM - ROOM.top);
  // The low front wall darkens the floor right behind it, except where the door lets light in.
  ctx.fillStyle = vGradient(ctx, FRONT.floorEnd - 46, FRONT.floorEnd, [
    [0, 'rgba(20,10,0,0)'],
    [1, 'rgba(20,10,0,0.4)'],
  ]);
  ctx.fillRect(0, FRONT.floorEnd - 46, DOOR_X - DOOR_WIDTH / 2 - 6, 46);
  ctx.fillRect(DOOR_X + DOOR_WIDTH / 2 + 6, FRONT.floorEnd - 46, GAME_WIDTH - DOOR_X - DOOR_WIDTH / 2 - 6, 46);
}

// Warm pool of light on the floor and the tables under a pendant lamp, plus a faint reflection
// in the glossy floor.
function paintLightPool(ctx: Ctx, lamp: { x: number }): void {
  [650, 870].forEach((cy, i) => {
    ctx.save();
    ctx.translate(lamp.x, cy + 10);
    ctx.scale(1, 0.55);
    ctx.fillStyle = radial(ctx, 0, 0, 0, 150, [
      [0, rgba(WARM_LIGHT, i === 0 ? 0.22 : 0.18)],
      [1, rgba(WARM_LIGHT, 0)],
    ]);
    ctx.fillRect(-150, -150, 300, 300);
    ctx.restore();
  });
  ctx.fillStyle = vGradient(ctx, 700, 960, [
    [0, 'rgba(255,240,210,0)'],
    [0.5, 'rgba(255,240,210,0.07)'],
    [1, 'rgba(255,240,210,0)'],
  ]);
  ctx.beginPath();
  ctx.ellipse(lamp.x - 20, 830, 16, 130, 0, 0, Math.PI * 2);
  ctx.fill();
}

// --- Furniture -------------------------------------------------------------------------

// Texture origin is (KITCHEN.left - 12, counterY - 80) in world units.
function paintKitchenCounter(ctx: Ctx): void {
  const ox = KITCHEN.left - 12;
  const oy = KITCHEN.counterY - 80;
  ctx.translate(-ox, -oy);
  const left = KITCHEN.left;
  const right = KITCHEN.right;
  const width = right - left;
  const y = KITCHEN.counterY;
  // Front face: brushed steel cabinets with handles.
  ctx.fillStyle = vGradient(ctx, y - 56, y, [
    [0, '#a7adb3'],
    [0.5, '#8d9399'],
    [1, '#6f757b'],
  ]);
  ctx.fillRect(left, y - 56, width, 56);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let x = left; x < right; x += 6) ctx.fillRect(x, y - 56, 2, 56);
  for (let x = left + 10; x < right - 60; x += 125) {
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y - 48, 110, 32);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.strokeRect(x + 2, y - 46, 110, 32);
  }
  // Knobs under each burner.
  STOVES.forEach((s) =>
    [-34, 34].forEach((dx) => {
      ctx.fillStyle = radial(ctx, s.x + dx, y - 34, 0, 9, [
        [0, '#5b5f63'],
        [1, '#1f2123'],
      ], s.x + dx - 3, y - 37);
      ctx.beginPath();
      ctx.arc(s.x + dx, y - 34, 8, 0, Math.PI * 2);
      ctx.fill();
    }),
  );
  // Worktop seen from above (24 deep), brighter than the front, with a bright front edge.
  ctx.fillStyle = vGradient(ctx, y - 70, y - 56, [
    [0, '#aeb4ba'],
    [0.5, '#d4d9de'],
    [1, '#f7f9fb'],
  ]);
  ctx.fillRect(left, y - 70, width, 14);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(left, y - 70, width, 3);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(left, y - 58, width, 2);
  // Burners: cast iron rings on the worktop.
  STOVES.forEach((s) =>
    [-34, 34].forEach((dx) => {
      const bx = s.x + dx;
      const by = s.y + 8;
      ctx.fillStyle = '#2a2a2a';
      ellipse(ctx, bx, by, 27, 8);
      ctx.fill();
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 2;
      ellipse(ctx, bx, by, 17, 5);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,140,60,0.5)';
      ellipse(ctx, bx, by, 9, 2.5);
      ctx.stroke();
    }),
  );
  // Marble pass shelf in front, where plates wait.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(left - 10, y + 8, width + 20, 4);
  // The shelf's top is light, its front face darker.
  ctx.fillStyle = vGradient(ctx, y - 8, y + 2, [
    [0, '#fbf8f1'],
    [1, '#ffffff'],
  ]);
  roundRect(ctx, left - 10, y - 8, width + 20, 10, [4, 4, 0, 0]);
  ctx.fill();
  ctx.fillStyle = vGradient(ctx, y + 2, y + 9, [
    [0, '#d8d0c0'],
    [1, '#a89f8e'],
  ]);
  roundRect(ctx, left - 10, y + 2, width + 20, 7, [0, 0, 4, 4]);
  ctx.fill();
}

// Texture origin is (DISHPIT.left - 6, counterY - 94). The top surface is seen from above (y-88
// to y-64), props stand on it around y-74.
function paintDishpitCounter(ctx: Ctx): void {
  ctx.translate(-(DISHPIT.left - 6), -(DISHPIT.counterY - 94));
  const left = DISHPIT.left;
  const width = DISHPIT.right - left;
  const y = DISHPIT.counterY;
  const body = 0x7f98a6;
  // Front face, darker than the top.
  ctx.fillStyle = vGradient(ctx, y - 64, y, [
    [0, css(body, 0.0)],
    [1, css(body, -0.35)],
  ]);
  ctx.fillRect(left, y - 64, width, 64);
  ctx.strokeStyle = css(body, -0.4);
  ctx.lineWidth = 2;
  ctx.strokeRect(left + 12, y - 54, width / 2 - 18, 44);
  ctx.strokeRect(left + width / 2 + 6, y - 54, width / 2 - 18, 44);
  ctx.fillStyle = css(body, 0.35);
  ctx.fillRect(left + width / 2 - 20, y - 36, 12, 4);
  ctx.fillRect(left + width / 2 + 10, y - 36, 12, 4);
  // Top surface: lighter, with the back edge in shade and a bright front lip.
  ctx.fillStyle = vGradient(ctx, y - 74, y - 64, [
    [0, css(body, 0.25)],
    [1, css(body, 0.55)],
  ]);
  ctx.fillRect(left, y - 74, width, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(left, y - 74, width, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(left, y - 65, width, 2);
  // Sink basin sunk into the top, with water.
  ctx.fillStyle = vGradient(ctx, y - 74, y - 64, [
    [0, css(body, -0.5)],
    [1, css(body, -0.2)],
  ]);
  roundRect(ctx, left + 66, y - 74, 90, 10, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(190,230,245,0.7)';
  roundRect(ctx, left + 72, y - 72, 78, 5, 2);
  ctx.fill();
}

// Texture origin is the desk's anchor point (100, 64). The top is a surface seen from above
// (y-26 to y-2) and the register stands on it.
function paintCashierDesk(ctx: Ctx, theme: CityTheme): void {
  ctx.translate(100, 64);
  const wood = theme.floorDark;
  // Front panel, darker than the top.
  ctx.fillStyle = vGradient(ctx, -2, 52, [
    [0, css(wood, -0.05)],
    [1, css(wood, -0.4)],
  ]);
  roundRect(ctx, -90, -2, 180, 54, [0, 0, 10, 10]);
  ctx.fill();
  ctx.fillStyle = css(wood, -0.22);
  roundRect(ctx, -76, 8, 152, 34, 6);
  ctx.fill();
  ctx.fillStyle = css(wood, 0.1, 0.6);
  ctx.fillRect(-74, 40, 150, 2);
  // Top: a lit wooden surface with a rounded front edge.
  ctx.fillStyle = vGradient(ctx, -28, -2, [
    [0, css(0x7a4a2a, 0.05)],
    [1, css(0x7a4a2a, 0.35)],
  ]);
  roundRect(ctx, -96, -28, 192, 28, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(-92, -28, 184, 3);
  ctx.fillStyle = 'rgba(255,230,190,0.55)';
  ctx.fillRect(-92, -3, 184, 2);
  // Register standing on the top (its base at y-10) with a glowing display.
  ctx.save();
  ctx.translate(0, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ellipse(ctx, 4, -16, 38, 6);
  ctx.fill();
  ctx.fillStyle = vGradient(ctx, -62, -16, [
    [0, '#55595e'],
    [1, '#26282b'],
  ]);
  roundRect(ctx, -32, -62, 64, 46, 7);
  ctx.fill();
  ctx.fillStyle = radial(ctx, 0, -46, 0, 26, [
    [0, '#b8ffd6'],
    [1, '#4fbf8a'],
  ]);
  roundRect(ctx, -22, -55, 44, 15, 3);
  ctx.fill();
  ctx.fillStyle = '#8a8f94';
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) ctx.fillRect(-20 + c * 11, -35 + r * 8, 8, 5);
  ctx.restore();
}

// How flat a table top looks: tables farther back are seen more edge-on, so their tops are flatter.
export function tableTilt(y: number): number {
  const t = Math.min(1, Math.max(0, (y - ROOM.wallBottom) / (ROOM.bottom - ROOM.wallBottom)));
  return 0.33 + 0.15 * t;
}

// Table textures are 180x124 with the origin at the table's middle; the top surface's center sits
// `topY` above it.
export const TABLE_ART = { w: 180, h: 124, ox: 90, oy: 64, rx: 72, topY: -12 } as const;

// The camera looks down at the table: the top is an ellipse, the cloth hangs over its front edge
// and the pedestal shrinks away below. Light comes from the front left, so the right side of the
// cloth is darker.
export function paintTable(ctx: Ctx, theme: CityTheme, tilt = 0.42): void {
  ctx.translate(TABLE_ART.ox, TABLE_ART.oy);
  const { rx, topY: cy } = TABLE_ART;
  const ry = rx * tilt;
  const hem = 22;
  // Pedestal and foot.
  ctx.fillStyle = radial(ctx, 0, 48, 0, 34, [
    [0, '#6b4024'],
    [1, '#3d2210'],
  ]);
  ellipse(ctx, 0, 48, 32, 32 * tilt * 0.7);
  ctx.fill();
  ctx.fillStyle = hGradient(ctx, -9, 9, [
    [0, '#6a4020'],
    [0.35, '#a46a40'],
    [1, '#3d2210'],
  ]);
  ctx.fillRect(-8, cy + hem, 16, 48 - cy - hem);
  // Cloth drape: hangs from the top's rim down to a hem that follows the same ellipse.
  const rim = (a: number): [number, number] => [rx * Math.cos(a), cy + ry * Math.sin(a)];
  const hemAt = (a: number): [number, number] => [rx * Math.cos(a), cy + hem + ry * Math.sin(a) + Math.sin(a * 11) * 1.8];
  ctx.beginPath();
  ctx.moveTo(...rim(Math.PI));
  for (let i = 0; i <= 40; i++) ctx.lineTo(...hemAt(Math.PI - (i / 40) * Math.PI));
  for (let i = 0; i <= 40; i++) ctx.lineTo(...rim((i / 40) * Math.PI));
  ctx.closePath();
  ctx.fillStyle = hGradient(ctx, -rx, rx, [
    [0, css(PALETTE.cream, -0.02)],
    [0.45, css(PALETTE.cream, -0.12)],
    [1, css(PALETTE.cream, -0.4)],
  ]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Folds: soft vertical creases, darker on the shadow side.
  for (let i = 1; i < 12; i++) {
    const a = (i / 12) * Math.PI;
    const [x0, y0] = rim(a);
    const [x1, y1] = hemAt(a);
    ctx.strokeStyle = `rgba(60,30,10,${0.06 + (0.1 * (1 - Math.cos(a))) / 2})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1 + Math.cos(a) * 3, y1);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0 - 3, y0);
    ctx.lineTo(x1 - 3 + Math.cos(a) * 3, y1);
    ctx.stroke();
  }
  // Shadow under the tabletop's edge.
  ctx.fillStyle = vGradient(ctx, cy, cy + hem, [
    [0, 'rgba(40,15,0,0.28)'],
    [0.4, 'rgba(40,15,0,0)'],
  ]);
  ctx.fillRect(-rx - 4, cy, rx * 2 + 8, hem + ry + 6);
  // Colored band near the hem.
  ctx.strokeStyle = css(theme.accent, 0, 0.92);
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const [x, y] = hemAt(Math.PI - (i / 40) * Math.PI);
    if (i === 0) ctx.moveTo(x, y - 6);
    else ctx.lineTo(x, y - 6);
  }
  ctx.stroke();
  ctx.restore();
  // The top surface, with a visible edge thickness.
  ctx.fillStyle = hGradient(ctx, -rx, rx, [
    [0, css(PALETTE.cream, -0.12)],
    [1, css(PALETTE.cream, -0.36)],
  ]);
  ellipse(ctx, 0, cy + 3, rx + 1, ry + 1);
  ctx.fill();
  ctx.save();
  ctx.translate(0, cy);
  ctx.scale(1, tilt);
  ctx.fillStyle = radial(
    ctx,
    0,
    0,
    0,
    rx,
    [
      [0, '#ffffff'],
      [0.7, css(PALETTE.cream, 0.02)],
      [1, css(PALETTE.cream, -0.14)],
    ],
    -rx * 0.35,
    -rx * 0.1,
  );
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = css(theme.accent, 0, 0.85);
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(0, 0, rx - 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  // Highlight on the lit side.
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ellipse(ctx, -30, cy - ry * 0.45, 22, 2.5);
  ctx.fill();
  // Small vase with a flower at the back of the top.
  const vy = cy - ry * 0.25;
  ctx.fillStyle = 'rgba(40,20,5,0.22)';
  ellipse(ctx, 4, vy + 1, 10, 3);
  ctx.fill();
  ctx.strokeStyle = '#4a8c3a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, vy - 10);
  ctx.quadraticCurveTo(3, vy - 22, 1, vy - 30);
  ctx.stroke();
  ctx.fillStyle = css(theme.accent, 0.1);
  [0, 1, 2, 3, 4].forEach((i) => {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(1 + Math.cos(a) * 5, vy - 32 + Math.sin(a) * 5, 4.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath();
  ctx.arc(1, vy - 32, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hGradient(ctx, -7, 7, [
    [0, 'rgba(160,210,230,0.75)'],
    [0.4, 'rgba(240,250,255,0.92)'],
    [1, 'rgba(120,170,190,0.75)'],
  ]);
  roundRect(ctx, -6, vy - 14, 12, 15, 4);
  ctx.fill();
}

// The chair is seen from above and turned a little toward the viewer: the seat is a skewed
// quad, the back rises from its far-left edge and the front legs are the longest. It faces
// right; the chair on the other side of the table is the same picture flipped.
// Origin (32, 80): the floor under the middle of the seat. Points are in that frame.
export const CHAIR_SEAT: [number, number][] = [
  [-24, -24],
  [-2, -31],
  [24, -22],
  [2, -13],
];
export const CHAIR_BACK: [number, number][] = [
  [-24, -24],
  [-2, -31],
  [-2, -76],
  [-24, -69],
];

// Shrinks a polygon toward its center.
export function insetPoly(poly: [number, number][], f: number): [number, number][] {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  return poly.map(([x, y]) => [cx + (x - cx) * f, cy + (y - cy) * f]);
}

export function polyPath(ctx: Ctx, poly: [number, number][], dy = 0): void {
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y + dy) : ctx.lineTo(x, y + dy)));
  ctx.closePath();
}

export function paintChair(ctx: Ctx): void {
  ctx.translate(32, 80);
  floorShadow(ctx, 4, 0, 30, 8, 0.32);
  const [p1, p2, p3, p4] = CHAIR_SEAT;
  // Legs, back ones first and shorter (they are farther away).
  const leg = (x: number, y: number, len: number) => {
    ctx.fillStyle = hGradient(ctx, x - 3, x + 3, [
      [0, '#6a4020'],
      [0.4, '#9a6038'],
      [1, '#3d2210'],
    ]);
    ctx.fillRect(x - 3, y, 6, len);
  };
  leg(p2[0], p2[1] + 4, 16);
  leg(p1[0] + 3, p1[1] + 5, 18);
  leg(p3[0] - 3, p3[1] + 5, 18);
  leg(p4[0], p4[1] + 5, 20);
  // Backrest: a panel with two slats, lit from the left.
  polyPath(ctx, CHAIR_BACK);
  ctx.fillStyle = hGradient(ctx, -24, -2, [
    [0, '#b07848'],
    [1, '#7a4a28'],
  ]);
  ctx.fill();
  polyPath(ctx, insetPoly(CHAIR_BACK, 0.72));
  ctx.fillStyle = 'rgba(30,15,5,0.55)';
  ctx.fill();
  [0.4, 0.62].forEach((f) => {
    ctx.strokeStyle = '#a06a3a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-24, -69 + f * 45);
    ctx.lineTo(-2, -76 + f * 45);
    ctx.stroke();
  });
  // Top rail with a lit edge.
  ctx.strokeStyle = '#d29a62';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-24, -69);
  ctx.lineTo(-2, -76);
  ctx.stroke();
  // Seat edge (thickness) and top.
  ctx.fillStyle = hGradient(ctx, -24, 24, [
    [0, '#7a4a28'],
    [1, '#3d2210'],
  ]);
  ctx.beginPath();
  ctx.moveTo(p1[0], p1[1]);
  ctx.lineTo(p4[0], p4[1]);
  ctx.lineTo(p3[0], p3[1]);
  ctx.lineTo(p3[0], p3[1] + 5);
  ctx.lineTo(p4[0], p4[1] + 5);
  ctx.lineTo(p1[0], p1[1] + 5);
  ctx.closePath();
  ctx.fill();
  polyPath(ctx, CHAIR_SEAT);
  ctx.fillStyle = vGradient(ctx, -31, -13, [
    [0, '#c58a56'],
    [1, '#a06a3a'],
  ]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,230,200,0.3)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

// Texture origin is the bottom middle of the pot (55, 146).
export function paintPlant(ctx: Ctx): void {
  ctx.translate(55, 146);
  const random = seeded(3);
  // Leaves, darker at the back.
  for (let i = 0; i < 14; i++) {
    const angle = -Math.PI / 2 + (random() - 0.5) * 2.4;
    const length = 50 + random() * 40;
    const back = i < 7;
    ctx.save();
    ctx.translate(0, -52);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = vGradient(ctx, -length, 0, [
      [0, back ? '#3f7a34' : '#6fbf55'],
      [1, back ? '#245020' : '#3a7a2e'],
    ]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(14, -length * 0.55, 0, -length);
    ctx.quadraticCurveTo(-14, -length * 0.55, 0, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(0, -length + 6);
    ctx.stroke();
    ctx.restore();
  }
  // Terracotta pot.
  ctx.fillStyle = hGradient(ctx, -30, 30, [
    [0, '#8a4325'],
    [0.4, '#d9774a'],
    [1, '#7a3a20'],
  ]);
  ctx.beginPath();
  ctx.moveTo(-28, -56);
  ctx.lineTo(28, -56);
  ctx.lineTo(20, 0);
  ctx.lineTo(-20, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = vGradient(ctx, -62, -50, [
    [0, '#e8875a'],
    [1, '#9a4a28'],
  ]);
  roundRect(ctx, -33, -62, 66, 12, 4);
  ctx.fill();
}
