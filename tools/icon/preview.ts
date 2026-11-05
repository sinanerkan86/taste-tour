import { SCALE, SIZE, paintBackground, paintForeground, paintFull } from './paint';

// Shows the full icon and the adaptive icon under common launcher masks.
function canvas(size: number, draw: (ctx: CanvasRenderingContext2D) => void, className: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  c.className = className;
  draw(c.getContext('2d')!);
  return c;
}

// Launchers show the middle 66% of an adaptive icon (72 of 108 dp), cut by their mask.
const masked = (ctx: CanvasRenderingContext2D) => {
  ctx.translate(-SIZE * 0.17, -SIZE * 0.17);
  paintBackground(ctx);
  paintForeground(ctx, SCALE.adaptive);
};
const root = document.getElementById('concepts')!;
const figure = document.createElement('figure');
const shapes = document.createElement('div');
shapes.className = 'shapes';
for (const cls of ['round', 'squircle', 'small']) {
  const c = canvas(SIZE * 0.66, masked, cls);
  shapes.append(c);
}
figure.append(canvas(SIZE, paintFull, 'big'), shapes);
root.append(figure);
