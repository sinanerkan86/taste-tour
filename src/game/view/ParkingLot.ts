import Phaser from 'phaser';
import { CROSSWALK, DRIVEWAYS, LOT, LOT_SLOTS, STREET, VALET_DROP, WALK_LANES, type Point } from './layout';
import { CLOSED_TOP, coneTexture, lotClosedTexture, lotGroundTexture, lotWallTexture, parkingSignTexture, valetStandTexture, WALL_TOP } from './lot';
import { addArt } from './paint';
import { Person } from './Person';
import type { StreetLife, Vehicle } from './StreetLife';
import type { StreetTheme } from './streetThemes';
import { hasFrontView, vehicleFrontArt } from './vehicles';

// The parking lot across the street, run like the rest of the scene: cars leave the far lane at
// the entry driveway, drive along the one-way aisle and turn into a free slot (facing the
// viewer). Their passengers get out, walk to the zebra, wait for the traffic to stop and cross
// to the restaurant's pavement, where RestaurantView takes them in as customers. After a while
// the car backs out, drives on to the exit driveway and joins the traffic again.
// With valet service the car stops at the valet stand instead: the guests step out right there
// and a valet parks the car (and brings it back when it leaves).

const LANE = 1;
// Open slots grow with the lot's level.
const SLOTS_AT_START = 2;
const LEVELS_PER_SLOT = 10;
const AISLE_SPEED = 190;
const VALET_SPEED = 240;
const STAY_SECONDS = { min: 28, max: 55 };
// Parked cars are drawn a little smaller so they fit their slots.
const PARKED_SCALE = 0.86;
const WALK_X = (CROSSWALK.left + CROSSWALK.right) / 2;

interface Car {
  vehicle: Vehicle;
  front: Phaser.GameObjects.Image | null;
}

export interface LotHooks {
  addPerson: (person: Person) => Person;
  removePerson: (person: Person) => void;
  // A passenger has crossed the street and stands on the restaurant's pavement.
  onArrived: (person: Person) => void;
}

export function openSlotCount(level: number): number {
  return level <= 0 ? 0 : Math.min(LOT_SLOTS.length, SLOTS_AT_START + Math.floor(level / LEVELS_PER_SLOT));
}

