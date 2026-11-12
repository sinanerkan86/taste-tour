import Phaser from 'phaser';
import { ART_RES, type Ctx, ellipse, hGradient, radial, roundRect, vGradient } from './paint';

// Every body part is painted into one atlas texture, in a cell the size of a whole character
// with the feet at the same point, so a character is a stack of images all placed at (0, 0).
// Parts that vary in color (skin, hair, clothes) are painted in grey shades and tinted per
// character: tinting multiplies, so white becomes the chosen color and grey its shadow.
export const PEOPLE_TEXTURE = 'people';
export const CELL = { left: 50, top: 180, width: 100, height: 190 } as const;
const COLUMNS = 6;

export type Part =
  | 'shadow'
  | 'legs'
  | 'shoes'
  | 'skirt'
  | 'torso'
  | 'arms'
  | 'hands'
  | 'head'
  | 'faceMale'
  | 'faceFemale'
  | 'eyelids'
  | 'shine'
  | 'hairShort'
  | 'hairTop'
  | 'hairLong'
  | 'hairBob'
  | 'hairPonytail'
  | 'hairBun'
  | 'vest'
  | 'chefApron'
  | 'toque'
  | 'rubberApron'
  | 'sash'
  | 'sunHat'
  | 'bowTie'
  | 'tailcoat'
  | 'waistApron'
  | 'neckerchief'
  | 'tallToque'
  | 'beret'
  | 'notepad'
  | 'cap'
  | 'helmet'
  | 'deliveryBag';

const PAINTERS: Record<Part, (ctx: Ctx) => void> = {
  shadow: paintShadow,
  legs: paintLegs,
  shoes: paintShoes,
  skirt: paintSkirt,
  torso: paintTorso,
  arms: paintArms,
  hands: paintHands,
  head: paintHead,
  faceMale: (ctx) => paintFace(ctx, false),
  faceFemale: (ctx) => paintFace(ctx, true),
  eyelids: paintEyelids,
  shine: paintShine,
  hairShort: paintHairShort,
  hairTop: paintHairTop,
  hairLong: (ctx) => paintHairBack(ctx, 62),
  hairBob: (ctx) => paintHairBack(ctx, 42),
  hairPonytail: paintPonytail,
  hairBun: paintBun,
  vest: paintVest,
  chefApron: paintChefApron,
  toque: paintToque,
  rubberApron: paintRubberApron,
  sash: paintSash,
  sunHat: paintSunHat,
  bowTie: paintBowTie,
  tailcoat: paintTailcoat,
  waistApron: paintWaistApron,
  neckerchief: paintNeckerchief,
  tallToque: (ctx) => paintToque(ctx, 22),
  beret: paintBeret,
  notepad: paintNotepad,
  cap: paintCap,
  helmet: paintHelmet,
  deliveryBag: paintDeliveryBag,
};

// Grey ramps: lit side, middle, shadow side.
const LIT = '#ffffff';
const MID = '#e2e2e2';
const DARK = '#9c9c9c';
const EDGE = 'rgba(70,60,55,0.55)';

export function ensurePeopleAtlas(scene: Phaser.Scene): void {
  if (scene.textures.exists(PEOPLE_TEXTURE)) return;
  const parts = Object.keys(PAINTERS) as Part[];
  const rows = Math.ceil(parts.length / COLUMNS);
  const cellW = CELL.width * ART_RES;
  const cellH = CELL.height * ART_RES;
  const texture = scene.textures.createCanvas(PEOPLE_TEXTURE, cellW * COLUMNS, cellH * rows);
  if (!texture) throw new Error('Could not create the people atlas');
  const ctx = texture.getContext();
  parts.forEach((part, i) => {
    const x = (i % COLUMNS) * cellW;
    const y = Math.floor(i / COLUMNS) * cellH;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, cellW, cellH);
    ctx.clip();
    ctx.translate(x, y);
    ctx.scale(ART_RES, ART_RES);
    ctx.translate(CELL.left, CELL.top);
    PAINTERS[part](ctx);
    ctx.restore();
    texture.add(part, 0, x, y, cellW, cellH);
  });
  texture.refresh();
}

