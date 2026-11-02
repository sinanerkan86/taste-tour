import Phaser from 'phaser';
import { FONT, GAME_HEIGHT, GAME_WIDTH, PALETTE, toCss } from '../config';

const RADIUS = 40;
const HEADER_HEIGHT = 130;

export interface ModalCard {
  // Dim overlay, card and title, in drawing order.
  objects: Phaser.GameObjects.GameObject[];
  cx: number;
  top: number;
}

// The shared look of dialogs: a dim overlay that swallows taps, and a cream card with a red header.
export function createModalCard(scene: Phaser.Scene, width: number, height: number, title: string): ModalCard {
  const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setOrigin(0).setInteractive();
  const cx = GAME_WIDTH / 2;
  const top = GAME_HEIGHT / 2 - 60 - height / 2;
  const card = scene.add.graphics();
  card.fillStyle(PALETTE.ink, 0.35).fillRoundedRect(cx - width / 2, top + 12, width, height, RADIUS);
  card.fillStyle(PALETTE.cream, 1).fillRoundedRect(cx - width / 2, top, width, height, RADIUS);
  card.fillStyle(PALETTE.pomegranate, 1).fillRoundedRect(cx - width / 2, top, width, HEADER_HEIGHT, {
    tl: RADIUS,
    tr: RADIUS,
    bl: 0,
    br: 0,
  });
  const titleText = scene.add
    .text(cx, top + HEADER_HEIGHT / 2, title, {
      fontFamily: FONT,
      fontSize: '58px',
      fontStyle: 'bold',
      color: toCss(PALETTE.cream),
    })
    .setOrigin(0.5);
  return { objects: [dim, card, titleText], cx, top };
}

// Centered, wrapped dialog text.
export function modalText(
  scene: Phaser.Scene,
  card: ModalCard,
  width: number,
  y: number,
  value: string,
  size: number,
  color: number,
  bold = false,
): Phaser.GameObjects.Text {
  return scene.add
    .text(card.cx, y, value, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      fontStyle: bold ? 'bold' : 'normal',
      color: toCss(color),
      align: 'center',
      lineSpacing: 10,
      wordWrap: { width: width - 100 },
    })
    .setOrigin(0.5);
}
