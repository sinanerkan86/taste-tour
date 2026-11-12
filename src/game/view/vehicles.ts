import Phaser from 'phaser';
import { type Ctx, addArt, css, ellipse, hGradient, paintTexture, radial, roundRect, vGradient } from './paint';
import type { VehicleShape, VehicleSpec } from './streetThemes';

// Vehicles seen from the side (with a hint of the roof), facing right. Each is a body texture
// plus wheel textures that spin as it drives. Origin: the ground under the middle of the vehicle.

interface Shape {
  length: number;
  height: number;
  // Height of the window line above the ground.
  belt: number;
  // Cabin outline, x from the middle: where the rear window meets the belt, the roof's back
  // and front ends, and where the windscreen meets the belt.
  rearBase: number;
  roofBack: number;
  roofFront: number;
  frontBase: number;
  wheel: number;
  wheels: [number, number];
  // Corner rounding of the lower body.
  round: number;
}

const SHAPES: Record<Exclude<VehicleShape, 'tuktuk' | 'scooter'>, Shape> = {
  sedan: { length: 330, height: 128, belt: 72, rearBase: -118, roofBack: -84, roofFront: 34, frontBase: 84, wheel: 26, wheels: [-104, 104], round: 20 },
  hatch: { length: 290, height: 130, belt: 70, rearBase: -136, roofBack: -118, roofFront: 26, frontBase: 76, wheel: 25, wheels: [-94, 94], round: 22 },
  van: { length: 350, height: 160, belt: 84, rearBase: -170, roofBack: -168, roofFront: 92, frontBase: 140, wheel: 27, wheels: [-114, 116], round: 16 },
  minibus: { length: 380, height: 172, belt: 86, rearBase: -186, roofBack: -184, roofFront: 150, frontBase: 180, wheel: 27, wheels: [-122, 126], round: 14 },
  bug: { length: 270, height: 124, belt: 64, rearBase: -112, roofBack: -52, roofFront: 18, frontBase: 70, wheel: 25, wheels: [-86, 86], round: 44 },
  kei: { length: 240, height: 140, belt: 68, rearBase: -118, roofBack: -116, roofFront: 52, frontBase: 92, wheel: 21, wheels: [-80, 80], round: 16 },
};

export interface VehicleArt {
  key: string;
  width: number;
  height: number;
  wheelKey: string;
  wheelRadius: number;
  wheels: number[];
}

const PAD = 30;

// left: the vehicle faces left (painted mirrored, so writing on it still reads).
export function vehicleArt(scene: Phaser.Scene, spec: VehicleSpec, body: number, left: boolean): VehicleArt {
  const key = `vehicle-${spec.shape}-${body.toString(16)}-${(spec.trim ?? 0).toString(16)}-${spec.taxi ? 't' : ''}${spec.checker ? 'c' : ''}${left ? '-l' : ''}`;
  const mirror = (width: number, paint: (ctx: Ctx) => void) => (ctx: Ctx) => {
    if (left) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    paint(ctx);
  };
  const side = (xs: number[]) => (left ? xs.map((x) => -x) : xs);
  if (spec.shape === 'tuktuk') {
    paintTexture(scene, key, 260 + PAD * 2, 175, mirror(260 + PAD * 2, (ctx) => paintTukTuk(ctx, body, spec.trim ?? 0x2a2a2a)));
    return { key, width: 260 + PAD * 2, height: 175, wheelKey: wheelTexture(scene, 18), wheelRadius: 18, wheels: side([-72, 92]) };
  }
  if (spec.shape === 'scooter') {
    paintTexture(scene, key, 170 + PAD * 2, 175, mirror(170 + PAD * 2, (ctx) => paintScooter(ctx, body)));
    return { key, width: 170 + PAD * 2, height: 175, wheelKey: wheelTexture(scene, 16), wheelRadius: 16, wheels: side([-52, 54]) };
  }
  const shape = SHAPES[spec.shape];
  const width = shape.length + PAD * 2;
  const height = shape.height + 34;
  paintTexture(scene, key, width, height, mirror(width, (ctx) => paintCar(ctx, shape, spec, body, left)));
  return { key, width, height, wheelKey: wheelTexture(scene, shape.wheel), wheelRadius: shape.wheel, wheels: side(shape.wheels) };
}

