import Phaser from 'phaser';
import { CELL, PEOPLE_TEXTURE, ensurePeopleAtlas, type Part } from './characterArt';
import { depthScale, type Point } from './layout';
import { ART_RES, type Ctx, addArt, ellipse, paintTexture, radial } from './paint';

export type PersonKind = 'customer' | 'waiter' | 'chef' | 'cashier' | 'dishwasher' | 'vip' | 'critic' | 'tourist' | 'courier' | 'valet';

const SKIN_TONES = [0xffdcbf, 0xf3c29b, 0xd9a27a, 0xb07a52, 0x82573a];
const SHIRT_COLORS = [0xe0503f, 0x2f88a8, 0x5fae4a, 0xf5a623, 0x9466c0, 0x45b0d6, 0xec7aa6, 0x7d8a93];
const PANTS_COLORS = [0x3f5f8f, 0x34343f, 0x6b5a48, 0x4a6b5a, 0x2e4a6e];
const HAIR_COLORS = [0x3a2a1e, 0x6b4630, 0xa8703a, 0xe8b84a, 0x262626, 0x8a3a24];
export type HairStyle = 'short' | 'long' | 'bob' | 'bun' | 'ponytail';

// A fixed look instead of a random one (the famous chefs of the collection).
export interface PersonLook {
  skin: number;
  hair: number;
  hairStyle: HairStyle;
  female: boolean;
  // Neckerchief color.
  scarf?: number;
}
const FEMALE_HAIR: HairStyle[] = ['long', 'bob', 'bun', 'ponytail'];
// Share of women among customers and staff, and of women customers wearing a skirt.
const FEMALE_SHARE = 0.5;
const SKIRT_SHARE = 0.6;
const STAFF_SHIRTS: Record<Exclude<PersonKind, 'customer'>, number> = {
  waiter: 0xffffff,
  chef: 0xffffff,
  cashier: 0xfff0d4,
  dishwasher: 0xb4def0,
  vip: 0x8e4fb0,
  critic: 0x2a2a36,
  tourist: 0x45b0d6,
  courier: 0x2a9d8f,
  valet: 0xffffff,
};
const STAFF_PANTS = 0x2b2b3a;
const CHEF_PANTS = 0x6f7b84;
// Staff dress better as their section levels up (style tiers 0-3, see styleTier in core).
interface Look {
  shirt: number;
  // Sleeve color when it differs from the shirt (a jacket).
  sleeves?: number;
  body: Part[];
  head: Part[];
}
const RED_SCARF = 0xd8452b;
const BLUE_SCARF = 0x2f88a8;
const SERVICE_LOOKS = (simpleShirt: number): Look[] => [
  { shirt: simpleShirt, body: ['waistApron'], head: [] },
  { shirt: 0xffffff, body: ['vest'], head: [] },
  { shirt: 0xffffff, body: ['vest', 'bowTie'], head: [] },
  { shirt: 0xffffff, sleeves: 0x2a2a36, body: ['tailcoat', 'bowTie'], head: [] },
];
const STAFF_LOOKS: Partial<Record<PersonKind, Look[]>> = {
  // Valets wear a burgundy jacket with a bow tie and a cap.
  valet: [{ shirt: 0xffffff, sleeves: 0x7a2230, body: ['tailcoat', 'bowTie'], head: ['cap'] }],
  waiter: SERVICE_LOOKS(0x6fb3cf),
  cashier: SERVICE_LOOKS(0xf0c987),
  chef: [
    { shirt: 0xf2efe8, body: ['waistApron'], head: [] },
    { shirt: 0xffffff, body: ['chefApron'], head: ['toque'] },
    { shirt: 0xffffff, body: ['chefApron', 'neckerchief'], head: ['toque'] },
    { shirt: 0xffffff, body: ['chefApron', 'neckerchief'], head: ['tallToque'] },
  ],
  dishwasher: [
    { shirt: 0x9aa3a8, body: ['rubberApron'], head: [] },
    { shirt: 0xb4def0, body: ['rubberApron'], head: [] },
    { shirt: 0xb4def0, body: ['rubberApron', 'neckerchief'], head: [] },
    { shirt: 0xffffff, body: ['rubberApron', 'neckerchief'], head: [] },
  ],
};
const SCARF_TINT: Partial<Record<PersonKind, number>> = { chef: RED_SCARF, dishwasher: BLUE_SCARF };
// Fixed outfits for guests.
const OUTFITS: Partial<Record<PersonKind, { body?: Part; head?: Part }>> = {
  vip: { body: 'sash', head: 'sunHat' },
  critic: { body: 'notepad', head: 'beret' },
  tourist: { body: 'sash', head: 'cap' },
  courier: { body: 'deliveryBag', head: 'helmet' },
};

