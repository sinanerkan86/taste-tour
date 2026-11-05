import Phaser from 'phaser';
import { GAME_WIDTH, PALETTE } from '../config';
import { CASHIER_DESK, DISHPIT, DOOR, KITCHEN, POSTER, ROOM, SEAT_OFFSET_X, STOVES, TABLES } from './layout';
import { ROOM_MARGIN } from './RoomCamera';
import type { CityTheme } from './themes';

export interface RoomArt {
  // One per seat, in seat order: table index * 2, left chair first.
  chairs: Phaser.GameObjects.Graphics[];
  tables: Phaser.GameObjects.Graphics[];
}

// Static background art. Characters are drawn on top with depth = their y position,
// so furniture that people walk behind gets the same treatment.
export function drawRoom(scene: Phaser.Scene, theme: CityTheme): RoomArt {
  const g = scene.add.graphics().setDepth(-1000);

  // Back wall with a tiled band. Wall and floor run past the room's edges for zooming out.
  g.fillStyle(theme.wall, 1).fillRect(0, ROOM.top - ROOM_MARGIN, GAME_WIDTH, ROOM.wallBottom - ROOM.top + ROOM_MARGIN);
  for (let i = 0, x = 0; x < GAME_WIDTH; i++, x += 45) {
    g.fillStyle(i % 2 === 0 ? theme.tileA : theme.tileB, 1).fillRect(x, ROOM.wallBottom - 150, 45, 45);
  }
  drawPoster(g, theme);

  // Wooden floor.
  for (let i = 0, y = ROOM.wallBottom; y < ROOM.bottom + ROOM_MARGIN; i++, y += 60) {
    g.fillStyle(i % 2 === 0 ? theme.floor : theme.floorDark, 1).fillRect(0, y, GAME_WIDTH, 60);
  }

  drawKitchenBack(g, theme);
  drawFaucet(g);
  drawDishpitCounter(scene);
  drawDoor(g, theme);
  drawCashierDesk(scene, theme);
  const art: RoomArt = { chairs: [], tables: [] };
  TABLES.forEach((t) => {
    const { chairs, table } = drawTable(scene, t.x, t.y, theme);
    art.chairs.push(...chairs);
    art.tables.push(table);
  });
  drawKitchenCounter(scene);
  return art;
}

// A framed picture of the city's landmark between the dish pit and the kitchen.
function drawPoster(g: Phaser.GameObjects.Graphics, theme: CityTheme): void {
  const { x, y, width, height } = POSTER;
  g.fillStyle(0x000000, 0.15).fillRoundedRect(x - width / 2 + 4, y - height / 2 + 6, width, height, 8);
  g.fillStyle(0x6b3f22, 1).fillRoundedRect(x - width / 2, y - height / 2, width, height, 8);
  g.fillStyle(theme.sky, 1).fillRect(x - width / 2 + 10, y - height / 2 + 10, width - 20, height - 20);
  theme.landmark(g, x, y);
}

function drawKitchenBack(g: Phaser.GameObjects.Graphics, theme: CityTheme): void {
  // Range hood and back shelf.
  g.fillStyle(0xd9d2c5, 1).fillRect(KITCHEN.left, ROOM.top + 20, KITCHEN.right - KITCHEN.left, 70);
  g.fillStyle(0xbfb7a8, 1).fillRect(KITCHEN.left, ROOM.top + 90, KITCHEN.right - KITCHEN.left, 10);
  g.fillStyle(theme.floorDark, 1).fillRect(KITCHEN.left + 20, ROOM.top + 150, KITCHEN.right - KITCHEN.left - 40, 12);
  // Jars on the shelf.
  [0xc0392b, 0xf4b400, 0x4a8c3a, 0x1f6f8b, 0xe08e0b].forEach((color, i) => {
    g.fillStyle(color, 1).fillRoundedRect(KITCHEN.left + 50 + i * 90, ROOM.top + 112, 36, 38, 6);
  });
}

