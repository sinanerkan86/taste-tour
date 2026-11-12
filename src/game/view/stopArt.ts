import Phaser from 'phaser';
import { type Ctx, css, floorShadow, hGradient, paintTexture, roundRect, vGradient } from './paint';
import type { StreetTheme } from './streetThemes';

// Art of the bus stop on the restaurant's pavement: the pole with the bus sign (always there)
// and the shelter with a bench and the next-bus board (once the stop is open).

// The board's middle, from the shelter's origin, where the countdown is written.
export const BOARD = { x: 0, y: -196, width: 118, height: 38 } as const;

const metal = (ctx: Ctx, x0: number, x1: number) =>
  hGradient(ctx, x0, x1, [
    [0, '#4a5057'],
    [0.5, '#b9c0c7'],
    [1, '#3e444a'],
  ]);

// A pole with a round bus sign. Origin: the foot of the pole (40, 300).
export function busSignTexture(scene: Phaser.Scene, street: StreetTheme): string {
  return paintTexture(scene, `stop-sign-${street.bus.toString(16)}`, 80, 304, (ctx) => {
    ctx.translate(40, 300);
    floorShadow(ctx, 4, -2, 14, 5, 0.35);
    ctx.fillStyle = metal(ctx, -4, 4);
    ctx.fillRect(-3, -250, 6, 250);
    // Sign: a white disc with a ring in the bus color and a bus seen from the front.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(2, -262, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(street.bus, 0);
    ctx.beginPath();
    ctx.arc(0, -264, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -264, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b3036';
    roundRect(ctx, -14, -282, 28, 30, 5);
    ctx.fill();
    ctx.fillStyle = '#a9c1d2';
    roundRect(ctx, -10, -278, 20, 12, 2);
    ctx.fill();
    ctx.fillStyle = '#ffd34d';
    ctx.fillRect(-10, -260, 5, 4);
    ctx.fillRect(5, -260, 5, 4);
    ctx.fillStyle = '#2b3036';
    ctx.fillRect(-12, -252, 6, 6);
    ctx.fillRect(6, -252, 6, 6);
  });
}

// The shelter: a glass back wall and side, a roof, a bench and the next-bus board.
// Origin: the middle of its front edge on the pavement (130, 300).
export function shelterTexture(scene: Phaser.Scene, street: StreetTheme): string {
  return paintTexture(scene, `stop-shelter-${street.bus.toString(16)}`, 260, 304, (ctx) => {
    ctx.translate(130, 300);
    floorShadow(ctx, 0, -14, 120, 18, 0.3);
    // Back wall of glass, a little behind the front posts.
    ctx.fillStyle = 'rgba(190,220,235,0.32)';
    roundRect(ctx, -100, -232, 200, 190, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(80,90,100,0.85)';
    ctx.lineWidth = 4;
    roundRect(ctx, -100, -232, 200, 190, 4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(-70, -60);
    ctx.lineTo(-30, -220);
    ctx.lineTo(-12, -220);
    ctx.lineTo(-52, -60);
    ctx.closePath();
    ctx.fill();
    // A city map poster on the back wall.
    ctx.fillStyle = '#f7f1e3';
    roundRect(ctx, 40, -190, 46, 70, 3);
    ctx.fill();
    ctx.strokeStyle = css(street.bus, -0.1);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(46, -130);
    ctx.lineTo(58, -160);
    ctx.lineTo(70, -150);
    ctx.lineTo(80, -180);
    ctx.stroke();
    ctx.fillStyle = css(street.bus, 0);
    ctx.fillRect(40, -190, 46, 9);
    // Bench: wooden seat on two legs.
    ctx.fillStyle = metal(ctx, -70, 70);
    ctx.fillRect(-66, -64, 6, 40);
    ctx.fillRect(60, -64, 6, 40);
    ctx.fillStyle = vGradient(ctx, -74, -60, [
      [0, '#c98a4a'],
      [1, '#8a5a2e'],
    ]);
    roundRect(ctx, -80, -74, 160, 14, 4);
    ctx.fill();
    ctx.fillStyle = vGradient(ctx, -112, -98, [
      [0, '#c98a4a'],
      [1, '#8a5a2e'],
    ]);
    roundRect(ctx, -80, -112, 160, 12, 4);
    ctx.fill();
    // Front posts.
    [-104, 104].forEach((x) => {
      ctx.fillStyle = metal(ctx, x - 5, x + 5);
      ctx.fillRect(x - 4, -240, 8, 240);
    });
    // Roof: a slab in the trim color seen from a little above, with a lit edge.
    ctx.fillStyle = vGradient(ctx, -262, -236, [
      [0, css(street.bus, 0.35)],
      [1, css(street.bus, -0.15)],
    ]);
    roundRect(ctx, -122, -262, 244, 28, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    roundRect(ctx, -114, -260, 228, 5, 3);
    ctx.fill();
    ctx.fillStyle = css(street.bus, -0.4);
    ctx.fillRect(-118, -238, 236, 4);
    // Next-bus board hanging under the roof (the minutes are written on it in the scene).
    ctx.fillStyle = metal(ctx, -30, 30);
    ctx.fillRect(-28, -234, 4, 20);
    ctx.fillRect(24, -234, 4, 20);
    ctx.fillStyle = '#16181b';
    roundRect(ctx, BOARD.x - BOARD.width / 2, BOARD.y - BOARD.height / 2, BOARD.width, BOARD.height, 6);
    ctx.fill();
    ctx.strokeStyle = '#4a5057';
    ctx.lineWidth = 3;
    roundRect(ctx, BOARD.x - BOARD.width / 2, BOARD.y - BOARD.height / 2, BOARD.width, BOARD.height, 6);
    ctx.stroke();
  });
}