// Parts are placed by a pivot: the point of the character cell (feet at 0,0) that sits at the
// image's position, so a part rotates about its joint when it is put in a container at that joint.
function makePart(scene: Phaser.Scene, name: Part, tint?: number, pivotX = 0, pivotY = 0): Phaser.GameObjects.Image {
  const image = scene.add.image(0, 0, PEOPLE_TEXTURE, name).setScale(1 / ART_RES);
  image.setOrigin((CELL.left + pivotX) / CELL.width, (CELL.top + pivotY) / CELL.height);
  if (tint !== undefined) image.setTint(tint);
  return image;
}

export const WALK_SPEED = 165; // pixels per second, unhurried so the scene stays calm
const BLINK_MS = 140;

// Joints, in the cell's coordinates (feet at 0,0, up is negative).
const HIP_X = 8;
const HIP_Y = -50;
const KNEE_DROP = 25; // knee below the hip
const WAIST_Y = -56; // the torso, arms and head hang from here and lean about it
const ARM_ART_X = 25; // where the arm parts are painted, per side
const ARM_X_MALE = 25; // shoulder joints; women have narrower shoulders
const ARM_X_FEMALE = 21;
const SHOULDER_Y = -88;
const ELBOW_Y = -72;
const NECK_Y = -88; // the head art's neck, the pivot of the head, hats and hair
const HEAD_Y = -100; // where that pivot sits on the body (the neck is a separate part)
const HEAD_SCALE = 0.8;
const HANDS_Y = -64;
const SEAT_DROP = 32; // how far a seated person sinks, so the table hides the lower legs
// The clothes overlays were painted for a taller torso (y -88 to -26, hem at -26, waist pivot -44);
// a chest container maps that frame onto the new one (shoulders at -90, hem at -52).
const OLD_WAIST_Y = -44;
const CHEST_SCALE_Y = 0.613;
const CHEST_SCALE_X_MALE = 0.82;
const CHEST_SCALE_X_FEMALE = 0.72;
const CHEST_Y = -63; // where the old waist pivot lands on the new body

// Walk cycle. One step is half a cycle; the stride is fixed in world pixels, so a faster walker
// takes quicker steps instead of sliding.
const STEP_LENGTH = 50;
const LEG_SWING = 0.48; // radians
const KNEE_BEND = 0.8;
const ARM_SWING = 0.5;
const BOB_HEIGHT = 5;
const LEAN_DEGREES = 4;
const GAIT_EASE = 9; // per second, how quickly the stride fades in and out
const TURN_SECONDS = 0.12; // a left-right turn squashes the body through zero width

// Wears that look different from behind (the others are hidden in the back view).
const BACK_WEAR: Partial<Record<Part, Part>> = { tailcoat: 'tailcoatBack' };
// Outfit parts that are on the person's back, visible from both sides.
const BOTH_SIDES: Part[] = ['deliveryBag'];
const FACE_WEAR: Partial<Record<PersonKind, Part[]>> = {
  vip: ['sunGlasses'],
  critic: ['roundGlasses'],
  courier: ['helmetStrap'],
};

type Showable = Phaser.GameObjects.Image | Phaser.GameObjects.Container;

interface Leg {
  root: Phaser.GameObjects.Container;
  shin: Phaser.GameObjects.Container;
  side: -1 | 1;
}

interface Arm {
  root: Phaser.GameObjects.Container;
  // The sleeve (shirt tint) and the forearm container, which bends at the elbow.
  arm: Phaser.GameObjects.Image;
  elbow: Phaser.GameObjects.Container;
  side: -1 | 1;
}

const FACE_TURN = 5; // px the face shifts toward the walking direction