function drawKitchenCounter(scene: Phaser.Scene): void {
  // Drawn as a separate object above the chefs so it hides their legs.
  const g = scene.add.graphics().setDepth(KITCHEN.counterY);
  const width = KITCHEN.right - KITCHEN.left;
  g.fillStyle(0x8c8c8c, 1).fillRect(KITCHEN.left, KITCHEN.counterY - 60, width, 60);
  g.fillStyle(0xb5b5b5, 1).fillRect(KITCHEN.left, KITCHEN.counterY - 66, width, 12);
  STOVES.forEach((s) => {
    g.fillStyle(0x3a3a3a, 1).fillEllipse(s.x - 34, s.y + 8, 52, 14);
    g.fillStyle(0x3a3a3a, 1).fillEllipse(s.x + 34, s.y + 8, 52, 14);
  });
  // Pass shelf where plates wait.
  g.fillStyle(0xe8e2d6, 1).fillRect(KITCHEN.left - 10, KITCHEN.counterY - 8, width + 20, 16);
}

function drawFaucet(g: Phaser.GameObjects.Graphics): void {
  // Part of the background so the dishwasher stands in front of it.
  g.fillStyle(0xd0d0d0, 1).fillRect(DISHPIT.left + 140, DISHPIT.counterY - 130, 10, 60);
  g.fillRect(DISHPIT.left + 110, DISHPIT.counterY - 130, 40, 10);
}

function drawDishpitCounter(scene: Phaser.Scene): void {
  // Above the dishwasher so it hides their legs. The plate stacks are drawn by the view.
  const g = scene.add.graphics().setDepth(DISHPIT.counterY);
  const width = DISHPIT.right - DISHPIT.left;
  g.fillStyle(0x7f98a6, 1).fillRect(DISHPIT.left, DISHPIT.counterY - 70, width, 70);
  g.fillStyle(0xa9bfcb, 1).fillRect(DISHPIT.left, DISHPIT.counterY - 76, width, 12);
  g.fillStyle(0x5f7886, 1).fillRoundedRect(DISHPIT.left + 66, DISHPIT.counterY - 72, 90, 22, 6);
}

function drawDoor(g: Phaser.GameObjects.Graphics, theme: CityTheme): void {
  // Open doorway on the left wall with a welcome mat.
  g.fillStyle(0x5a3a24, 1).fillRect(0, DOOR.y - 170, 22, 190);
  g.fillStyle(theme.accent, 1).fillRoundedRect(DOOR.x - 20, DOOR.y + 6, 120, 30, 8);
}

function drawCashierDesk(scene: Phaser.Scene, theme: CityTheme): void {
  const g = scene.add.graphics().setDepth(CASHIER_DESK.y + 40);
  g.fillStyle(theme.floorDark, 1).fillRoundedRect(CASHIER_DESK.x - 90, CASHIER_DESK.y - 10, 180, 60, 10);
  g.fillStyle(0x6b3f22, 1).fillRect(CASHIER_DESK.x - 90, CASHIER_DESK.y - 16, 180, 14);
  // Register.
  g.fillStyle(0x3a3a3a, 1).fillRoundedRect(CASHIER_DESK.x - 30, CASHIER_DESK.y - 60, 60, 46, 6);
  g.fillStyle(0x7fd1a6, 1).fillRect(CASHIER_DESK.x - 20, CASHIER_DESK.y - 52, 40, 14);
}

function drawTable(
  scene: Phaser.Scene,
  x: number,
  y: number,
  theme: CityTheme,
): { chairs: Phaser.GameObjects.Graphics[]; table: Phaser.GameObjects.Graphics } {
  // Chairs sit behind the table top; the table itself is above seated customers' legs.
  const chairs = [-1, 1].map((side) => {
    const chair = scene.add.graphics().setDepth(y - 30);
    chair.fillStyle(0x6b3f22, 1).fillRoundedRect(x + side * SEAT_OFFSET_X - 24, y - 70, 48, 70, 8);
    return chair;
  });
  const table = scene.add.graphics().setDepth(y + 1);
  table.fillStyle(0x000000, 0.15).fillEllipse(x, y + 46, 150, 26);
  table.fillStyle(0x7a4a2a, 1).fillRect(x - 8, y, 16, 44);
  table.fillStyle(PALETTE.cream, 1).fillRoundedRect(x - 72, y - 14, 144, 26, 10);
  table.fillStyle(theme.accent, 1).fillRect(x - 72, y + 2, 144, 10);
  return { chairs, table };
}