// Builds a vehicle as a container: the body and its wheels.
export function createVehicle(scene: Phaser.Scene, art: VehicleArt, x: number, y: number): { container: Phaser.GameObjects.Container; wheels: Phaser.GameObjects.Image[] } {
  const body = addArt(scene, 0, 0, art.key, art.width / 2, art.height - 6);
  const wheels = art.wheels.map((wx) => addArt(scene, wx, -art.wheelRadius, art.wheelKey, art.wheelRadius + 2, art.wheelRadius + 2));
  const container = scene.add.container(x, y, [body, ...wheels]);
  return { container, wheels };
}

function wheelTexture(scene: Phaser.Scene, r: number): string {
  return paintTexture(scene, `wheel-${r}`, r * 2 + 4, r * 2 + 4, (ctx) => {
    ctx.translate(r + 2, r + 2);
    ctx.fillStyle = radial(ctx, 0, 0, r * 0.5, r, [
      [0, '#2a2a2c'],
      [0.85, '#1a1a1b'],
      [1, '#0d0d0e'],
    ]);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    const rim = r * 0.6;
    ctx.fillStyle = radial(ctx, -rim * 0.3, -rim * 0.3, 1, rim, [
      [0, '#f2f4f6'],
      [0.7, '#a9afb5'],
      [1, '#6b7177'],
    ]);
    ctx.beginPath();
    ctx.arc(0, 0, rim, 0, Math.PI * 2);
    ctx.fill();
    // Spokes, so the spin shows.
    ctx.fillStyle = '#5a6066';
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.rotate((i / 5) * Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(-rim * 0.12, -rim * 0.25);
      ctx.lineTo(rim * 0.12, -rim * 0.25);
      ctx.lineTo(rim * 0.2, -rim * 0.9);
      ctx.lineTo(-rim * 0.2, -rim * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#d9dde1';
    ctx.beginPath();
    ctx.arc(0, 0, rim * 0.22, 0, Math.PI * 2);
    ctx.fill();
  });
}

function shadowUnder(ctx: Ctx, halfLength: number): void {
  ctx.save();
  ctx.scale(1, 0.18);
  ctx.fillStyle = radial(ctx, 0, 0, 0, halfLength, [
    [0, 'rgba(0,0,0,0.5)'],
    [0.7, 'rgba(0,0,0,0.3)'],
    [1, 'rgba(0,0,0,0)'],
  ]);
  ctx.beginPath();
  ctx.arc(0, 0, halfLength, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintCar(ctx: Ctx, s: Shape, spec: VehicleSpec, body: number, mirrored: boolean): void {
  ctx.translate(PAD + s.length / 2, s.height + 28);
  const half = s.length / 2;
  const sill = s.wheel * 0.55;
  shadowUnder(ctx, half + 16);

  // Cabin first, so the body's shoulder overlaps its base.
  const cabin = () => {
    ctx.beginPath();
    ctx.moveTo(s.rearBase, -s.belt + 2);
    ctx.quadraticCurveTo(s.roofBack - 8, -s.height + 4, s.roofBack + 12, -s.height);
    ctx.lineTo(s.roofFront - 10, -s.height);
    ctx.quadraticCurveTo(s.roofFront + 6, -s.height + 2, s.frontBase, -s.belt + 2);
    ctx.closePath();
  };
  ctx.fillStyle = vGradient(ctx, -s.height, -s.belt, [
    [0, css(body, 0.18)],
    [1, css(body, -0.12)],
  ]);
  cabin();
  ctx.fill();
  // The roof seen from a little above.
  ctx.fillStyle = vGradient(ctx, -s.height - 7, -s.height + 2, [
    [0, css(body, 0.35)],
    [1, css(body, 0.05)],
  ]);
  roundRect(ctx, s.roofBack + 10, -s.height - 6, s.roofFront - s.roofBack - 20, 9, 4);
  ctx.fill();
  // Glass: two side windows split by the middle pillar.
  const inset = 7;
  const glassTop = -s.height + inset + 2;
  const glassBottom = -s.belt - 2;
  const pillar = (s.roofBack + s.roofFront) / 2 + 6;
  const glass = (x0: number, x1: number, slopeBack: boolean, slopeFront: boolean) => {
    const backTop = slopeBack ? s.roofBack + 14 : x0;
    const frontTop = slopeFront ? s.roofFront - 8 : x1;
    ctx.beginPath();
    ctx.moveTo(slopeBack ? s.rearBase + inset + 6 : x0, glassBottom);
    ctx.lineTo(backTop, glassTop);
    ctx.lineTo(frontTop, glassTop);
    ctx.lineTo(slopeFront ? s.frontBase - inset - 8 : x1, glassBottom);
    ctx.closePath();
    ctx.fillStyle = vGradient(ctx, glassTop, glassBottom, [
      [0, '#9fb7c8'],
      [0.5, '#4f6a80'],
      [1, '#2c3f50'],
    ]);
    ctx.fill();
  };
  glass(0, pillar - 5, true, false);
  glass(pillar + 5, 0, false, true);
  // A driver behind the front window.
  ctx.fillStyle = 'rgba(25,30,40,0.55)';
  ctx.beginPath();
  ctx.arc(pillar + 34, glassBottom - 26, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(pillar + 20, glassBottom - 16, 30, 16);
  // Sky reflection.
  ctx.save();
  cabin();
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.moveTo(s.rearBase + 40, glassBottom);
  ctx.lineTo(s.rearBase + 80, glassTop);
  ctx.lineTo(s.rearBase + 104, glassTop);
  ctx.lineTo(s.rearBase + 64, glassBottom);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Lower body.
  ctx.fillStyle = vGradient(ctx, -s.belt - 4, -sill, [
    [0, css(body, 0.3)],
    [0.18, css(body, 0.05)],
    [0.7, css(body, -0.08)],
    [1, css(body, -0.4)],
  ]);
  roundRect(ctx, -half, -s.belt - 4, s.length, s.belt + 4 - sill, [s.round * 0.7, s.round, s.round * 0.5, s.round * 0.5]);
  ctx.fill();
  // Shoulder highlight along the body.
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  roundRect(ctx, -half + 14, -s.belt + 4, s.length - 34, 3, 1.5);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(-half + 18, -s.belt + 40, s.length - 40, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(-half + 18, -s.belt + 42, s.length - 40, 1.5);
  ctx.fillStyle = vGradient(ctx, -sill - 16, -sill, [
    [0, 'rgba(0,0,0,0)'],
    [1, 'rgba(0,0,0,0.35)'],
  ]);
  ctx.fillRect(-half + 10, -sill - 16, s.length - 20, 16);
  // Taxi or minibus stripe, or a checker band.
  if (spec.checker) {
    const y = -s.belt + 22;
    for (let x = -half + 30, i = 0; x < half - 30; x += 8, i++) {
      for (let r = 0; r < 2; r++) {
        ctx.fillStyle = (i + r) % 2 === 0 ? '#1a1a1a' : '#f4f4f0';
        ctx.fillRect(x, y + r * 8, 8, 8);
      }
    }
  } else if (spec.trim !== undefined) {
    ctx.fillStyle = vGradient(ctx, -s.belt + 18, -s.belt + 32, [
      [0, css(spec.trim, 0.1)],
      [1, css(spec.trim, -0.15)],
    ]);
    ctx.fillRect(-half + 8, -s.belt + 18, s.length - 16, 14);
  }
  // Wheel arches.
  s.wheels.forEach((wx) => {
    ctx.fillStyle = '#121214';
    ctx.beginPath();
    ctx.arc(wx, -s.wheel, s.wheel + 6, Math.PI, 0);
    ctx.lineTo(wx + s.wheel + 6, -sill + 2);
    ctx.lineTo(wx - s.wheel - 6, -sill + 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = css(body, -0.35);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(wx, -s.wheel, s.wheel + 7, Math.PI, 0);
    ctx.stroke();
  });
  // Door seams and handles.
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 1.5;
  [pillar - 2, s.frontBase - 4].forEach((x) => {
    ctx.beginPath();
    ctx.moveTo(x, -s.belt);
    ctx.lineTo(x - 4, -sill - 6);
    ctx.stroke();
  });
  ctx.fillStyle = 'rgba(30,30,30,0.5)';
  [pillar - 28, s.frontBase - 30].forEach((x) => roundRect(ctx, x, -s.belt + 8, 16, 4, 2));
  ctx.fill();
  // Bumpers, lights and a mirror.
  ctx.fillStyle = vGradient(ctx, -sill - 14, -sill, [
    [0, '#5c5f63'],
    [1, '#2b2d30'],
  ]);
  roundRect(ctx, half - 22, -sill - 14, 26, 14, 5);
  ctx.fill();
  roundRect(ctx, -half - 4, -sill - 14, 26, 14, 5);
  ctx.fill();
  ctx.fillStyle = radial(ctx, half - 8, -s.belt + 14, 1, 12, [
    [0, '#ffffff'],
    [1, '#f3d98a'],
  ]);
  ellipse(ctx, half - 8, -s.belt + 14, 9, 7);
  ctx.fill();
  ctx.fillStyle = vGradient(ctx, -s.belt + 4, -s.belt + 24, [
    [0, '#ff6a5a'],
    [1, '#a8201a'],
  ]);
  roundRect(ctx, -half + 1, -s.belt + 4, 9, 20, 3);
  ctx.fill();
  ctx.fillStyle = css(body, -0.2);
  roundRect(ctx, s.frontBase - 16, -s.belt - 14, 16, 11, 4);
  ctx.fill();
  if (spec.taxi) {
    // Roof sign.
    const x = (s.roofBack + s.roofFront) / 2 - 24;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + 2, -s.height - 6, 48, 4);
    ctx.fillStyle = vGradient(ctx, -s.height - 22, -s.height - 5, [
      [0, '#fffbe8'],
      [1, spec.trim !== undefined ? css(spec.trim) : '#f2d24a'],
    ]);
    roundRect(ctx, x, -s.height - 22, 48, 17, 4);
    ctx.fill();
    ctx.font = '700 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1a1a1a';
    ctx.save();
    ctx.translate(x + 24, -s.height - 13);
    if (mirrored) ctx.scale(-1, 1);
    ctx.fillText('TAXI', 0, 0);
    ctx.restore();
  }
}

function paintTukTuk(ctx: Ctx, body: number, canopy: number): void {
  ctx.translate(PAD + 130, 168);
  shadowUnder(ctx, 140);
  const metal = (x0: number, x1: number) =>
    hGradient(ctx, x0, x1, [
      [0, '#3a3c40'],
      [0.5, '#9aa0a6'],
      [1, '#2e3034'],
    ]);
  // Canopy posts.
  ctx.fillStyle = metal(-4, 4);
  [-112, -10, 60].forEach((x) => ctx.fillRect(x - 3, -140, 6, 100));
  // Passenger in the back and the driver in front.
  const person = (x: number, shirt: string) => {
    ctx.fillStyle = shirt;
    roundRect(ctx, x - 16, -100, 32, 42, 10);
    ctx.fill();
    ctx.fillStyle = '#c8956c';
    ctx.beginPath();
    ctx.arc(x, -112, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a1e16';
    ctx.beginPath();
    ctx.arc(x, -116, 13, Math.PI, 0);
    ctx.fill();
  };
  person(-62, '#d9a441');
  person(28, '#3a6ea5');
  // Rear compartment with the bench.
  ctx.fillStyle = vGradient(ctx, -78, -16, [
    [0, css(body, 0.2)],
    [1, css(body, -0.35)],
  ]);
  ctx.beginPath();
  ctx.moveTo(-126, -16);
  ctx.lineTo(-126, -66);
  ctx.quadraticCurveTo(-122, -80, -106, -80);
  ctx.lineTo(-24, -80);
  ctx.lineTo(-10, -42);
  ctx.lineTo(40, -42);
  ctx.lineTo(40, -16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(-118, -74, 90, 3);
  // Front cowl with the headlight.
  ctx.fillStyle = vGradient(ctx, -96, -16, [
    [0, css(body, 0.25)],
    [1, css(body, -0.35)],
  ]);
  ctx.beginPath();
  ctx.moveTo(40, -16);
  ctx.lineTo(40, -60);
  ctx.quadraticCurveTo(78, -98, 112, -84);
  ctx.lineTo(118, -30);
  ctx.quadraticCurveTo(116, -16, 100, -16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = radial(ctx, 112, -66, 1, 10, [
    [0, '#ffffff'],
    [1, '#f3d98a'],
  ]);
  ellipse(ctx, 112, -66, 7, 9);
  ctx.fill();
  // Handlebar.
  ctx.strokeStyle = '#26282b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(62, -76);
  ctx.lineTo(48, -96);
  ctx.stroke();
  // Wheel wells.
  [-72, 92].forEach((x) => {
    ctx.fillStyle = '#121214';
    ctx.beginPath();
    ctx.arc(x, -18, 24, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
  });
  // The canopy roof with a fringe.
  ctx.fillStyle = vGradient(ctx, -158, -136, [
    [0, css(canopy, 0.25)],
    [1, css(canopy, -0.25)],
  ]);
  ctx.beginPath();
  ctx.moveTo(-128, -136);
  ctx.quadraticCurveTo(-126, -158, -100, -160);
  ctx.lineTo(56, -160);
  ctx.quadraticCurveTo(80, -156, 78, -136);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = css(canopy, -0.3);
  for (let x = -124; x < 76; x += 10) {
    ctx.beginPath();
    ctx.arc(x + 5, -136, 5, 0, Math.PI);
    ctx.fill();
  }
}

function paintScooter(ctx: Ctx, body: number): void {
  ctx.translate(PAD + 85, 168);
  shadowUnder(ctx, 90);
  // Rider: legs, jacket, helmet.
  ctx.fillStyle = '#2e3a4a';
  roundRect(ctx, -26, -72, 50, 18, 8);
  ctx.fill();
  ctx.fillRect(10, -66, 14, 44);
  ctx.fillStyle = '#5a3a2a';
  roundRect(ctx, 8, -26, 26, 9, 4);
  ctx.fill();
  ctx.fillStyle = vGradient(ctx, -128, -66, [
    [0, '#8a4a3a'],
    [1, '#5e2e22'],
  ]);
  roundRect(ctx, -28, -128, 40, 64, 14);
  ctx.fill();
  ctx.fillStyle = '#5e2e22';
  ctx.beginPath();
  ctx.moveTo(0, -116);
  ctx.lineTo(34, -98);
  ctx.lineTo(30, -90);
  ctx.lineTo(-4, -104);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c8956c';
  ctx.beginPath();
  ctx.arc(-6, -138, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = radial(ctx, -10, -150, 2, 18, [
    [0, '#ffffff'],
    [0.4, css(body, 0.1)],
    [1, css(body, -0.4)],
  ]);
  ctx.beginPath();
  ctx.arc(-6, -142, 16, Math.PI * 1.05, Math.PI * 2.05);
  ctx.closePath();
  ctx.fill();
  // Body: the rounded rear cowl, the floorboard and the leg shield.
  ctx.fillStyle = vGradient(ctx, -70, -14, [
    [0, css(body, 0.35)],
    [1, css(body, -0.3)],
  ]);
  ctx.beginPath();
  ctx.moveTo(-80, -22);
  ctx.quadraticCurveTo(-84, -66, -40, -70);
  ctx.lineTo(-6, -66);
  ctx.quadraticCurveTo(4, -40, 2, -22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3a3a3a';
  roundRect(ctx, -2, -24, 44, 8, 3);
  ctx.fill();
  ctx.fillStyle = vGradient(ctx, -100, -16, [
    [0, css(body, 0.3)],
    [1, css(body, -0.25)],
  ]);
  ctx.beginPath();
  ctx.moveTo(36, -20);
  ctx.quadraticCurveTo(48, -70, 40, -100);
  ctx.lineTo(52, -102);
  ctx.quadraticCurveTo(62, -64, 58, -22);
  ctx.closePath();
  ctx.fill();
  // Handlebar and headlight.
  ctx.strokeStyle = '#2b2b2b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(44, -104);
  ctx.lineTo(28, -100);
  ctx.stroke();
  ctx.fillStyle = radial(ctx, 54, -102, 1, 8, [
    [0, '#ffffff'],
    [1, '#f3d98a'],
  ]);
  ellipse(ctx, 54, -102, 6, 7);
  ctx.fill();
  // Front mudguard over the wheel.
  ctx.fillStyle = css(body, -0.05);
  ctx.beginPath();
  ctx.arc(54, -16, 20, Math.PI * 1.05, Math.PI * 1.95);
  ctx.lineTo(70, -14);
  ctx.lineTo(38, -14);
  ctx.closePath();
  ctx.fill();
}
