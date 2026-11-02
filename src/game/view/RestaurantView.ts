import Phaser from 'phaser';
import type { SectionId } from '../../core/economy';
import { t, type TranslationKey } from '../../i18n';
import { DISH_COLORS } from '../colors';
import { FONT, PALETTE, toCss } from '../config';
import {
  CASHIER_LINE,
  CASHIER_STAFF,
  CLEAN_STACK,
  DIRTY_STACK,
  DISHPIT,
  DISHWASHER,
  DOOR,
  KITCHEN,
  OUTSIDE,
  PASS_SPOTS,
  QUEUE_SPOTS,
  SEAT_OFFSET_X,
  SECTION_ANCHORS,
  STOVES,
  TABLES,
  VIP_SPOT,
  WAITER_HOME,
  type Point,
} from './layout';
import { Person, createPlate } from './Person';
import { drawRoom } from './room';
import type { CityTheme } from './themes';

// The scene shows at most this many customers per second; above it, each visible customer
// stands for several real ones (their payment popup shows the combined amount).
const MAX_VISUAL_RATE = 1.2;
// Customers arrive a bit faster than the restaurant can serve them, so work visibly piles up
// in front of the bottleneck instead of every section running in lockstep.
const ARRIVAL_SURPLUS = 1.3;
const EAT_MS = 2400;
// After this long without food, the order bubble turns red and shakes.
const ORDER_PATIENCE_MS = 5000;
const PLATE_POOL = 14;
const MAX_WAITERS = 4;
const MAX_CHEFS = 3;
// One extra chef / waiter every this many section levels.
const LEVELS_PER_STAFF = 25;
// Rough distance a waiter walks per order; turns the waiters' rate into a walking speed.
const WAITER_TRIP_PX = 650;
const PASS_TO_TABLE_PX = 350;
const MAX_WAITER_SPEED = 600;
// A seat is claimed at the door, so the walk there counts toward the stay.
const DOOR_TO_SEAT_SECONDS = 1.6;
const STACK_VISIBLE = 10;
// Staff idle this long get a sleepy "zzz" bubble.
const IDLE_BUBBLE_SECONDS = 4;

// Small icons over people that explain why they are not working.
type Status = 'sleep' | 'noPlates' | 'passFull' | 'bill';

export interface ViewState {
  rates: Record<SectionId, number>;
  levels: Record<SectionId, number>;
  customersPerSecond: number;
  incomePerSecond: number;
  bottleneck: SectionId;
  // Indices of dishes on the menu.
  menu: number[];
}

// How fast each section works on screen. Every section's real rate is scaled by the same
// factor, so only the real bottleneck runs at the visible customer rate and the others have
// slack, exactly like in the economy.
interface Flow {
  visualRate: number;
  arrivalRate: number;
  seatsOpen: number;
  cookSeconds: number;
  waiterSpeed: number;
  cashierSeconds: number;
  washSeconds: number;
  chefs: number;
  waiters: number;
}

interface Seat {
  table: Point;
  side: -1 | 1;
  chair: Phaser.GameObjects.Graphics;
  open: boolean;
  occupant: Person | null;
}

interface Order {
  seat: Seat;
  color: number;
  served: (plate: Phaser.GameObjects.Container) => void;
}

interface ReadyPlate {
  order: Order;
  plate: Phaser.GameObjects.Container;
  spot: number;
}

interface Chef {
  person: Person;
  stove: number;
  cooking: boolean;
}

interface Waiter {
  person: Person;
  home: Point;
  busy: boolean;
}

interface Checkout {
  person: Person;
  leaveSeat: () => void;
  paid: () => void;
}

interface Bubble {
  container: Phaser.GameObjects.Container;
  close: () => void;
}

interface StatusBubble {
  status: Status;
  bubble: Bubble;
  // Height above the feet; chefs wear tall hats.
  lift: number;
}

function staffCount(level: number, max: number): number {
  return Phaser.Math.Clamp(1 + Math.floor(level / LEVELS_PER_STAFF), 1, max);
}