const approach = (value: number, target: number, rate: number): number => value + (target - value) * Math.min(1, rate);

// A painted character built from atlas parts (see characterArt.ts). The container's origin is at
// the feet, so depth = y sorts correctly. Joints (hips, knees, shoulders, neck) are containers,
// so the walk cycle, the seated pose and the idle motion are all transforms, no repainting.
export class Person extends Phaser.GameObjects.Container {
  private readonly figure: Phaser.GameObjects.Container;
  // The part above the waist: torso, arms and head.
  private readonly upper: Phaser.GameObjects.Container;
  private readonly head: Phaser.GameObjects.Container;
  // The face parts, shifted toward the walking direction for a 3/4 turn.
  private readonly faceGroup: Phaser.GameObjects.Container;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly legs: Leg[] = [];
  private readonly arms: Arm[] = [];
  private readonly skirt?: Phaser.GameObjects.Image;
  // Things carried in front of the body (plates).
  readonly hands: Phaser.GameObjects.Container;
  private walking = false;
  private move?: { tween: Phaser.Tweens.Tween; done: () => void };
  private readonly phaseOffset = Math.random() * Math.PI * 2;
  private readonly eyelids: Phaser.GameObjects.Image;
  private nextBlink = 1000 + Math.random() * 4000;
  // Working staff move their arms in place (stirring, scrubbing, counting money).
  busy = false;
  private readonly kind: PersonKind;
  private readonly torso: Phaser.GameObjects.Image;
  private readonly torsoBack: Phaser.GameObjects.Image;
  private readonly bodyWear: Phaser.GameObjects.Container;
  private readonly bodyWearBack: Phaser.GameObjects.Container;
  private readonly headWear: Phaser.GameObjects.Container;
  private readonly frontOnly: Showable[] = [];
  private readonly backOnly: Showable[] = [];
  private style = -1;
  private readonly scarf?: number;