export class ParkingLot {
  private level = -1;
  private valet = false;
  // Which car (or a car on its way) holds each slot.
  private readonly slots: (Car | 'reserved' | null)[] = LOT_SLOTS.map(() => null);
  private readonly decor: Phaser.GameObjects.GameObject[] = [];
  private closed: Phaser.GameObjects.Image | null = null;
  private stand: Phaser.GameObjects.Image | null = null;
  private attendant: Person | null = null;
  // One car moves along the aisle at a time; the others wait their turn.
  private aisleBusy = false;
  private readonly aisleQueue: (() => void)[] = [];
  private readonly direction: 1 | -1;
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly street: StreetTheme,
    private readonly streetLife: StreetLife,
    private readonly hooks: LotHooks,
  ) {
    this.direction = streetLife.direction(LANE);
    addArt(scene, 0, LOT.top, lotGroundTexture(scene, this.direction), 0, 0).setDepth(-995);
    addArt(scene, 0, WALL_TOP - 40, lotWallTexture(scene, street), 0, 0).setDepth(WALL_TOP + 10);
    const signX = this.direction === 1 ? DRIVEWAYS.left.to + 30 : DRIVEWAYS.right.from - 30;
    addArt(scene, signX, LOT.top + 40, parkingSignTexture(scene), 40, 160).setDepth(LOT.top + 40);
  }

  private get entry(): { from: number; to: number } {
    return this.direction === 1 ? DRIVEWAYS.left : DRIVEWAYS.right;
  }

  private get exit(): { from: number; to: number } {
    return this.direction === 1 ? DRIVEWAYS.right : DRIVEWAYS.left;
  }

  private get dropX(): number {
    return this.direction === 1 ? VALET_DROP.left : VALET_DROP.right;
  }

  // The valet's spot at the top edge of the lot, beside the stand.
  private get standSpot(): Point {
    return { x: this.dropX + this.direction * 30, y: LOT.top + 62 };
  }

  get openSlots(): number {
    return openSlotCount(this.level);
  }

  // Redraws what the lot level and valet service change. animate: just bought.
  sync(level: number, valet: boolean, animate: boolean): void {
    if (level === this.level && valet === this.valet) return;
    const first = this.level < 0;
    this.level = level;
    this.valet = valet;
    this.decor.forEach((d) => d.destroy());
    this.decor.length = 0;
    if (level <= 0) {
      this.closed ??= addArt(this.scene, 0, CLOSED_TOP, lotClosedTexture(this.scene), 0, 0).setDepth(LOT.top + 14);
    } else if (this.closed) {
      const closed = this.closed;
      this.closed = null;
      if (animate) this.scene.tweens.add({ targets: closed, alpha: 0, duration: 700, onComplete: () => closed.destroy() });
      else closed.destroy();
    }
    // Cones across the slots that are not open yet.
    const cone = coneTexture(this.scene);
    LOT_SLOTS.forEach((x, i) => {
      if (level <= 0 || i < this.openSlots) return;
      [-38, 38].forEach((dx) => this.decor.push(addArt(this.scene, x + dx, LOT.slot - 20, cone, 22, 60).setDepth(LOT.slot - 20)));
    });
    if (valet && !this.stand) {
      const spot = this.standSpot;
      this.stand = addArt(this.scene, spot.x + this.direction * 70, spot.y - 4, valetStandTexture(this.scene, this.street), 90, 230).setDepth(spot.y - 4);
      this.attendant = this.hooks.addPerson(new Person(this.scene, spot.x, spot.y, 'valet'));
      this.attendant.face(this.direction === 1 ? 1 : -1);
      if (animate) {
        this.stand.setAlpha(0);
        this.scene.tweens.add({ targets: this.stand, alpha: 1, duration: 500 });
      }
    }
    // Some cars are already parked when the scene opens.
    if (first && level > 0) {
      for (let i = 0; i < this.openSlots; i++) if (Math.random() < 0.6) this.parkAtStart(i);
    }
  }

  // Whether a car with guests could come now.
  canTakeCar(): boolean {
    return !this.destroyed && this.level > 0 && this.freeSlot() >= 0 && this.aisleQueue.length < 2;
  }

  private freeSlot(): number {
    const free = this.slots.flatMap((s, i) => (s === null && i < this.openSlots ? [i] : []));
    return free.length === 0 ? -1 : Phaser.Utils.Array.GetRandom(free);
  }

  private async useAisle(): Promise<void> {
    if (!this.aisleBusy) {
      this.aisleBusy = true;
      return;
    }
    await new Promise<void>((resolve) => this.aisleQueue.push(resolve));
  }

  private releaseAisle(): void {
    const next = this.aisleQueue.shift();
    if (next) next();
    else this.aisleBusy = false;
  }

  // A car brings `passengers` guests; each is handed to hooks.onArrived across the street.
  async bringCar(passengers: number): Promise<void> {
    const slot = this.freeSlot();
    if (slot < 0) return;
    this.slots[slot] = 'reserved';
    await this.useAisle();
    if (this.destroyed) return;
    const { spec, body } = this.streetLife.privateCar();
    const turnX = this.entry.from + (this.entry.to - this.entry.from) * (this.direction === 1 ? 0.25 : 0.75);
    const vehicle = await this.streetLife.callCar(LANE, spec, body, turnX);
    if (this.destroyed) return;
    const car: Car = { vehicle, front: null };
    this.slots[slot] = car;
    // Turn in through the driveway onto the aisle.
    await this.drive(car, { x: turnX + this.direction * 170, y: LOT.aisle }, 150);
    const slotX = LOT_SLOTS[slot];
    if (this.valet) {
      await this.drive(car, { x: this.dropX, y: LOT.aisle }, AISLE_SPEED);
      // Guests step out on the pavement side; the valet takes the wheel.
      const attendant = this.attendant;
      const dropped = this.spawnPassengers(passengers, { x: this.dropX, y: LOT.aisle - 30 });
      if (attendant?.active) {
        await attendant.walkTo({ x: this.dropX - this.direction * 40, y: LOT.aisle - 24 });
        attendant.setVisible(false);
      }
      await dropped;
      await this.delay(200);
      await this.drive(car, { x: slotX, y: LOT.aisle }, VALET_SPEED);
      await this.turnIn(car, slotX);
      this.releaseAisle();
      if (attendant?.active) {
        attendant.setPosition(slotX + 70, LOT.slot - 16).setVisible(true);
        void (async () => {
          await attendant.walkTo({ x: slotX + 70, y: LOT.slotTop - 20 });
          if (attendant.active) await attendant.walkTo(this.standSpot);
          if (attendant.active) attendant.face(this.direction === 1 ? 1 : -1);
        })();
      }
    } else {
      await this.drive(car, { x: slotX, y: LOT.aisle }, AISLE_SPEED);
      await this.turnIn(car, slotX);
      this.releaseAisle();
      await this.delay(300);
      void this.spawnPassengers(passengers, { x: slotX + 70, y: LOT.slot - 16 });
    }
    this.scene.time.delayedCall(Phaser.Math.Between(STAY_SECONDS.min, STAY_SECONDS.max) * 1000, () => void this.leave(slot));
  }

  // A parked car for the opening view, leaving after a random part of a stay.
  private parkAtStart(slot: number): void {
    const { spec, body } = this.streetLife.privateCar();
    if (!hasFrontView(spec.shape)) return;
    const art = vehicleFrontArt(this.scene, spec.shape, body);
    const front = addArt(this.scene, LOT_SLOTS[slot], LOT.slot, art.key, art.width / 2, art.height - 8).setDepth(LOT.slot);
    front.setScale(front.scaleX * PARKED_SCALE);
    this.slots[slot] = { vehicle: null as unknown as Vehicle, front };
    this.scene.time.delayedCall(Phaser.Math.Between(5, STAY_SECONDS.max) * 1000, () => {
      // These cars have no side view yet: they get one when they back out.
      const car = this.slots[slot];
      if (car === null || car === 'reserved') return;
      const direction = this.direction;
      car.vehicle = this.streetLife.parkedVehicle(spec, body, direction, LOT_SLOTS[slot], LOT.aisle, LANE);
      car.vehicle.container.setVisible(false);
      void this.leave(slot);
    });
  }

  // Each guest gets out, walks to the zebra, crosses and joins the restaurant's pavement.
  private async spawnPassengers(count: number, at: Point): Promise<void> {
    const walks: Promise<void>[] = [];
    for (let i = 0; i < count; i++) {
      if (this.destroyed) return;
      const person = this.hooks.addPerson(new Person(this.scene, at.x + Phaser.Math.Between(-10, 10), at.y, 'customer'));
      walks.push(this.walkToRestaurant(person));
      await this.delay(380);
    }
    await this.delay(200);
  }

  private async walkToRestaurant(person: Person): Promise<void> {
    const lane = Phaser.Math.Between(-22, 22);
    await person.walkTo({ x: person.x, y: Math.min(person.y, LOT.slotTop - 24) });
    await person.walkTo({ x: WALK_X + lane, y: LOT.top + 40 });
    await person.walkTo({ x: WALK_X + lane, y: STREET.roadBottom + 26 });
    await this.streetLife.requestCrossing();
    if (!person.active) {
      this.streetLife.endCrossing();
      return;
    }
    await person.walkTo({ x: WALK_X + lane, y: STREET.curb + 10 }, 200);
    this.streetLife.endCrossing();
    await person.walkTo({ x: WALK_X + lane, y: Phaser.Utils.Array.GetRandom(WALK_LANES) + Phaser.Math.Between(-6, 6) });
    if (person.active) this.hooks.onArrived(person);
  }

  // Swaps the side view for the front view while the car swings into the slot.
  private async turnIn(car: Car, x: number): Promise<void> {
    const { spec, body } = car.vehicle.spec;
    if (!hasFrontView(spec.shape)) return;
    const art = vehicleFrontArt(this.scene, spec.shape, body);
    const front = addArt(this.scene, x, LOT.aisle + 10, art.key, art.width / 2, art.height - 8).setDepth(LOT.aisle + 10);
    const full = front.scaleX * PARKED_SCALE;
    front.setScale(full * 0.4, full).setAlpha(0);
    car.front = front;
    const side = car.vehicle.container;
    this.scene.tweens.add({ targets: side, scaleX: 0.35, alpha: 0, duration: 260, onComplete: () => side.setVisible(false) });
    await new Promise<void>((resolve) =>
      this.scene.tweens.add({
        targets: front,
        scaleX: full,
        alpha: 1,
        y: LOT.slot,
        duration: 760,
        ease: 'Sine.easeOut',
        onUpdate: () => front.setDepth(front.y),
        onComplete: () => resolve(),
      }),
    );
  }

  private async turnOut(car: Car): Promise<void> {
    const front = car.front;
    const side = car.vehicle.container;
    side.setPosition(front ? front.x : side.x, LOT.aisle).setScale(0.35, 1).setAlpha(0).setVisible(true).setDepth(LOT.aisle);
    if (front) {
      await new Promise<void>((resolve) =>
        this.scene.tweens.add({
          targets: front,
          y: LOT.aisle + 10,
          scaleX: front.scaleX * 0.4,
          alpha: 0,
          duration: 700,
          ease: 'Sine.easeIn',
          onUpdate: () => front.setDepth(front.y),
          onComplete: () => resolve(),
        }),
      );
      front.destroy();
      car.front = null;
    }
    await new Promise<void>((resolve) => this.scene.tweens.add({ targets: side, scaleX: 1, alpha: 1, duration: 260, onComplete: () => resolve() }));
  }

  private async leave(slot: number): Promise<void> {
    const car = this.slots[slot];
    if (this.destroyed || car === null || car === 'reserved') return;
    await this.useAisle();
    if (this.destroyed) return;
    const attendant = this.valet ? this.attendant : null;
    if (attendant?.active) {
      await attendant.walkTo({ x: LOT_SLOTS[slot] + 70, y: LOT.slotTop - 20 });
      await attendant.walkTo({ x: LOT_SLOTS[slot] + 70, y: LOT.slot - 16 });
      attendant.setVisible(false);
    }
    await this.turnOut(car);
    this.slots[slot] = null;
    const exitX = this.direction === 1 ? this.exit.from + 20 : this.exit.to - 20;
    if (attendant?.active && (this.dropX - car.vehicle.container.x) * this.direction > 0) {
      // The valet hands the car over at the stand.
      await this.drive(car, { x: this.dropX, y: LOT.aisle }, VALET_SPEED);
      attendant.setPosition(this.dropX - this.direction * 40, LOT.aisle - 24).setVisible(true);
      void attendant.walkTo(this.standSpot).then(() => attendant.active && attendant.face(this.direction === 1 ? 1 : -1));
      await this.delay(600);
    } else if (attendant?.active) {
      attendant.setPosition(this.standSpot.x, this.standSpot.y).setVisible(true);
    }
    await this.drive(car, { x: exitX, y: LOT.aisle }, AISLE_SPEED);
    this.releaseAisle();
    // Out through the driveway, waiting at its mouth for a gap in the traffic.
    const mouth = { x: exitX + this.direction * 90, y: STREET.bottom - 20 };
    await this.drive(car, mouth, 140);
    const joinX = mouth.x + this.direction * 70;
    while (!this.destroyed && !this.streetLife.canMerge(LANE, joinX, car.vehicle.half)) await this.delay(250);
    if (this.destroyed) return;
    await this.drive(car, { x: joinX, y: STREET.lanes[LANE] }, 150);
    car.vehicle.speed = 150;
    this.streetLife.merge(car.vehicle);
  }

  // Moves a car (side view) in a straight line, turning its wheels.
  private drive(car: Car, to: Point, speed: number): Promise<void> {
    const container = car.vehicle.container;
    const distance = Phaser.Math.Distance.Between(container.x, container.y, to.x, to.y);
    if (distance < 1 || this.destroyed) return Promise.resolve();
    let lastX = container.x;
    return new Promise((resolve) =>
      this.scene.tweens.add({
        targets: container,
        x: to.x,
        y: to.y,
        duration: (distance / speed) * 1000,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          const step = container.x - lastX;
          lastX = container.x;
          car.vehicle.wheels.forEach((w) => (w.rotation += step / car.vehicle.art.wheelRadius));
          container.setDepth(container.y);
        },
        onComplete: () => resolve(),
      }),
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => this.scene.time.delayedCall(ms, resolve));
  }

  destroy(): void {
    this.destroyed = true;
    this.slots.forEach((s) => {
      if (s === null || s === 'reserved') return;
      s.front?.destroy();
      s.vehicle?.container?.destroy();
    });
  }
}
