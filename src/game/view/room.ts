import Phaser from 'phaser';
import { GAME_WIDTH, PALETTE } from '../config';
import { CASHIER_DESK, DISHPIT, DOOR, KITCHEN, ROOM, SEAT_OFFSET_X, STOVES, TABLES } from './layout';

// Static background art. Characters are drawn on top with depth = their y position,
// so furniture that people walk behind gets the same treatment.
export function drawRoom(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setDepth(-1000);

  // Back wall with a tiled band.
  g.fillStyle(PALETTE.wall, 1).fillRect(0, ROOM.top, GAME_WIDTH, ROOM.wallBottom - ROOM.top);
  for (let i = 0, x = 0; x < GAME_WIDTH; i++, x += 45) {
    g.fillStyle(i % 2 === 0 ? PALETTE.tileBlue : 0x2f8fb0, 1).fillRect(x, ROOM.wallBottom - 150, 45, 45);
  }

  // Wooden floor.
  for (let i = 0, y = ROOM.wallBottom; y < ROOM.bottom; i++, y += 60) {
    g.fillStyle(i % 2 === 0 ? PALETTE.floor : PALETTE.floorDark, 1).fillRect(0, y, GAME_WIDTH, 60);
  }

  drawKitchenBack(g);
  drawDishpit(g);
  drawDoor(g);
  drawCashierDesk(scene);
  TABLES.forEach((t) => drawTable(scene, t.x, t.y));
  drawKitchenCounter(scene);
}

function drawKitchenBack(g: Phaser.GameObjects.Graphics): void {
  // Range hood and back shelf.
  g.fillStyle(0xd9d2c5, 1).fillRect(KITCHEN.left, ROOM.top + 20, KITCHEN.right - KITCHEN.left, 70);
  g.fillStyle(0xbfb7a8, 1).fillRect(KITCHEN.left, ROOM.top + 90, KITCHEN.right - KITCHEN.left, 10);
  g.fillStyle(PALETTE.floorDark, 1).fillRect(KITCHEN.left + 20, ROOM.top + 150, KITCHEN.right - KITCHEN.left - 40, 12);
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

function drawDishpit(g: Phaser.GameObjects.Graphics): void {
  const width = DISHPIT.right - DISHPIT.left;
  g.fillStyle(0x7f98a6, 1).fillRect(DISHPIT.left, DISHPIT.counterY - 70, width, 70);
  g.fillStyle(0xa9bfcb, 1).fillRect(DISHPIT.left, DISHPIT.counterY - 76, width, 12);
  g.fillStyle(0x5f7886, 1).fillRoundedRect(DISHPIT.left + 40, DISHPIT.counterY - 72, 110, 22, 6);
  // Faucet.
  g.fillStyle(0xd0d0d0, 1).fillRect(DISHPIT.left + 90, DISHPIT.counterY - 120, 10, 50);
  g.fillRect(DISHPIT.left + 90, DISHPIT.counterY - 120, 40, 10);
  // Stack of clean plates.
  for (let i = 0; i < 5; i++) {
    g.fillStyle(0xffffff, 1).fillEllipse(DISHPIT.right - 45, DISHPIT.counterY - 84 - i * 8, 56, 14);
    g.lineStyle(2, 0xc9c1b4, 1).strokeEllipse(DISHPIT.right - 45, DISHPIT.counterY - 84 - i * 8, 56, 14);
  }
}

function drawDoor(g: Phaser.GameObjects.Graphics): void {
  // Open doorway on the left wall with a welcome mat.
  g.fillStyle(0x5a3a24, 1).fillRect(0, DOOR.y - 170, 22, 190);
  g.fillStyle(PALETTE.pomegranate, 1).fillRoundedRect(DOOR.x - 20, DOOR.y + 6, 120, 30, 8);
}

function drawCashierDesk(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setDepth(CASHIER_DESK.y + 40);
  g.fillStyle(PALETTE.floorDark, 1).fillRoundedRect(CASHIER_DESK.x - 90, CASHIER_DESK.y - 10, 180, 60, 10);
  g.fillStyle(0x6b3f22, 1).fillRect(CASHIER_DESK.x - 90, CASHIER_DESK.y - 16, 180, 14);
  // Register.
  g.fillStyle(0x3a3a3a, 1).fillRoundedRect(CASHIER_DESK.x - 30, CASHIER_DESK.y - 60, 60, 46, 6);
  g.fillStyle(0x7fd1a6, 1).fillRect(CASHIER_DESK.x - 20, CASHIER_DESK.y - 52, 40, 14);
}

function drawTable(scene: Phaser.Scene, x: number, y: number): void {
  // Chairs sit behind the table top; the table itself is above seated customers' legs.
  const chairs = scene.add.graphics().setDepth(y - 30);
  [-1, 1].forEach((side) => {
    chairs.fillStyle(0x6b3f22, 1).fillRoundedRect(x + side * SEAT_OFFSET_X - 24, y - 70, 48, 70, 8);
  });
  const table = scene.add.graphics().setDepth(y + 1);
  table.fillStyle(0x000000, 0.15).fillEllipse(x, y + 46, 150, 26);
  table.fillStyle(0x7a4a2a, 1).fillRect(x - 8, y, 16, 44);
  table.fillStyle(PALETTE.cream, 1).fillRoundedRect(x - 72, y - 14, 144, 26, 10);
  table.fillStyle(PALETTE.pomegranate, 1).fillRect(x - 72, y + 2, 144, 10);
}