function cylinder(ctx: Ctx, x0: number, x1: number): CanvasGradient {
  return hGradient(ctx, x0, x1, [
    [0, DARK],
    [0.3, LIT],
    [0.65, MID],
    [1, DARK],
  ]);
}

function outline(ctx: Ctx, width = 1.6): void {
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = width;
  ctx.stroke();
}

function paintShadow(ctx: Ctx): void {
  ctx.save();
  ctx.scale(1, 0.3);
  ctx.fillStyle = radial(ctx, 0, 0, 0, 32, [
    [0, 'rgba(30,15,5,0.4)'],
    [0.7, 'rgba(30,15,5,0.22)'],
    [1, 'rgba(30,15,5,0)'],
  ]);
  ctx.beginPath();
  ctx.arc(0, 0, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintLegs(ctx: Ctx): void {
  [-18, 4].forEach((x) => {
    ctx.fillStyle = cylinder(ctx, x, x + 14);
    roundRect(ctx, x, -36, 14, 32, 5);
    ctx.fill();
    outline(ctx, 1.2);
  });
}

function paintShoes(ctx: Ctx): void {
  [-11, 11].forEach((x) => {
    ctx.fillStyle = vGradient(ctx, -8, 2, [
      [0, '#5a4a40'],
      [1, '#241a14'],
    ]);
    ellipse(ctx, x + (x < 0 ? -2 : 2), -3, 10, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ellipse(ctx, x + (x < 0 ? -4 : 0), -5, 4, 1.5);
    ctx.fill();
  });
}

function paintSkirt(ctx: Ctx): void {
  ctx.fillStyle = cylinder(ctx, -32, 32);
  ctx.beginPath();
  ctx.moveTo(-24, -44);
  ctx.lineTo(24, -44);
  ctx.quadraticCurveTo(30, -26, 33, -12);
  ctx.quadraticCurveTo(0, -6, -33, -12);
  ctx.quadraticCurveTo(-30, -26, -24, -44);
  ctx.closePath();
  ctx.fill();
  outline(ctx);
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1.5;
  [-12, 0, 12].forEach((x) => {
    ctx.beginPath();
    ctx.moveTo(x * 0.8, -40);
    ctx.lineTo(x * 1.4, -12);
    ctx.stroke();
  });
}

function paintTorso(ctx: Ctx): void {
  ctx.fillStyle = cylinder(ctx, -27, 27);
  ctx.beginPath();
  ctx.moveTo(-18, -88);
  ctx.quadraticCurveTo(0, -92, 18, -88);
  ctx.quadraticCurveTo(28, -86, 27, -72);
  ctx.lineTo(25, -34);
  ctx.quadraticCurveTo(25, -26, 17, -26);
  ctx.lineTo(-17, -26);
  ctx.quadraticCurveTo(-25, -26, -25, -34);
  ctx.lineTo(-27, -72);
  ctx.quadraticCurveTo(-28, -86, -18, -88);
  ctx.closePath();
  ctx.fill();
  outline(ctx);
  // Shading under the chest and a collar.
  ctx.fillStyle = vGradient(ctx, -50, -26, [
    [0, 'rgba(0,0,0,0)'],
    [1, 'rgba(0,0,0,0.18)'],
  ]);
  ctx.fillRect(-26, -50, 52, 24);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.moveTo(-9, -89);
  ctx.lineTo(0, -80);
  ctx.lineTo(9, -89);
  ctx.closePath();
  ctx.fill();
}

function paintArms(ctx: Ctx): void {
  [-1, 1].forEach((side) => {
    ctx.save();
    ctx.scale(side, 1);
    ctx.fillStyle = hGradient(ctx, 23, 37, [
      [0, MID],
      [0.4, LIT],
      [1, DARK],
    ]);
    ctx.beginPath();
    ctx.moveTo(24, -84);
    ctx.quadraticCurveTo(36, -82, 37, -70);
    ctx.lineTo(37, -52);
    ctx.quadraticCurveTo(31, -48, 25, -52);
    ctx.lineTo(24, -84);
    ctx.closePath();
    ctx.fill();
    outline(ctx, 1.2);
    ctx.restore();
  });
}

function paintHands(ctx: Ctx): void {
  [-31, 31].forEach((x) => {
    ctx.fillStyle = radial(ctx, x, -46, 0, 8, [
      [0, LIT],
      [1, DARK],
    ], x - 2, -48);
    ctx.beginPath();
    ctx.arc(x, -46, 7, 0, Math.PI * 2);
    ctx.fill();
    outline(ctx, 1);
  });
}

function paintHead(ctx: Ctx): void {
  // Neck, ears, then the head as a lit sphere.
  ctx.fillStyle = cylinder(ctx, -8, 8);
  ctx.fillRect(-7, -90, 14, 8);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(-7, -90, 14, 4);
  [-24, 24].forEach((x) => {
    ctx.fillStyle = radial(ctx, x, -106, 0, 7, [
      [0, MID],
      [1, DARK],
    ]);
    ctx.beginPath();
    ctx.arc(x, -106, 6, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = radial(ctx, 0, -108, 0, 26, [
    [0, LIT],
    [0.7, '#efefef'],
    [1, DARK],
  ], -7, -117);
  ctx.beginPath();
  ctx.arc(0, -108, 25, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx);
}

const EYE_Y = -106;
const EYE_X = 9;

// A friendly face: big glossy eyes, raised soft brows, an open smile and rosy cheeks.
function paintFace(ctx: Ctx, female: boolean): void {
  ctx.lineCap = 'round';
  [-EYE_X, EYE_X].forEach((x) => {
    ctx.fillStyle = vGradient(ctx, EYE_Y - 5.5, EYE_Y + 5.5, [
      [0, '#1c120c'],
      [1, '#4a3020'],
    ]);
    ellipse(ctx, x, EYE_Y, 4.3, 5.6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x + 1.4, EYE_Y - 2, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - 1.3, EYE_Y + 2.2, 0.8, 0, Math.PI * 2);
    ctx.fill();
    // Brows arch upward, which reads as cheerful rather than cross.
    ctx.strokeStyle = 'rgba(60,38,25,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, EYE_Y - 4, 6, Math.PI * 1.25, Math.PI * 1.75);
    ctx.stroke();
  });
  [-15, 15].forEach((x) => {
    ctx.fillStyle = radial(ctx, x, -98, 0, 7, [
      [0, 'rgba(245,110,110,0.5)'],
      [1, 'rgba(245,110,110,0)'],
    ]);
    ctx.fillRect(x - 7, -105, 14, 14);
  });
  // Open smile.
  ctx.fillStyle = female ? '#b8384c' : '#7a2e24';
  ctx.beginPath();
  ctx.moveTo(-6.5, -99.5);
  ctx.quadraticCurveTo(0, -98, 6.5, -99.5);
  ctx.quadraticCurveTo(0, -89, -6.5, -99.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f08a8a';
  ellipse(ctx, 0, -94.5, 3, 1.6);
  ctx.fill();
}

// Closed eyes, tinted with the skin color and shown for a moment when the character blinks.
function paintEyelids(ctx: Ctx): void {
  ctx.lineCap = 'round';
  [-EYE_X, EYE_X].forEach((x) => {
    ctx.fillStyle = '#f2f2f2';
    ellipse(ctx, x, EYE_Y, 5.6, 6.8);
    ctx.fill();
    ctx.strokeStyle = '#3a2418';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, EYE_Y - 1, 4.5, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  });
}

// Soft highlight on the forehead, drawn untinted over the head.
function paintShine(ctx: Ctx): void {
  ctx.fillStyle = radial(ctx, -9, -119, 0, 10, [
    [0, 'rgba(255,255,255,0.32)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  ctx.fillRect(-21, -131, 24, 24);
}

function hairFill(ctx: Ctx, top: number, bottom: number): CanvasGradient {
  return vGradient(ctx, top, bottom, [
    [0, LIT],
    [0.5, MID],
    [1, DARK],
  ]);
}

function hairShine(ctx: Ctx, y: number): void {
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(-2, y + 16, 16, Math.PI * 1.15, Math.PI * 1.45);
  ctx.stroke();
}

// Hairlines are smooth arcs that stay above the brows, so they never read as a frown.
function paintHairShort(ctx: Ctx): void {
  ctx.fillStyle = hairFill(ctx, -136, -104);
  ctx.beginPath();
  ctx.moveTo(-26, -102);
  ctx.bezierCurveTo(-31, -146, 31, -146, 26, -102);
  ctx.quadraticCurveTo(24, -117, 15, -122);
  ctx.quadraticCurveTo(2, -128, -11, -123);
  ctx.quadraticCurveTo(-22, -119, -26, -102);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 1.2);
  hairShine(ctx, -136);
}

function paintHairTop(ctx: Ctx): void {
  // Fuller hair with a soft side-swept fringe and strands down by the ears.
  ctx.fillStyle = hairFill(ctx, -137, -96);
  ctx.beginPath();
  ctx.moveTo(-28, -96);
  ctx.bezierCurveTo(-33, -148, 33, -148, 28, -96);
  ctx.lineTo(24, -100);
  ctx.quadraticCurveTo(23, -114, 16, -121);
  ctx.quadraticCurveTo(3, -127, -9, -122);
  ctx.quadraticCurveTo(-21, -117, -23, -100);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 1.2);
  hairShine(ctx, -137);
}

function paintHairBack(ctx: Ctx, length: number): void {
  ctx.fillStyle = hairFill(ctx, -130, -130 + length);
  roundRect(ctx, -30, -130, 60, length, [20, 20, 14, 14]);
  ctx.fill();
  outline(ctx, 1.2);
}

function paintPonytail(ctx: Ctx): void {
  ctx.fillStyle = hairFill(ctx, -128, -86);
  ctx.beginPath();
  ctx.moveTo(18, -126);
  ctx.quadraticCurveTo(40, -122, 36, -96);
  ctx.quadraticCurveTo(34, -84, 28, -86);
  ctx.quadraticCurveTo(30, -104, 16, -112);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 1.2);
}

function paintBun(ctx: Ctx): void {
  ctx.fillStyle = radial(ctx, 0, -141, 0, 14, [
    [0, LIT],
    [1, DARK],
  ], -4, -146);
  ctx.beginPath();
  ctx.arc(0, -141, 13, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, 1.2);
}

function paintVest(ctx: Ctx): void {
  ctx.fillStyle = hGradient(ctx, -23, 23, [
    [0, '#1a1a24'],
    [0.35, '#3a3a4c'],
    [1, '#16161e'],
  ]);
  ctx.beginPath();
  ctx.moveTo(-22, -70);
  ctx.lineTo(-9, -84);
  ctx.lineTo(0, -64);
  ctx.lineTo(9, -84);
  ctx.lineTo(22, -70);
  ctx.lineTo(23, -32);
  ctx.quadraticCurveTo(22, -27, 16, -27);
  ctx.lineTo(-16, -27);
  ctx.quadraticCurveTo(-22, -27, -23, -32);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d4af37';
  [-56, -46, -36].forEach((y) => {
    ctx.beginPath();
    ctx.arc(0, y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  });
}

function paintBowTie(ctx: Ctx): void {
  ctx.fillStyle = vGradient(ctx, -86, -74, [
    [0, '#e05a4a'],
    [1, '#8e2318'],
  ]);
  ctx.beginPath();
  ctx.moveTo(-11, -85);
  ctx.lineTo(-11, -73);
  ctx.lineTo(0, -79);
  ctx.closePath();
  ctx.moveTo(11, -85);
  ctx.lineTo(11, -73);
  ctx.lineTo(0, -79);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -79, 2.6, 0, Math.PI * 2);
  ctx.fill();
}

function paintChefApron(ctx: Ctx): void {
  ctx.fillStyle = vGradient(ctx, -66, -24, [
    [0, '#f4f0e8'],
    [1, '#cfc7b8'],
  ]);
  roundRect(ctx, -20, -66, 40, 40, 8);
  ctx.fill();
  outline(ctx, 1);
  // Double-breasted buttons.
  ctx.fillStyle = '#9a9286';
  [-76, -66].forEach((y) =>
    [-8, 8].forEach((x) => {
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }),
  );
}

// extra: how much taller the hat is (the tall one for head chefs).
function paintToque(ctx: Ctx, extra = 0): void {
  ctx.save();
  ctx.translate(0, -extra);
  ctx.fillStyle = vGradient(ctx, -170, -124, [
    [0, '#ffffff'],
    [1, '#d9d4ca'],
  ]);
  ctx.beginPath();
  ctx.arc(-12, -150, 13, 0, Math.PI * 2);
  ctx.arc(0, -157, 15, 0, Math.PI * 2);
  ctx.arc(12, -150, 13, 0, Math.PI * 2);
  ctx.fill();
  roundRect(ctx, -17, -150, 34, 24 + extra, 5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1.5;
  [-6, 6].forEach((x) => {
    ctx.beginPath();
    ctx.moveTo(x, -146);
    ctx.lineTo(x, -128);
    ctx.stroke();
  });
  ctx.restore();
  ctx.fillStyle = vGradient(ctx, -132, -124, [
    [0, '#ece7dd'],
    [1, '#bdb6a8'],
  ]);
  roundRect(ctx, -18, -132, 36, 8, 3);
  ctx.fill();
}

function paintRubberApron(ctx: Ctx): void {
  ctx.fillStyle = hGradient(ctx, -21, 21, [
    [0, '#c98f00'],
    [0.35, '#ffd34d'],
    [1, '#b88200'],
  ]);
  roundRect(ctx, -20, -72, 40, 44, [6, 6, 10, 10]);
  ctx.fill();
  outline(ctx, 1);
  ctx.strokeStyle = '#b88200';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-16, -72);
  ctx.lineTo(-10, -88);
  ctx.moveTo(16, -72);
  ctx.lineTo(10, -88);
  ctx.stroke();
}

function paintSash(ctx: Ctx): void {
  // Gold sash and a camera: a well-off food tourist.
  ctx.strokeStyle = '#f4b400';
  ctx.lineWidth = 8;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(-20, -84);
  ctx.lineTo(18, -32);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-22, -82);
  ctx.lineTo(16, -30);
  ctx.stroke();
  ctx.fillStyle = vGradient(ctx, -62, -42, [
    [0, '#4a4a56'],
    [1, '#1c1c22'],
  ]);
  roundRect(ctx, 4, -62, 26, 18, 4);
  ctx.fill();
  ctx.fillStyle = radial(ctx, 17, -53, 0, 7, [
    [0, '#d8f0fa'],
    [1, '#4a7a90'],
  ], 15, -55);
  ctx.beginPath();
  ctx.arc(17, -53, 6, 0, Math.PI * 2);
  ctx.fill();
}

function paintSunHat(ctx: Ctx): void {
  // Sunglasses.
  ctx.fillStyle = '#141414';
  roundRect(ctx, -17, -114, 14, 10, 4);
  ctx.fill();
  roundRect(ctx, 3, -114, 14, 10, 4);
  ctx.fill();
  ctx.fillRect(-4, -111, 8, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(-14, -112, 4, 3);
  ctx.fillRect(6, -112, 4, 3);
  // Wide straw hat with a gold band.
  ctx.fillStyle = radial(ctx, 0, -128, 0, 40, [
    [0, '#fbf0d8'],
    [1, '#c9b48a'],
  ]);
  ellipse(ctx, 0, -128, 40, 9);
  ctx.fill();
  outline(ctx, 1);
  ctx.fillStyle = vGradient(ctx, -152, -126, [
    [0, '#fff7e4'],
    [1, '#d6c39a'],
  ]);
  roundRect(ctx, -20, -152, 40, 26, 11);
  ctx.fill();
  ctx.fillStyle = '#f4b400';
  ctx.fillRect(-20, -135, 40, 6);
}

// A black tailcoat over the white shirt: lapels, a shirt front and short tails at the hips.
function paintTailcoat(ctx: Ctx): void {
  const cloth = hGradient(ctx, -28, 28, [
    [0, '#14141c'],
    [0.32, '#3a3a4a'],
    [0.7, '#24242f'],
    [1, '#101016'],
  ]);
  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.moveTo(-18, -89);
  ctx.quadraticCurveTo(-29, -86, -28, -72);
  ctx.lineTo(-27, -22);
  ctx.lineTo(-14, -30);
  ctx.lineTo(14, -30);
  ctx.lineTo(27, -22);
  ctx.lineTo(28, -72);
  ctx.quadraticCurveTo(29, -86, 18, -89);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 1.2);
  // White shirt front between the lapels.
  ctx.fillStyle = vGradient(ctx, -88, -48, [
    [0, '#ffffff'],
    [1, '#dcdcdc'],
  ]);
  ctx.beginPath();
  ctx.moveTo(-10, -88);
  ctx.lineTo(10, -88);
  ctx.lineTo(0, -48);
  ctx.closePath();
  ctx.fill();
  // Satin lapels.
  ctx.fillStyle = '#4a4a5e';
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.moveTo(side * 10, -88);
    ctx.lineTo(side * 16, -78);
    ctx.lineTo(side * 6, -60);
    ctx.lineTo(0, -48);
    ctx.closePath();
    ctx.fill();
  });
  ctx.fillStyle = '#d4af37';
  [-44, -36].forEach((y) =>
    [-5, 5].forEach((x) => {
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }),
  );
  // Pocket square.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(14, -66);
  ctx.lineTo(22, -66);
  ctx.lineTo(18, -61);
  ctx.closePath();
  ctx.fill();
}

// A short apron tied at the waist: the simple first look of waiters and cooks.
function paintWaistApron(ctx: Ctx): void {
  ctx.fillStyle = vGradient(ctx, -40, -6, [
    [0, '#3a3a46'],
    [1, '#1e1e26'],
  ]);
  roundRect(ctx, -22, -40, 44, 34, [3, 3, 8, 8]);
  ctx.fill();
  outline(ctx, 1);
  ctx.fillStyle = '#2a2a34';
  ctx.fillRect(-25, -42, 50, 5);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  roundRect(ctx, -12, -30, 14, 10, 2);
  ctx.fill();
}

// A knotted scarf at the neck, painted grey and tinted per wearer.
function paintNeckerchief(ctx: Ctx): void {
  ctx.fillStyle = vGradient(ctx, -88, -66, [
    [0, LIT],
    [1, DARK],
  ]);
  ctx.beginPath();
  ctx.moveTo(-15, -88);
  ctx.quadraticCurveTo(0, -82, 15, -88);
  ctx.lineTo(4, -78);
  ctx.lineTo(7, -64);
  ctx.lineTo(0, -68);
  ctx.lineTo(-7, -64);
  ctx.lineTo(-4, -78);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 1);
  ctx.fillStyle = MID;
  ctx.beginPath();
  ctx.arc(0, -80, 4, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, 1);
}

// Food critic: a dark red beret, slightly tilted, and round glasses.
function paintBeret(ctx: Ctx): void {
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 2.2;
  [-10, 10].forEach((x) => {
    ctx.beginPath();
    ctx.arc(x, -109, 6.5, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.beginPath();
  ctx.moveTo(-3.5, -109);
  ctx.lineTo(3.5, -109);
  ctx.stroke();
  ctx.save();
  ctx.translate(4, -134);
  ctx.rotate(0.12);
  ctx.fillStyle = radial(ctx, 0, 0, 0, 26, [
    [0, '#c0392b'],
    [1, '#6e1a14'],
  ], -6, -4);
  ellipse(ctx, 0, 0, 25, 10);
  ctx.fill();
  outline(ctx, 1);
  ctx.fillStyle = '#6e1a14';
  roundRect(ctx, -2, -14, 4, 6, 2);
  ctx.fill();
  ctx.restore();
}

// Food critic: a notepad and a pen held in front of the body.
function paintNotepad(ctx: Ctx): void {
  ctx.save();
  ctx.translate(14, -60);
  ctx.rotate(-0.15);
  ctx.fillStyle = '#7a4a2a';
  roundRect(ctx, -11, -15, 22, 28, 3);
  ctx.fill();
  ctx.fillStyle = '#fffdf4';
  roundRect(ctx, -9, -12, 18, 23, 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,90,160,0.6)';
  ctx.lineWidth = 1.2;
  [-6, -1, 4].forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(-6, y);
    ctx.lineTo(6, y);
    ctx.stroke();
  });
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-14, 10);
  ctx.lineTo(-4, -4);
  ctx.stroke();
  ctx.restore();
}

// Tourist: a bright orange cap with a visor.
function paintCap(ctx: Ctx): void {
  ctx.fillStyle = vGradient(ctx, -150, -126, [
    [0, '#ffa64d'],
    [1, '#e0701a'],
  ]);
  ctx.beginPath();
  ctx.arc(0, -128, 21, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 1);
  ctx.fillStyle = '#c85a10';
  roundRect(ctx, 6, -131, 26, 7, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ellipse(ctx, -7, -141, 7, 3);
  ctx.fill();
}

// Courier: a white scooter helmet with a teal stripe and a chin strap.
function paintHelmet(ctx: Ctx): void {
  ctx.fillStyle = radial(ctx, -6, -140, 0, 26, [
    [0, '#ffffff'],
    [1, '#cfd6d8'],
  ], -8, -146);
  ctx.beginPath();
  ctx.arc(0, -126, 24, Math.PI, 0);
  ctx.lineTo(24, -120);
  ctx.lineTo(-24, -120);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 1);
  ctx.fillStyle = '#2a9d8f';
  ctx.fillRect(-4, -150, 8, 30);
  ctx.strokeStyle = '#3a3a3a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-21, -121);
  ctx.quadraticCurveTo(-18, -100, 0, -97);
  ctx.quadraticCurveTo(18, -100, 21, -121);
  ctx.stroke();
}

// Courier: an insulated delivery box on the back (it shows past the shoulders) and its straps.
function paintDeliveryBag(ctx: Ctx): void {
  ctx.fillStyle = vGradient(ctx, -124, -88, [
    [0, '#ffd45a'],
    [1, '#e09a0b'],
  ]);
  roundRect(ctx, -32, -124, 64, 38, 6);
  ctx.fill();
  outline(ctx, 1.5);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(-29, -117, 58, 4);
  ctx.strokeStyle = '#2b2b2b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-13, -88);
  ctx.lineTo(-11, -52);
  ctx.moveTo(13, -88);
  ctx.lineTo(11, -52);
  ctx.stroke();
}
