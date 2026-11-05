// The app icon, painted with the canvas API like the rest of the game art. index.html previews
// it, export.html renders one layer for tools/icon/export.sh.

export type Ctx = CanvasRenderingContext2D;
const S = 1024;
const C = S / 2;
const OUTLINE = '#3a2016';

function radialBg(ctx: Ctx, inner: string, outer: string): void {
  const g = ctx.createRadialGradient(C, C * 0.8, 40, C, C, S * 0.75);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
}

// Soft light rays from the center, for a bit of "juice" behind the subject.
function rays(ctx: Ctx, color: string, count = 16): void {
  ctx.save();
  ctx.translate(C, C);
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    ctx.rotate((Math.PI * 2) / count);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-60, -S);
    ctx.lineTo(60, -S);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function stroke(ctx: Ctx, width = 18): void {
  ctx.lineJoin = 'round';
  ctx.lineWidth = width;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

function vGrad(ctx: Ctx, y0: number, y1: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

function gloss(ctx: Ctx, x: number, y: number, rx: number, ry: number, alpha = 0.45): void {
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, -0.35, 0, Math.PI * 2);
  ctx.fill();
}

// A globe with simple, friendly continents.
function globe(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  const sea = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  sea.addColorStop(0, '#7fd8ff');
  sea.addColorStop(0.6, '#2fa4d8');
  sea.addColorStop(1, '#17699a');
  ctx.fillStyle = sea;
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = '#6cc04a';
  const blob = (pts: [number, number][]) => {
    ctx.beginPath();
    pts.forEach(([px, py], i) => {
      const [nx, ny] = pts[(i + 1) % pts.length];
      const mx = x + ((px + nx) / 2) * r;
      const my = y + ((py + ny) / 2) * r;
      if (i === 0) ctx.moveTo(mx, my);
      ctx.quadraticCurveTo(x + nx * r, y + ny * r, x + ((nx + pts[(i + 2) % pts.length][0]) / 2) * r, y + ((ny + pts[(i + 2) % pts.length][1]) / 2) * r);
    });
    ctx.closePath();
    ctx.fill();
  };
  blob([[-0.75, -0.5], [-0.3, -0.75], [0.05, -0.45], [-0.15, -0.1], [-0.45, 0.05], [-0.8, -0.15]]);
  blob([[-0.35, 0.15], [0.0, 0.2], [-0.05, 0.75], [-0.3, 0.6]]);
  blob([[0.2, -0.7], [0.75, -0.55], [0.9, -0.1], [0.55, 0.1], [0.3, -0.15]]);
  blob([[0.45, 0.35], [0.8, 0.4], [0.7, 0.7], [0.4, 0.6]]);
  ctx.fillStyle = 'rgba(0,30,60,0.25)';
  ctx.beginPath();
  ctx.arc(x + r * 0.35, y + r * 0.35, r * 1.05, 0, Math.PI * 2);
  ctx.arc(x - r * 0.1, y - r * 0.1, r * 1.05, 0, Math.PI * 2, true);
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  stroke(ctx);
  gloss(ctx, x - r * 0.4, y - r * 0.5, r * 0.32, r * 0.16);
}

// A puffy chef's toque sitting at (x, baseY), `w` wide.
function toque(ctx: Ctx, x: number, baseY: number, w: number, tilt = 0): void {
  ctx.save();
  ctx.translate(x, baseY);
  ctx.rotate(tilt);
  const band = w * 0.28;
  ctx.beginPath();
  ctx.arc(-w * 0.28, -band - w * 0.22, w * 0.26, Math.PI * 0.6, Math.PI * 1.6);
  ctx.arc(0, -band - w * 0.4, w * 0.3, Math.PI * 1.1, Math.PI * 1.9);
  ctx.arc(w * 0.28, -band - w * 0.22, w * 0.26, Math.PI * 1.4, Math.PI * 0.4);
  ctx.lineTo(w * 0.42, -band);
  ctx.lineTo(-w * 0.42, -band);
  ctx.closePath();
  ctx.fillStyle = vGrad(ctx, -band - w * 0.7, -band, [[0, '#ffffff'], [1, '#e6ddd2']]);
  ctx.fill();
  stroke(ctx, 16);
  ctx.beginPath();
  ctx.roundRect(-w * 0.44, -band, w * 0.88, band, 14);
  ctx.fillStyle = vGrad(ctx, -band, 0, [[0, '#f7f2ea'], [1, '#d9cfc2']]);
  ctx.fill();
  stroke(ctx, 16);
  ctx.strokeStyle = 'rgba(120,100,80,0.35)';
  ctx.lineWidth = 6;
  [-0.22, 0, 0.22].forEach((f) => {
    ctx.beginPath();
    ctx.moveTo(f * w, -band + 14);
    ctx.lineTo(f * w, -14);
    ctx.stroke();
  });
  gloss(ctx, -w * 0.18, -band - w * 0.45, w * 0.12, w * 0.06, 0.8);
  ctx.restore();
}

function sparkle(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#fff6c8';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 === 0 ? r : r * 0.28;
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// --- The icon: the world wearing a chef's hat ----------------------------------------------

export const ICON_COLORS = { inner: '#ff8a5c', outer: '#d8342a' };

// Background layer: warm red with soft light rays.
export function paintBackground(ctx: Ctx): void {
  radialBg(ctx, ICON_COLORS.inner, ICON_COLORS.outer);
  rays(ctx, 'rgba(255,230,180,0.12)');
}

// Foreground layer: globe, hat and sparkles on transparency. `scale` shrinks the subject around
// the center: launchers only show the middle 72 of the 108 dp adaptive layer, cut by their mask.
export function paintForeground(ctx: Ctx, scale: number): void {
  ctx.save();
  ctx.translate(C, C);
  ctx.scale(scale, scale);
  // The subject spans y = C-433 .. C+300; center it.
  ctx.translate(-C, -C + 66);
  ctx.fillStyle = 'rgba(60,15,5,0.3)';
  ctx.beginPath();
  ctx.ellipse(C, C + 300, 240, 40, 0, 0, Math.PI * 2);
  ctx.fill();
  globe(ctx, C, C + 70, 230);
  toque(ctx, C + 20, C - 110, 330, 0.12);
  sparkle(ctx, C + 270, C - 230, 46);
  sparkle(ctx, C - 280, C + 40, 30);
  ctx.restore();
}

// Subject scale per use: the adaptive foreground must fit the 66% safe circle; the full square
// icon (Play Store, old launchers) can be bigger.
export const SCALE = { adaptive: 0.78, full: 0.95 };

// The full square icon with both layers.
export function paintFull(ctx: Ctx): void {
  paintBackground(ctx);
  paintForeground(ctx, SCALE.full);
}

export const SIZE = S;