  // Motion state.
  private stride = 0; // walk cycle angle: pi per step
  private gait = 0; // 0 standing, 1 walking, eased
  private dirX = 1; // smoothed walking direction on the screen
  private dirY = 0;
  private lastX: number;
  private lastY: number;
  private lastTime = -1;
  private facing: -1 | 1 = 1;
  private backView = false;
  private seated = false;
  private seatBlend = 0;
  private carryBlend = 0;
  private busyBlend = 0;
  private readonly shadowScale = 1 / ART_RES;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: PersonKind, look?: PersonLook) {
    super(scene, x, y);
    this.kind = kind;
    this.lastX = x;
    this.lastY = y;
    ensurePeopleAtlas(scene);
    const pick = <T>(list: T[]): T => Phaser.Utils.Array.GetRandom(list);
    this.scarf = look?.scarf;
    const skin = look?.skin ?? pick(SKIN_TONES);
    const hair = look?.hair ?? pick(HAIR_COLORS);
    const guest = kind === 'customer' || kind === 'vip' || kind === 'tourist';
    const shirt = kind === 'customer' || kind === 'tourist' ? pick(SHIRT_COLORS) : STAFF_SHIRTS[kind];
    const pants = kind === 'chef' ? CHEF_PANTS : guest ? pick(PANTS_COLORS) : STAFF_PANTS;
    const female = look?.female ?? Math.random() < FEMALE_SHARE;
    const hairStyle: HairStyle = look?.hairStyle ?? (female ? pick(FEMALE_HAIR) : 'short');
    const skirt = female && guest && Math.random() < SKIRT_SHARE;
    const outfit = OUTFITS[kind] ?? {};

    const part = (name: Part, tint?: number, px = 0, py = 0) => makePart(scene, name, tint, px, py);
    // Parts of the upper body hang from the waist; of the head, from the neck.
    const upperPart = (name: Part, tint?: number) => part(name, tint, 0, WAIST_Y);
    const headPart = (name: Part, tint?: number) => part(name, tint, 0, NECK_Y);
    // Overlays are painted in the old torso frame, see CHEST_* above.
    const chest = () => scene.add.container(0, CHEST_Y - WAIST_Y).setScale(female ? CHEST_SCALE_X_FEMALE : CHEST_SCALE_X_MALE, CHEST_SCALE_Y);
    const front = <T extends Showable>(item: T): T => (this.frontOnly.push(item), item);
    const back = <T extends Showable>(item: T): T => (this.backOnly.push(item), item);

    this.shadow = part('shadow');

    // Legs: hip container -> [shin container -> shin, shoe], thigh. The thigh is drawn over the
    // shin so the knee joint stays tidy when bent.
    for (const side of [-1, 1] as const) {
      const shin = scene.add.container(0, KNEE_DROP, [part('shin', skirt ? skin : pants, 0, HIP_Y + KNEE_DROP), part('shoe', undefined, 0, HIP_Y + KNEE_DROP)]);
      const root = scene.add.container(side * HIP_X, HIP_Y, [shin, part('thigh', skirt ? skin : pants, 0, HIP_Y)]);
      this.legs.push({ root, shin, side });
    }
    let pelvis: Phaser.GameObjects.Image | undefined;
    if (skirt) {
      this.skirt = part('skirt', pick(SHIRT_COLORS.filter((c) => c !== shirt)), 0, WAIST_Y).setPosition(0, WAIST_Y);
    } else {
      pelvis = part(female ? 'pelvisF' : 'pelvis', pants);
    }

    // Upper body.
    this.torso = front(upperPart(female ? 'torsoF' : 'torso', shirt));
    this.torsoBack = back(upperPart(female ? 'torsoBackF' : 'torsoBack', shirt));
    const neck = upperPart('neck', skin);
    for (const side of [-1, 1] as const) {
      const sleeve = part(side === -1 ? 'armLeft' : 'armRight', shirt, side * ARM_ART_X, SHOULDER_Y);
      const forearm = part(side === -1 ? 'forearmLeft' : 'forearmRight', skin, side * ARM_ART_X, ELBOW_Y);
      const hand = part(side === -1 ? 'handLeft' : 'handRight', skin, side * ARM_ART_X, ELBOW_Y);
      const elbow = scene.add.container(0, ELBOW_Y - SHOULDER_Y, [forearm, hand]);
      const root = scene.add.container(side * (female ? ARM_X_FEMALE : ARM_X_MALE), SHOULDER_Y - WAIST_Y, [elbow, sleeve]);
      this.arms.push({ root, arm: sleeve, elbow, side });
    }
    this.bodyWear = front(chest());
    this.bodyWearBack = back(chest());
    this.hands = scene.add.container(0, HANDS_Y - WAIST_Y);
    const upper: Phaser.GameObjects.GameObject[] = [this.torso, this.torsoBack, neck, ...this.arms.map((a) => a.root), this.bodyWear, this.bodyWearBack];
    if (outfit.body) {
      const both = BOTH_SIDES.includes(outfit.body);
      const outfitChest = chest().add(part(outfit.body, undefined, 0, OLD_WAIST_Y));
      upper.push(both ? outfitChest : front(outfitChest));
    }

    // Head: the hair that hangs behind the head is drawn before it in front, after it from behind.
    this.eyelids = front(headPart('eyelids', skin).setVisible(false));
    const headParts: Phaser.GameObjects.GameObject[] = [];
    if (hairStyle === 'long') headParts.push(front(headPart('hairLong', hair)));
    if (hairStyle === 'bob') headParts.push(front(headPart('hairBob', hair)));
    if (hairStyle === 'ponytail') headParts.push(front(headPart('hairPonytail', hair)));
    const faceParts: Phaser.GameObjects.GameObject[] = [front(headPart('shine')), front(headPart(female ? 'faceFemale' : 'faceMale')), this.eyelids];
    faceParts.push(front(headPart(female ? 'hairTop' : 'hairShort', hair)));
    for (const name of FACE_WEAR[kind] ?? []) faceParts.push(front(headPart(name)));
    this.faceGroup = scene.add.container(0, 0, faceParts);
    headParts.push(headPart('head', skin), this.faceGroup, back(headPart('hairCapBack', hair)));
    if (hairStyle === 'long') headParts.push(back(headPart('hairLong', hair)));
    if (hairStyle === 'bob') headParts.push(back(headPart('hairBob', hair)));
    if (hairStyle === 'ponytail') headParts.push(back(headPart('hairPonytailBack', hair)));
    if (hairStyle === 'bun') headParts.push(headPart('hairBun', hair));
    if (outfit.head) headParts.push(headPart(outfit.head));
    this.headWear = scene.add.container(0, 0);
    headParts.push(this.headWear);
    this.head = scene.add.container(0, HEAD_Y - WAIST_Y, headParts).setScale(HEAD_SCALE);
    upper.push(this.hands, this.head);
    this.upper = scene.add.container(0, WAIST_Y, upper);

    this.figure = scene.add.container(0, 0, [...this.legs.map((l) => l.root), ...(pelvis ? [pelvis] : []), ...(this.skirt ? [this.skirt] : []), this.upper]);
    this.add([this.shadow, this.figure]);
    this.shadow.setScale(this.shadowScale);
    this.backOnly.forEach((item) => item.setVisible(false));
    this.setDepth(y).setScale(depthScale(y));
    this.setStyle(0);
    scene.add.existing(this);
    this.applyPose(0);
  }

  // Dresses staff for their section's style tier. Returns true when the look changed.
  setStyle(tier: number): boolean {
    const looks = STAFF_LOOKS[this.kind];
    if (!looks) return false;
    const index = Phaser.Math.Clamp(tier, 0, looks.length - 1);
    if (index === this.style) return false;
    this.style = index;
    const look = looks[index];
    this.torso.setTint(look.shirt);
    this.torsoBack.setTint(look.shirt);
    this.arms.forEach(({ arm }) => arm.setTint(look.sleeves ?? look.shirt));
    const wear = (name: Part, px: number, py: number) =>
      makePart(this.scene, name, name === 'neckerchief' ? (this.scarf ?? SCARF_TINT[this.kind]) : undefined, px, py);
    this.bodyWear.removeAll(true).add(look.body.map((name) => wear(name, 0, OLD_WAIST_Y)));
    this.bodyWearBack.removeAll(true).add(
      look.body.flatMap((name) => {
        const backName = BACK_WEAR[name];
        return backName ? [wear(backName, 0, OLD_WAIST_Y)] : [];
      }),
    );
    this.headWear.removeAll(true).add(look.head.map((name) => wear(name, 0, NECK_Y)));
    return true;
  }

  // A guest of the restaurant (not staff).
  get isGuest(): boolean {
    return this.kind === 'customer' || this.kind === 'vip' || this.kind === 'critic' || this.kind === 'tourist';
  }

  get isWalking(): boolean {
    return this.walking;
  }

  // Walk to a point; resolves when arrived. A new walk replaces the current one, which then
  // resolves where the person stopped.
  walkTo(target: Point, speed = WALK_SPEED): Promise<void> {
    this.stopWalking();
    const distance = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
    if (distance < 1) return Promise.resolve();
    this.walking = true;
    this.seated = false;
    this.dirX = (target.x - this.x) / distance;
    this.dirY = (target.y - this.y) / distance;
    if (Math.abs(target.x - this.x) > 0.5) this.facing = target.x < this.x ? -1 : 1;
    return new Promise((resolve) => {
      const tween = this.scene.tweens.add({
        targets: this,
        x: target.x,
        y: target.y,
        duration: (distance / speed) * 1000,
        onUpdate: () => this.setDepth(this.y),
        onComplete: () => this.endWalk(false),
      });
      this.move = { tween, done: resolve };
    });
  }

  stopWalking(): void {
    this.endWalk(true);
  }

  private endWalk(interrupted: boolean): void {
    const move = this.move;
    if (!move) return;
    this.move = undefined;
    if (interrupted) move.tween.stop();
    this.walking = false;
    move.done();
  }

  // Turns to look left (-1) or right (1), with a quick squash instead of a flip.
  face(direction: -1 | 1): void {
    this.facing = direction;
  }

  // Sits down: the body sinks, thighs point forward and the table hides the lower legs.
  sit(): void {
    this.seated = true;
  }

  // Called every frame: the walk cycle, the seated pose, working arms and idle breathing.
  animate(time: number): void {
    const dt = this.lastTime < 0 ? 0 : Math.min(0.1, (time - this.lastTime) / 1000);
    this.lastTime = time;
    const dx = this.x - this.lastX;
    const dy = this.y - this.lastY;
    this.lastX = this.x;
    this.lastY = this.y;
    const moved = Math.hypot(dx, dy);
    if (this.walking && moved > 0.01 && moved < 80) {
      this.stride += (Math.PI * moved) / STEP_LENGTH;
      const k = Math.min(1, dt * 10);
      this.dirX += (dx / moved - this.dirX) * k;
      this.dirY += (dy / moved - this.dirY) * k;
      const length = Math.hypot(this.dirX, this.dirY) || 1;
      this.dirX /= length;
      this.dirY /= length;
    }
    const rate = dt * GAIT_EASE;
    this.gait = approach(this.gait, this.walking ? 1 : 0, rate);
    this.seatBlend = approach(this.seatBlend, this.seated ? 1 : 0, dt * 12);
    this.carryBlend = approach(this.carryBlend, this.hands.length > 0 ? 1 : 0, dt * 10);
    this.busyBlend = approach(this.busyBlend, this.busy && !this.walking && !this.seated ? 1 : 0, dt * 8);

    // Left-right turns squash the body through zero width.
    const turn = dt / TURN_SECONDS * 2;
    const scaleX = this.figure.scaleX;
    this.figure.scaleX = scaleX < this.facing ? Math.min(this.facing, scaleX + turn) : Math.max(this.facing, scaleX - turn);
    // Walking mostly up the screen shows the back.
    const backView = this.walking && this.dirY < 0 && Math.abs(this.dirY) > Math.abs(this.dirX);
    if (backView !== this.backView) {
      this.backView = backView;
      this.frontOnly.forEach((item) => item.setVisible(!backView));
      this.backOnly.forEach((item) => item.setVisible(backView));
      this.eyelids.setVisible(false);
    }

    this.applyPose(time);
    this.setScale(depthScale(this.y));
    this.blink(time);
  }

  private applyPose(time: number): void {
    const g = this.gait;
    const seat = this.seatBlend;
    const idle = (1 - g) * (1 - seat);
    const ph = this.phaseOffset;
    const hx = Math.abs(this.dirX);
    const vy = this.dirY;
    const cycle = this.stride;

    // Legs: opposite phases. A leg swings forward while it is lifted (cos > 0) and its shin trails.
    for (const [i, leg] of this.legs.entries()) {
      const q = cycle + i * Math.PI;
      const s = Math.sin(q);
      const lift = Math.max(0, Math.cos(q)) * g;
      const thigh = Phaser.Math.Linear(-s * LEG_SWING * hx * g, -1.4, seat);
      const knee = Phaser.Math.Linear(lift * KNEE_BEND * (0.35 + 0.65 * hx), 1.45, seat);
      leg.root.rotation = thigh;
      leg.shin.rotation = knee;
      leg.root.x = leg.side * HIP_X * (1 - 0.45 * seat);
      leg.root.y = HIP_Y + (1 - seat) * (s * vy * 3 * g - lift * 3.5);
      leg.root.setScale(1 - lift * 0.05 + s * vy * 0.05 * g);
    }

    // Body: bobs twice per stride (highest when the legs pass), sways and leans into the walk.
    const bob = Math.abs(Math.cos(cycle)) * g;
    const sway = Math.sin(cycle) * g;
    this.figure.y = -bob * BOB_HEIGHT + seat * SEAT_DROP;
    this.figure.x = sway * 1.2 + Math.sin(time * 0.0011 + ph) * 0.9 * idle;
    this.upper.angle = LEAN_DEGREES * hx * g + sway * 1.2 + Math.sin(time * 0.0009 + ph) * 0.5 * idle + Math.sin(time * 0.011 + ph) * 1 * this.busyBlend;
    this.upper.x = sway * 1.4;
    // A walking figure turns a little away from the camera: narrower body, face shifted forward.
    this.upper.scaleX = 1 - 0.1 * hx * g;
    this.faceGroup.x = FACE_TURN * hx * g;
    this.upper.scaleY = 1 + Math.sin(time * 0.003 + ph) * 0.012;
    // The head trails the body a little.
    this.head.angle = -this.upper.angle * 0.5 + Math.sin(time * 0.0017 + ph) * 0.6 * idle;
    this.head.y = HEAD_Y - WAIST_Y + (bob - Math.abs(Math.cos(cycle - 0.6)) * g) * 2;
    if (this.skirt) {
      this.skirt.rotation = sway * 0.05;
      // Seated, the thighs fold forward: squash the skirt so no hem sticks out under the table.
      this.skirt.setScale((1 + Math.abs(sway) * 0.03) / ART_RES, (1 - seat * 0.3) / ART_RES);
      this.skirt.y = WAIST_Y;
    }

    // Arms swing against the legs, bending a little at the elbow; carrying a plate the forearms come
    // up in front of the body, and working staff stir with a bent arm.
    const carry = this.carryBlend;
    const work = this.busyBlend;
    for (const { root, elbow, side } of this.arms) {
      const s = Math.sin(cycle + (side === -1 ? Math.PI : 0)) * g;
      const swing = -s * ARM_SWING * hx + Math.sin(time * 0.003 + ph) * 0.03;
      const stir = side * 0.35 + Math.sin(time * 0.012 + ph + (side === -1 ? 0 : 1.7)) * 0.25;
      let angle = Phaser.Math.Linear(swing, stir, work);
      angle = Phaser.Math.Linear(angle, side * 0.25, carry);
      root.rotation = angle;
      const stirBend = side * (0.8 + Math.sin(time * 0.012 + ph + (side === -1 ? 1.2 : 2.9)) * 0.3);
      let bend = side * (0.1 + 0.14 * g);
      bend = Phaser.Math.Linear(bend, stirBend, work);
      bend = Phaser.Math.Linear(bend, side * 1.15, carry);
      elbow.rotation = bend;
      root.y = SHOULDER_Y - WAIST_Y + s * vy * 2.5;
    }

    // The contact shadow stays on the ground, stretches along the walk and shrinks as the body rises.
    this.shadow.setScale(this.shadowScale * (1 + 0.12 * hx * g) * (1 - 0.08 * bob), this.shadowScale * (1 - 0.08 * bob));
    this.shadow.setAlpha(1 - 0.18 * bob);
  }

  // Eyes close for a moment every few seconds.
  private blink(time: number): void {
    if (this.backView || time < this.nextBlink) return;
    const closed = time < this.nextBlink + BLINK_MS;
    this.eyelids.setVisible(closed);
    if (!closed) this.nextBlink = time + 2500 + Math.random() * 4000;
  }

  destroy(fromScene?: boolean): void {
    this.move?.tween.stop();
    this.move = undefined;
    super.destroy(fromScene);
  }
}