function computeFlow(state: ViewState): Flow {
  const visualRate = Math.min(state.customersPerSecond, MAX_VISUAL_RATE);
  const scale = state.customersPerSecond > 0 ? visualRate / state.customersPerSecond : 0;
  const rate = (id: SectionId) => Math.max(state.rates[id] * scale, 1e-6);

  const chefs = staffCount(state.levels.kitchen, MAX_CHEFS);
  // Waiters can only walk so fast; past that, more of them show up instead.
  const waiters = Phaser.Math.Clamp(
    Math.max(staffCount(state.levels.waiters, MAX_WAITERS), Math.ceil((WAITER_TRIP_PX * rate('waiters')) / MAX_WAITER_SPEED)),
    1,
    MAX_WAITERS,
  );
  const cookSeconds = Phaser.Math.Clamp(chefs / rate('kitchen'), 0.4, 20);
  const waiterSpeed = Phaser.Math.Clamp((WAITER_TRIP_PX * rate('waiters')) / waiters, 160, MAX_WAITER_SPEED);

  // A seat serves one customer per stay, so the dining room's rate is seats / stay length.
  const stay = DOOR_TO_SEAT_SECONDS + cookSeconds + PASS_TO_TABLE_PX / waiterSpeed + EAT_MS / 1000;
  const seats = rate('seating') * stay;
  // Other sections get a spare seat so the dining room never looks like the bottleneck by accident.
  const seatsOpen = Phaser.Math.Clamp(
    state.bottleneck === 'seating' ? Math.round(seats) : Math.ceil(seats) + 1,
    1,
    TABLES.length * 2,
  );

  return {
    visualRate,
    arrivalRate: state.bottleneck === 'entrance' ? visualRate : Math.min(rate('entrance'), visualRate * ARRIVAL_SURPLUS),
    seatsOpen,
    cookSeconds,
    waiterSpeed,
    cashierSeconds: Phaser.Math.Clamp(1 / rate('cashier'), 0.25, 10),
    washSeconds: Phaser.Math.Clamp(1 / rate('dishwashing'), 0.2, 10),
    chefs,
    waiters,
  };
}

