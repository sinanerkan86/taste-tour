import Phaser from 'phaser';
import { FONT, GAME_HEIGHT, GAME_WIDTH, MAX_GAME_HEIGHT, toCss } from '../config';
import { ART_RES, css, paintTexture, roundRect, vGradient } from '../view/paint';
import { outlined } from './style';

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
  const dim = scene.add.rectangle(0, 0, GAME_WIDTH, MAX_GAME_HEIGHT, 0x000000, 0.55).setOrigin(0).setInteractive();
  const cx = GAME_WIDTH / 2;
  const top = GAME_HEIGHT / 2 - 60 - height / 2;
  const card = scene.add.image(cx, top + height / 2, paintModalCard(scene, width, height)).setScale(1 / ART_RES);
  const titleText = scene.add.text(cx, top + HEADER_HEIGHT / 2 - 4, title, outlined(58)).setOrigin(0.5);
  titleText.setScale(Math.min(1, (width - 80) / titleText.width));
  return { objects: [dim, card, titleText], cx, top };
}

// Cream card with a thick light rim, a dark outline and a glossy red header.
function paintModalCard(scene: Phaser.Scene, width: number, height: number): string {
  return paintTexture(scene, `modal-${width}x${height}`, width + 20, height + 30, (ctx) => {
    ctx.translate(10, 6);
    ctx.fillStyle = 'rgba(30,10,5,0.4)';
    roundRect(ctx, 0, 14, width, height, RADIUS);
    ctx.fill();
    ctx.fillStyle = '#3a2016';
    roundRect(ctx, -4, -4, width + 8, height + 8, RADIUS + 4);
    ctx.fill();
    ctx.fillStyle = vGradient(ctx, 0, height, [
      [0, '#fff4dc'],
      [1, '#e8c9a0'],
    ]);
    roundRect(ctx, 0, 0, width, height, RADIUS);
    ctx.fill();
    const inset = 12;
    ctx.fillStyle = vGradient(ctx, inset, height - inset, [
      [0, '#fffaf0'],
      [1, '#fbe8c8'],
    ]);
    roundRect(ctx, inset, inset, width - inset * 2, height - inset * 2, RADIUS - inset);
    ctx.fill();
    // Header: glossy red band across the top of the inner card.
    ctx.save();
    roundRect(ctx, inset, inset, width - inset * 2, height - inset * 2, RADIUS - inset);
    ctx.clip();
    ctx.fillStyle = vGradient(ctx, inset, HEADER_HEIGHT, [
      [0, css(0xff6a55)],
      [0.6, css(0xe8463a)],
      [1, css(0xc0302a)],
    ]);
    ctx.fillRect(0, 0, width, HEADER_HEIGHT);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    roundRect(ctx, inset + 20, inset + 8, width - inset * 2 - 40, HEADER_HEIGHT * 0.32, 18);
    ctx.fill();
    ctx.fillStyle = 'rgba(120,20,10,0.35)';
    ctx.fillRect(0, HEADER_HEIGHT - 6, width, 6);
    ctx.restore();
  });
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
