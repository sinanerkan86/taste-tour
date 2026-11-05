import Phaser from 'phaser';

// Painted art is drawn with the 2D canvas API (gradients, soft shadows) into textures at this
// many pixels per world unit, then shown at 1/ART_RES scale so it stays sharp when zoomed in.
export const ART_RES = 2;

export type Ctx = CanvasRenderingContext2D;

// Paints a texture once; later calls with the same key reuse it.
export function paintTexture(scene: Phaser.Scene, key: string, width: number, height: number, draw: (ctx: Ctx) => void): string {
  if (scene.textures.exists(key)) return key;
  const texture = scene.textures.createCanvas(key, Math.ceil(width * ART_RES), Math.ceil(height * ART_RES));
  if (!texture) throw new Error(`Could not create texture ${key}`);
  const ctx = texture.getContext();
  ctx.scale(ART_RES, ART_RES);
  draw(ctx);
  texture.refresh();
  return key;
}

// Adds a painted texture to the scene. (originX, originY) is the anchor inside the texture in
// world units, so the image can be placed at a meaningful point (feet, table center...).
export function addArt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  key: string,
  originX: number,
  originY: number,
  frame?: string,
): Phaser.GameObjects.Image {
  const image = scene.add.image(x, y, key, frame).setScale(1 / ART_RES);
  return image.setOrigin(originX / (image.width / ART_RES), originY / (image.height / ART_RES));
}

export function rgba(color: number, alpha = 1): string {
  return `rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},${alpha})`;
}

// Mixes a color toward white (amount > 0) or black (amount < 0); amount in -1..1.
export function shade(color: number, amount: number): number {
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  const mix = (c: number) => Math.round(c + (target - c) * t);
  return (mix((color >> 16) & 255) << 16) | (mix((color >> 8) & 255) << 8) | mix(color & 255);
}

export function css(color: number, amount = 0, alpha = 1): string {
  return rgba(amount === 0 ? color : shade(color, amount), alpha);
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number | [number, number, number, number]): void {
  const [tl, tr, br, bl] = typeof r === 'number' ? [r, r, r, r] : r;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

// Vertical gradient between color stops given as [offset, css color].
export function vGradient(ctx: Ctx, y0: number, y1: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

export function hGradient(ctx: Ctx, x0: number, x1: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

export function radial(ctx: Ctx, x: number, y: number, r0: number, r1: number, stops: [number, string][], fx = x, fy = y): CanvasGradient {
  const g = ctx.createRadialGradient(fx, fy, r0, x, y, r1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

// Soft elliptical shadow on the floor.
export function floorShadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, alpha = 0.3): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.fillStyle = radial(ctx, 0, 0, 0, rx, [
    [0, `rgba(30,15,5,${alpha})`],
    [0.6, `rgba(30,15,5,${alpha * 0.6})`],
    [1, 'rgba(30,15,5,0)'],
  ]);
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Deterministic pseudo-random numbers, so painted details look the same every time.
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