export class RestaurantView {
  private readonly seats: Seat[];
  private readonly tables: Phaser.GameObjects.Graphics[];
  private readonly doorQueue: { person: Person; admit: (seat: Seat) => void }[] = [];
  private readonly orders: Order[] = [];
  private readonly readyPlates: ReadyPlate[] = [];
  private readonly passTaken: boolean[] = PASS_SPOTS.map(() => false);
  private readonly cashierLine: Checkout[] = [];
  // Customers who finished eating but wait in their seat because the cashier line is full.
  private readonly checkoutWaiting: Checkout[] = [];
  private readonly waiters: Waiter[] = [];
  private readonly chefs: Chef[] = [];
  private readonly people = new Set<Person>();
  private readonly statuses = new Map<Person, StatusBubble>();
  private readonly idleSeconds = new Map<Person, number>();
  private readonly cashier: Person;
  private readonly dishwasher: Person;
  private readonly stacks: Phaser.GameObjects.Graphics;
  private readonly steam: Phaser.GameObjects.Ellipse[] = [];
  private readonly marker: Phaser.GameObjects.Container;
  private readonly markerLabel: Phaser.GameObjects.Text;
  private markerSection: SectionId | null = null;
  private cleanPlates = PLATE_POOL;
  private dirtyPlates = 0;
  private cashierBusy = false;
  private washing = false;
  private turnedAway = 0;
  private spawnTimer = 0;
  private vip: { person: Person; bubble: Bubble | null; leave: Phaser.Time.TimerEvent | null } | null = null;
  private state: ViewState | null = null;
  private flow: Flow | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    theme: CityTheme,
  ) {
    const art = drawRoom(scene, theme);
    this.tables = art.tables;
    this.seats = TABLES.flatMap((table, i) =>
      ([-1, 1] as const).map((side, s) => ({ table, side, chair: art.chairs[i * 2 + s], open: true, occupant: null })),
    );
    STOVES.forEach((stove) => {
      for (let i = 0; i < 3; i++) this.steam.push(scene.add.ellipse(stove.x, stove.y, 40, 30, 0xffffff, 0).setDepth(KITCHEN.counterY + 1));
    });
    this.cashier = this.addPerson(new Person(scene, CASHIER_STAFF.x, CASHIER_STAFF.y, 'cashier'));
    this.dishwasher = this.addPerson(new Person(scene, DISHWASHER.x, DISHWASHER.y, 'dishwasher'));
    this.stacks = scene.add.graphics().setDepth(DISHPIT.counterY + 1);
    this.drawStacks();
    this.marker = this.createMarker();
    this.markerLabel = this.marker.getAt(2) as Phaser.GameObjects.Text;
  }

  // Called when the player taps the bottleneck marker.
  onMarkerTap: (section: SectionId) => void = () => {};

  // Where the bottleneck marker currently points, or null before the first frame.
  get markerAnchor(): Point | null {
    return this.markerSection === null ? null : SECTION_ANCHORS[this.markerSection];
  }

  update(state: ViewState, time: number, delta: number): void {
    this.state = state;
    this.flow = computeFlow(state);
    this.syncStaff(this.flow);
    this.syncSeats(this.flow.seatsOpen);
    this.updateMarker(state.bottleneck);

    this.spawnCustomers(this.flow, delta);
    this.admitFromDoor();
    this.startCooking();
    this.dispatchWaiters();
    this.serveAtCashier();
    this.washDishes();
    this.updateStatuses(delta / 1000);

    this.animateSteam(time);
    this.people.forEach((p) => p.animate(time));
  }

  // Called when the player taps a waiting VIP guest.
  onVipTap: (at: Point) => void = () => {};

  get hasVip(): boolean {
    return this.vip !== null;
  }

  // A VIP guest walks in and waits by the door with a star bubble, then leaves on their own
  // after staySeconds unless the player taps them first.
  async spawnVip(staySeconds: number): Promise<void> {
    if (this.vip) return;
    const person = this.addPerson(new Person(this.scene, OUTSIDE.x, OUTSIDE.y, 'vip'));
    const vip: NonNullable<RestaurantView['vip']> = { person, bubble: null, leave: null };
    this.vip = vip;
    await person.walkTo(DOOR);
    await person.walkTo(VIP_SPOT);
    if (this.vip !== vip) return;
    person.face(1);
    vip.bubble = this.showBubble(person, (g) => drawStar(g, 0, -4, 20, PALETTE.saffron), 1.1);
    this.scene.tweens.add({ targets: vip.bubble.container, y: '-=12', duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // A tall hit area over the guest and the bubble, generous for fingers.
    const hit = this.scene.add.zone(0, -125, 130, 260).setInteractive({ useHandCursor: true });
    person.add(hit);
    hit.on('pointerdown', (_: Phaser.Input.Pointer, __: number, ___: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (this.vip !== vip || !vip.leave) return;
      // Stay while the player decides.
      vip.leave.remove();
      vip.leave = null;
      this.onVipTap({ x: person.x, y: person.y - 120 });
    });
    vip.leave = this.scene.time.delayedCall(staySeconds * 1000, () => void this.dismissVip(false));
  }

  // Sends the VIP guest away, smiling if they were served.
  async dismissVip(happy: boolean): Promise<void> {
    const vip = this.vip;
    if (!vip) return;
    this.vip = null;
    vip.leave?.remove();
    vip.bubble?.close();
    const person = vip.person;
    if (!person.active) return;
    if (!happy) {
      await person.walkTo(OUTSIDE);
      this.removePerson(person);
      return;
    }
    const bubble = this.showBubble(person, (g) => {
      g.fillStyle(PALETTE.success, 1).fillCircle(0, -4, 18);
      g.fillStyle(0xffffff, 1).fillCircle(-6, -8, 3).fillCircle(6, -8, 3);
      g.lineStyle(3, 0xffffff, 1).beginPath().arc(0, -2, 8, 0.4, Math.PI - 0.4).strokePath();
    });
    await this.delay(900);
    bubble.close();
    await person.walkTo(DOOR);
    await person.walkTo(OUTSIDE);
    this.removePerson(person);
  }

  // Called when a customer pays; the scene shows the popup.
  onPayment: (amount: number, at: Point) => void = () => {};

  // Snapshot of the pipeline, for debugging in the browser console.
  debugState() {
    return {
      flow: this.flow,
      doorQueue: this.doorQueue.length,
      turnedAway: this.turnedAway,
      seated: this.seats.filter((s) => s.occupant).length,
      orders: this.orders.length,
      cooking: this.chefs.filter((c) => c.cooking).length,
      onPass: this.readyPlates.length,
      cashierLine: this.cashierLine.length,
      checkoutWaiting: this.checkoutWaiting.length,
      cleanPlates: this.cleanPlates,
      dirtyPlates: this.dirtyPlates,
    };
  }

  private paymentPerCustomer(): number {
    if (!this.state || !this.flow || this.flow.visualRate <= 0) return 0;
    return this.state.incomePerSecond / this.flow.visualRate;
  }

  // --- Entrance --------------------------------------------------------------------------

  private spawnCustomers(flow: Flow, delta: number): void {
    if (flow.arrivalRate <= 0) return;
    const interval = 1 / flow.arrivalRate;
    this.spawnTimer += delta / 1000;
    if (this.spawnTimer < interval) return;
    // Never bank more than one extra arrival (e.g. after the tab was hidden).
    this.spawnTimer = Math.min(this.spawnTimer - interval, interval);
    void this.runCustomer();
  }

  private async runCustomer(): Promise<void> {
    const person = this.addPerson(new Person(this.scene, OUTSIDE.x, OUTSIDE.y, 'customer'));
    await person.walkTo(DOOR);

    let seat: Seat;
    const free = this.doorQueue.length === 0 ? this.freeSeat() : null;
    if (free) {
      seat = this.claimSeat(free, person);
    } else if (this.doorQueue.length < QUEUE_SPOTS.length) {
      seat = await this.waitForSeat(person);
    } else {
      await this.turnAway(person);
      return;
    }

    await person.walkTo({ x: seat.table.x + seat.side * SEAT_OFFSET_X, y: seat.table.y - 6 });
    person.face(seat.side === 1 ? -1 : 1);
    person.sit();

    // Order, wait for the kitchen and the waiters, then eat.
    const menu = this.state?.menu ?? [0];
    const color = DISH_COLORS[Phaser.Utils.Array.GetRandom(menu)];
    const bubble = this.showOrderBubble(person, color);
    const plate = await new Promise<Phaser.GameObjects.Container>((served) => this.orders.push({ seat, color, served }));
    bubble.close();
    await this.delay(EAT_MS);
    this.clearPlate(plate);

    await new Promise<void>((paid) => {
      const checkout: Checkout = { person, paid, leaveSeat: () => (seat.occupant = null) };
      if (this.cashierLine.length < CASHIER_LINE.length) this.enterCashierLine(checkout);
      else this.checkoutWaiting.push(checkout);
    });
    await person.walkTo(OUTSIDE);
    this.removePerson(person);
  }

  private async turnAway(person: Person): Promise<void> {
    this.turnedAway++;
    const bubble = this.showBubble(person, (g) => {
      g.fillStyle(PALETTE.pomegranate, 1).fillCircle(0, -4, 18);
      g.fillStyle(0xffffff, 1).fillCircle(-6, -8, 3).fillCircle(6, -8, 3);
      g.lineStyle(3, 0xffffff, 1).beginPath().arc(0, 6, 8, Math.PI + 0.4, -0.4).strokePath();
    });
    await this.delay(800);
    bubble.close();
    await person.walkTo(OUTSIDE);
    this.removePerson(person);
  }

  // --- Dining room -----------------------------------------------------------------------

  private syncSeats(open: number): void {
    this.seats.forEach((seat, i) => {
      const isOpen = i < open;
      if (seat.open === isOpen) return;
      seat.open = isOpen;
      seat.chair.setAlpha(isOpen ? 1 : 0.3);
    });
    this.tables.forEach((table, i) => table.setAlpha(this.seats[i * 2].open ? 1 : 0.3));
  }

  private freeSeat(): Seat | null {
    const free = this.seats.filter((s) => s.open && !s.occupant);
    return free.length > 0 ? Phaser.Utils.Array.GetRandom(free) : null;
  }

  private claimSeat(seat: Seat, person: Person): Seat {
    seat.occupant = person;
    return seat;
  }

  private waitForSeat(person: Person): Promise<Seat> {
    return new Promise((admit) => {
      this.doorQueue.push({ person, admit });
      void person.walkTo(QUEUE_SPOTS[this.doorQueue.length - 1]);
    });
  }

  private admitFromDoor(): void {
    let moved = false;
    while (this.doorQueue.length > 0) {
      const seat = this.freeSeat();
      if (!seat) break;
      const next = this.doorQueue.shift()!;
      next.admit(this.claimSeat(seat, next.person));
      moved = true;
    }
    if (moved) this.doorQueue.forEach((q, i) => void q.person.walkTo(QUEUE_SPOTS[i]));
  }

  // --- Kitchen ---------------------------------------------------------------------------

  // A chef needs an order, a clean plate and a free spot on the pass to start cooking.
  private startCooking(): void {
    if (!this.flow) return;
    for (const chef of this.chefs) {
      if (chef.cooking) continue;
      const spot = this.passTaken.indexOf(false);
      if (this.orders.length === 0 || this.cleanPlates === 0 || spot < 0) return;
      const order = this.orders.shift()!;
      this.passTaken[spot] = true;
      this.cleanPlates--;
      this.drawStacks();
      chef.cooking = true;
      chef.person.busy = true;
      this.scene.time.delayedCall(this.flow.cookSeconds * 1000, () => {
        chef.cooking = false;
        chef.person.busy = false;
        const pass = PASS_SPOTS[spot];
        const plate = createPlate(this.scene, order.color);
        plate.setPosition(pass.x, pass.y - 12).setDepth(KITCHEN.counterY + 2).setScale(0);
        this.scene.tweens.add({ targets: plate, scale: 1, duration: 200, ease: 'Back.easeOut' });
        this.readyPlates.push({ order, plate, spot });
      });
    }
  }

  // --- Waiters ---------------------------------------------------------------------------

  private dispatchWaiters(): void {
    for (const waiter of this.waiters) {
      if (waiter.busy) continue;
      const ready = this.readyPlates.shift();
      if (!ready) return;
      waiter.busy = true;
      void this.deliver(waiter, ready);
    }
  }

  private async deliver(waiter: Waiter, ready: ReadyPlate): Promise<void> {
    const { person } = waiter;
    const pass = PASS_SPOTS[ready.spot];
    await person.walkTo({ x: pass.x, y: pass.y + 70 }, this.waiterSpeed());
    // Pick the plate up.
    this.passTaken[ready.spot] = false;
    person.hands.add(ready.plate);
    ready.plate.setPosition(0, 0);

    const { seat } = ready.order;
    await person.walkTo({ x: seat.table.x + seat.side * 20, y: seat.table.y + 60 }, this.waiterSpeed());
    person.hands.remove(ready.plate);
    this.scene.add.existing(ready.plate);
    ready.plate.setPosition(seat.table.x + seat.side * 38, seat.table.y - 14).setDepth(seat.table.y + 2);
    ready.order.served(ready.plate);

    waiter.busy = false;
    // Head back unless another plate is already waiting (dispatch then redirects the walk).
    if (this.readyPlates.length === 0) void person.walkTo(waiter.home, this.waiterSpeed());
  }

  private waiterSpeed(): number {
    return this.flow?.waiterSpeed ?? 260;
  }

  // --- Cashier ---------------------------------------------------------------------------

  private enterCashierLine(checkout: Checkout): void {
    this.setStatus(checkout.person, null);
    checkout.leaveSeat();
    this.cashierLine.push(checkout);
    void checkout.person.walkTo(CASHIER_LINE[this.cashierLine.length - 1]);
  }

  private serveAtCashier(): void {
    if (this.cashierBusy || !this.flow) return;
    const head = this.cashierLine[0];
    if (!head || head.person.isWalking) return;
    if (Phaser.Math.Distance.BetweenPoints(head.person, CASHIER_LINE[0]) > 4) return;
    this.cashierBusy = true;
    this.cashier.busy = true;
    head.person.face(-1);
    this.scene.time.delayedCall(this.flow.cashierSeconds * 1000, () => {
      this.cashierBusy = false;
      this.cashier.busy = false;
      this.cashierLine.shift();
      this.onPayment(this.paymentPerCustomer(), { x: head.person.x, y: head.person.y - 170 });
      head.paid();
      this.cashierLine.forEach((c, i) => void c.person.walkTo(CASHIER_LINE[i]));
      const next = this.checkoutWaiting.shift();
      if (next) this.enterCashierLine(next);
    });
  }

  // --- Dishwashing -----------------------------------------------------------------------

  private clearPlate(plate: Phaser.GameObjects.Container): void {
    plate.setDepth(5000);
    this.scene.tweens.add({
      targets: plate,
      x: DIRTY_STACK.x,
      y: DIRTY_STACK.y,
      scale: 0.8,
      duration: 600,
      ease: 'Quad.easeIn',
      onComplete: () => {
        plate.destroy();
        this.dirtyPlates++;
        this.drawStacks();
      },
    });
  }

  private washDishes(): void {
    if (this.washing || this.dirtyPlates === 0 || !this.flow) return;
    this.washing = true;
    this.dishwasher.busy = true;
    this.scene.time.delayedCall(this.flow.washSeconds * 1000, () => {
      this.washing = false;
      this.dishwasher.busy = false;
      this.dirtyPlates--;
      this.cleanPlates++;
      this.drawStacks();
      this.splash();
    });
  }

  private drawStacks(): void {
    const g = this.stacks.clear();
    for (let i = 0; i < Math.min(this.dirtyPlates, STACK_VISIBLE); i++) {
      // Dirty plates pile up crooked.
      const x = DIRTY_STACK.x + ((i * 37) % 11) - 5;
      const y = DIRTY_STACK.y - i * 8;
      g.fillStyle(0xe6dfcf, 1).fillEllipse(x, y, 56, 14);
      g.lineStyle(2, 0xb3a68e, 1).strokeEllipse(x, y, 56, 14);
      g.fillStyle(0x8c6a3e, 0.8).fillEllipse(x + ((i * 13) % 9) - 4, y - 1, 18, 5);
    }
    for (let i = 0; i < Math.min(this.cleanPlates, STACK_VISIBLE); i++) {
      const y = CLEAN_STACK.y - i * 7;
      g.fillStyle(0xffffff, 1).fillEllipse(CLEAN_STACK.x, y, 56, 14);
      g.lineStyle(2, 0xc9c1b4, 1).strokeEllipse(CLEAN_STACK.x, y, 56, 14);
    }
  }

  private splash(): void {
    for (let i = 0; i < 4; i++) {
      const drop = this.scene.add
        .circle(DISHWASHER.x + Phaser.Math.Between(-30, 30), DISHPIT.counterY - 70, Phaser.Math.Between(5, 9), 0xbfe6f5, 0.9)
        .setDepth(DISHPIT.counterY + 2);
      this.scene.tweens.add({
        targets: drop,
        y: drop.y - Phaser.Math.Between(30, 60),
        alpha: 0,
        duration: 450,
        onComplete: () => drop.destroy(),
      });
    }
  }

  // --- Staff -----------------------------------------------------------------------------

  // Staff counts follow the section levels.
  private syncStaff(flow: Flow): void {
    while (this.waiters.length < flow.waiters) {
      const home = { x: WAITER_HOME.x + this.waiters.length * 40, y: WAITER_HOME.y + (this.waiters.length % 2) * 20 };
      const person = this.addPerson(new Person(this.scene, home.x, home.y, 'waiter'));
      this.waiters.push({ person, home, busy: false });
    }
    while (this.chefs.length < flow.chefs) {
      const stove = this.chefs.length;
      const person = this.addPerson(new Person(this.scene, STOVES[stove].x, KITCHEN.counterY - 20, 'chef'));
      this.chefs.push({ person, stove, cooking: false });
    }
  }

  private animateSteam(time: number): void {
    this.steam.forEach((puff, i) => {
      const stoveIndex = Math.floor(i / 3);
      const stove = STOVES[stoveIndex];
      const active = this.chefs[stoveIndex]?.cooking ?? false;
      const t = (time * 0.0006 + (i % 3) / 3) % 1;
      puff.setPosition(stove.x + Math.sin(time * 0.002 + i) * 10, stove.y - 20 - t * 120);
      puff.setAlpha(active ? 0.55 * (1 - t) : 0).setScale(0.6 + t);
    });
  }

  // --- Status bubbles ---------------------------------------------------------------------

  private updateStatuses(dt: number): void {
    const idle = (person: Person, working: boolean): Status | null => {
      const seconds = working ? 0 : (this.idleSeconds.get(person) ?? 0) + dt;
      this.idleSeconds.set(person, seconds);
      return seconds >= IDLE_BUBBLE_SECONDS ? 'sleep' : null;
    };
    const passFull = !this.passTaken.includes(false);
    for (const chef of this.chefs) {
      let status: Status | null = null;
      if (!chef.cooking && this.orders.length > 0) {
        // Blocked chefs explain why, so the player looks at the right section.
        if (this.cleanPlates === 0) status = 'noPlates';
        else if (passFull) status = 'passFull';
      }
      const sleepy = idle(chef.person, chef.cooking || status !== null);
      this.setStatus(chef.person, status ?? sleepy, 215);
    }
    for (const waiter of this.waiters) this.setStatus(waiter.person, idle(waiter.person, waiter.busy));
    this.setStatus(this.cashier, idle(this.cashier, this.cashierBusy || this.cashierLine.length > 0));
    this.setStatus(this.dishwasher, idle(this.dishwasher, this.washing));
    for (const checkout of this.checkoutWaiting) this.setStatus(checkout.person, 'bill', 175);

    // Bubbles follow walking staff.
    this.statuses.forEach(({ bubble, lift }, person) => bubble.container.setPosition(person.x, person.y - lift));
  }

  private setStatus(person: Person, status: Status | null, lift = 190): void {
    const current = this.statuses.get(person);
    if (current?.status === status) return;
    current?.bubble.close();
    this.statuses.delete(person);
    if (status === null) return;
    const bubble = this.showBubble(person, (g) => this.drawStatusIcon(g, status), 0.75);
    bubble.container.setPosition(person.x, person.y - lift);
    this.statuses.set(person, { status, bubble, lift });
  }

  private drawStatusIcon(g: Phaser.GameObjects.Graphics, status: Status): void {
    switch (status) {
      case 'sleep':
        // "z z Z" drawn as zigzags of growing size.
        [
          [-16, 2, 7],
          [-2, -4, 9],
          [14, -12, 12],
        ].forEach(([x, y, size]) => {
          g.lineStyle(4, 0x5a7fa0, 1).beginPath();
          g.moveTo(x - size / 2, y - size / 2).lineTo(x + size / 2, y - size / 2);
          g.lineTo(x - size / 2, y + size / 2).lineTo(x + size / 2, y + size / 2).strokePath();
        });
        break;
      case 'noPlates':
        g.fillStyle(0xffffff, 1).fillEllipse(0, -2, 44, 16);
        g.lineStyle(2, 0xc9c1b4, 1).strokeEllipse(0, -2, 44, 16);
        g.lineStyle(5, PALETTE.pomegranate, 1).lineBetween(-18, -20, 18, 14);
        break;
      case 'passFull':
        for (let i = 0; i < 3; i++) {
          g.fillStyle(0xffffff, 1).fillEllipse(-4, 10 - i * 9, 38, 12);
          g.lineStyle(2, 0xc9c1b4, 1).strokeEllipse(-4, 10 - i * 9, 38, 12);
        }
        g.fillStyle(PALETTE.pomegranate, 1).fillRoundedRect(17, -20, 7, 20, 3).fillCircle(20.5, 6, 4);
        break;
      case 'bill':
        g.fillStyle(PALETTE.saffron, 1).fillCircle(0, -4, 17);
        g.fillStyle(PALETTE.saffronDark, 1).fillCircle(0, -4, 11);
        g.fillStyle(PALETTE.saffron, 1).fillRect(-3, -12, 6, 16);
        break;
    }
  }

  // --- Bubbles and marker ----------------------------------------------------------------

  private showBubble(person: Person, drawContent: (g: Phaser.GameObjects.Graphics) => void, scale = 1): Bubble {
    const back = this.scene.add.graphics();
    back.fillStyle(0xffffff, 1).fillRoundedRect(-32, -30, 64, 52, 16);
    back.fillTriangle(-8, 20, 8, 20, 0, 34);
    const content = this.scene.add.graphics();
    drawContent(content);
    const container = this.scene.add.container(person.x, person.y - 190, [back, content]).setDepth(5000).setScale(0);
    this.scene.tweens.add({ targets: container, scale, duration: 220, ease: 'Back.easeOut' });
    return {
      container,
      close: () => {
        this.scene.tweens.killTweensOf(container.list);
        this.scene.tweens.killTweensOf(container);
        container.destroy();
      },
    };
  }

  // The order bubble turns red and shakes when the food takes too long.
  private showOrderBubble(person: Person, foodColor: number): Bubble {
    const bubble = this.showBubble(person, (g) => g.fillStyle(foodColor, 1).fillCircle(0, -4, 16));
    const alarm = this.scene.add.graphics().setAlpha(0);
    alarm.fillStyle(0xf6b3ad, 1).fillRoundedRect(-32, -30, 64, 52, 16);
    alarm.fillTriangle(-8, 20, 8, 20, 0, 34);
    alarm.lineStyle(4, PALETTE.pomegranate, 1).strokeRoundedRect(-32, -30, 64, 52, 16);
    bubble.container.addAt(alarm, 1);
    this.scene.time.delayedCall(ORDER_PATIENCE_MS, () => {
      if (!bubble.container.active) return;
      this.scene.tweens.add({ targets: alarm, alpha: 1, duration: 400 });
      this.scene.tweens.add({ targets: bubble.container, angle: { from: -7, to: 7 }, duration: 120, yoyo: true, repeat: -1 });
    });
    return bubble;
  }

  private createMarker(): Phaser.GameObjects.Container {
    const circle = this.scene.add.circle(0, 0, 30, PALETTE.pomegranate).setStrokeStyle(5, 0xffffff);
    const mark = this.scene.add
      .text(0, 0, '!', { fontFamily: FONT, fontSize: '44px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5);
    const label = this.scene.add
      .text(0, 50, '', {
        fontFamily: FONT,
        fontSize: '24px',
        fontStyle: 'bold',
        color: toCss(PALETTE.cream),
        backgroundColor: toCss(PALETTE.pomegranate),
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5);
    const marker = this.scene.add.container(0, 0, [circle, mark, label]).setDepth(6000).setVisible(false);
    // Generous hit area so the marker is easy to tap on a phone.
    marker.setSize(140, 150).setInteractive({ useHandCursor: true });
    marker.on('pointerdown', (_: Phaser.Input.Pointer, __: number, ___: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (this.markerSection) this.onMarkerTap(this.markerSection);
    });
    this.scene.tweens.add({ targets: circle, scale: 1.15, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return marker;
  }

  private updateMarker(section: SectionId): void {
    if (section === this.markerSection) return;
    const anchor = SECTION_ANCHORS[section];
    this.markerLabel.setText(t(`section.${section}` as TranslationKey));
    if (this.markerSection === null) {
      this.marker.setPosition(anchor.x, anchor.y).setVisible(true);
    } else {
      this.scene.tweens.add({ targets: this.marker, x: anchor.x, y: anchor.y, duration: 400, ease: 'Cubic.easeInOut' });
    }
    this.markerSection = section;
  }

  private addPerson(person: Person): Person {
    this.people.add(person);
    return person;
  }

  private removePerson(person: Person): void {
    this.setStatus(person, null);
    this.idleSeconds.delete(person);
    this.people.delete(person);
    person.destroy();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => this.scene.time.delayedCall(ms, resolve));
  }
}

// A five-pointed star centered on (x, y).
function drawStar(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, color: number): void {
  const points: Phaser.Types.Math.Vector2Like[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push({ x: x + Math.cos(angle) * r, y: y + Math.sin(angle) * r });
  }
  g.fillStyle(color, 1).fillPoints(points, true);
}