// A plate with food; the food is painted in grey and tinted with the dish color.
export function createPlate(scene: Phaser.Scene, foodColor: number): Phaser.GameObjects.Container {
  const plate = addArt(scene, 0, 0, paintTexture(scene, 'plate', 64, 26, paintPlate), 32, 12);
  const food = addArt(scene, 0, 0, paintTexture(scene, 'food', 40, 24, paintFood), 20, 18).setTint(foodColor);
  return scene.add.container(0, 0, [plate, food]);
}

function paintPlate(ctx: Ctx): void {
  ctx.translate(32, 12);
  ctx.fillStyle = '#b9b1a3';
  ellipse(ctx, 0, 3, 29, 9);
  ctx.fill();
  ctx.fillStyle = radial(ctx, 0, 0, 0, 30, [
    [0, '#f4f0e8'],
    [0.55, '#ffffff'],
    [1, '#d9d2c4'],
  ]);
  ellipse(ctx, 0, 0, 29, 9);
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,150,135,0.6)';
  ctx.lineWidth = 1.2;
  ellipse(ctx, 0, 0, 19, 5.5);
  ctx.stroke();
}

function paintFood(ctx: Ctx): void {
  ctx.translate(20, 18);
  ctx.fillStyle = radial(ctx, 0, -6, 0, 18, [
    [0, '#ffffff'],
    [0.7, '#d0d0d0'],
    [1, '#8c8c8c'],
  ], -5, -11);
  ellipse(ctx, 0, -6, 17, 9);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ellipse(ctx, -5, -10, 5, 2);
  ctx.fill();
}
