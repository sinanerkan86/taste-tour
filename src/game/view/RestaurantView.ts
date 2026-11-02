import Phaser from 'phaser';
import type { SectionId } from '../../core/economy';
import { t, type TranslationKey } from '../../i18n';
import { DISH_COLORS } from '../colors';
import { FONT, PALETTE, toCss } from '../config';
import {
  CASHIER_SPOT,
  DOOR,
  KITCHEN,
  OUTSIDE,
  PASS_SPOTS,
  QUEUE_SPOTS,
  SEAT_OFFSET_X,
  SECTION_ANCHORS,
  STOVES,
  TABLES,
  WAITER_HOME,
  type Point,
} from './layout';
import { Person, createPlate } from './Person';
import { drawRoom } from './room';

// The scene shows at most this many customers per second; above it, each visible customer
// stands for several real ones (their payment popup shows the combined amount).
const MAX_VISUAL_RATE = 1.2;
const COOK_MS = 1200;
const EAT_MS = 2600;
const MAX_WAITERS = 4;
const MAX_CHEFS = 3;

export interface ViewState {
  customersPerSecond: number;
  incomePerSecond: number;
  bottleneck: SectionId;
  kitchenLevel: number;
  // Indices of dishes on the menu.
  menu: number[];
}

interface Seat {
  table: Point;
  side: -1 | 1;
  taken: boolean;
}

interface Order {
  plate: Phaser.GameObjects.Container;
  spot: number;
  seat: Seat;
  delivered: () => void;
}

interface Waiter {
  person: Person;
  busy: boolean;
}

export class RestaurantView {
  private readonly seats: Seat[];
  private readonly queue: { person: Person; admit: (seat: Seat) => void }[] = [];
  private readonly orders: Order[] = [];
  private readonly passTaken: boolean[] = PASS_SPOTS.map(() => false);
  private readonly waiters: Waiter[] = [];
  private readonly chefs: Person[] = [];
  private readonly people = new Set<Person>();
  private readonly steam: Phaser.GameObjects.Ellipse[] = [];
  private readonly marker: Phaser.GameObjects.Container;
  private readonly markerLabel: Phaser.GameObjects.Text;
  private markerSection: SectionId | null = null;
  private spawnTimer = 0;
  private state: ViewState | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    drawRoom(scene);
    this.seats = TABLES.flatMap((table) => [-1, 1].map((side) => ({ table, side: side as -1 | 1, taken: false })));
    STOVES.forEach((stove) => {
      for (let i = 0; i < 3; i++) this.steam.push(scene.add.ellipse(stove.x, stove.y, 40, 30, 0xffffff, 0).setDepth(KITCHEN.counterY + 1));
    });
    this.marker = this.createMarker();
    this.markerLabel = this.marker.getAt(2) as Phaser.GameObjects.Text;
  }

  update(state: ViewState, time: number, delta: number): void {
    this.state = state;
    this.syncStaff(state);
    this.updateMarker(state.bottleneck);
    this.dispatchWaiters();
    this.animateSteam(time);
    this.people.forEach((p) => p.animate(time));

    const rate = Math.min(state.customersPerSecond, MAX_VISUAL_RATE);
    this.spawnTimer += delta / 1000;
    if (rate > 0 && this.spawnTimer >= 1 / rate) {
      this.spawnTimer = 0;
      if (this.queue.length < QUEUE_SPOTS.length) void this.runCustomer();
    }
  }

  // Called when a customer pays; the scene shows the popup.
  onPayment: (amount: number, at: Point) => void = () => {};

  private paymentPerCustomer(): number {
    if (!this.state) return 0;
    const rate = Math.min(this.state.customersPerSecond, MAX_VISUAL_RATE);
    return rate > 0 ? this.state.incomePerSecond / rate : 0;
  }

  private async runCustomer(): Promise<void> {
    const person = this.addPerson(new Person(this.scene, OUTSIDE.x, OUTSIDE.y, 'customer'));
    await person.walkTo(DOOR);
    const seat = await this.findSeat(person);
    const seatPoint = { x: seat.table.x + seat.side * SEAT_OFFSET_X, y: seat.table.y - 6 };
    await person.walkTo(seatPoint);
    person.face(seat.side === 1 ? -1 : 1);
    person.sit();

    const menu = this.state?.menu ?? [0];
    const dish = Phaser.Utils.Array.GetRandom(menu);
    const bubble = this.showOrderBubble(person, DISH_COLORS[dish]);
    const plate = await this.cookAndServe(seat, DISH_COLORS[dish]);
    bubble.destroy();

    await this.delay(EAT_MS);
    this.scene.tweens.add({ targets: plate, alpha: 0, duration: 300, onComplete: () => plate.destroy() });
    this.releaseSeat(seat);

    await person.walkTo({ x: CASHIER_SPOT.x + Phaser.Math.Between(-30, 30), y: CASHIER_SPOT.y });
    this.onPayment(this.paymentPerCustomer(), { x: person.x, y: person.y - 170 });
    await this.delay(250);
    await person.walkTo(OUTSIDE);
    this.removePerson(person);
  }

  private findSeat(person: Person): Promise<Seat> {
    const free = this.seats.filter((s) => !s.taken);
    if (free.length > 0) {
      const seat = Phaser.Utils.Array.GetRandom(free);
      seat.taken = true;
      return Promise.resolve(seat);
    }
    // Every seat is taken: wait in line by the door.
    return new Promise((resolve) => {
      this.queue.push({ person, admit: resolve });
      void person.walkTo(QUEUE_SPOTS[this.queue.length - 1]);
    });
  }

  private releaseSeat(seat: Seat): void {
    const next = this.queue.shift();
    if (!next) {
      seat.taken = false;
      return;
    }
    // Hand the seat straight to the first customer in line and move the line up.
    next.admit(seat);
    this.queue.forEach((q, i) => void q.person.walkTo(QUEUE_SPOTS[i]));
  }

  private async cookAndServe(seat: Seat, foodColor: number): Promise<Phaser.GameObjects.Container> {
    await this.delay(COOK_MS);
    let spot = this.passTaken.indexOf(false);
    while (spot < 0) {
      await this.delay(200);
      spot = this.passTaken.indexOf(false);
    }
    this.passTaken[spot] = true;
    const plate = createPlate(this.scene, foodColor);
    plate.setPosition(PASS_SPOTS[spot].x, PASS_SPOTS[spot].y - 12).setDepth(KITCHEN.counterY + 2);
    plate.setScale(0);
    this.scene.tweens.add({ targets: plate, scale: 1, duration: 200, ease: 'Back.easeOut' });
    await new Promise<void>((delivered) => this.orders.push({ plate, spot, seat, delivered }));
    return plate;
  }

  private dispatchWaiters(): void {
    for (const waiter of this.waiters) {
      if (waiter.busy) continue;
      const order = this.orders.shift();
      if (!order) return;
      waiter.busy = true;
      void this.deliver(waiter, order);
    }
  }

  private async deliver(waiter: Waiter, order: Order): Promise<void> {
    const { person } = waiter;
    const pass = PASS_SPOTS[order.spot];
    await person.walkTo({ x: pass.x, y: pass.y + 70 });
    // Pick the plate up.
    this.passTaken[order.spot] = false;
    person.hands.add(order.plate);
    order.plate.setPosition(0, 0);

    const table = order.seat.table;
    await person.walkTo({ x: table.x + order.seat.side * 20, y: table.y + 60 });
    person.hands.remove(order.plate);
    this.scene.add.existing(order.plate);
    order.plate.setPosition(table.x + order.seat.side * 38, table.y - 14).setDepth(table.y + 2);
    order.delivered();

    await person.walkTo(WAITER_HOME);
    waiter.busy = false;
  }

  // Staff counts follow the economy: more customers need more waiters on screen.
  private syncStaff(state: ViewState): void {
    const rate = Math.min(state.customersPerSecond, MAX_VISUAL_RATE);
    const waitersNeeded = Phaser.Math.Clamp(Math.ceil(rate * 3.2), 1, MAX_WAITERS);
    while (this.waiters.length < waitersNeeded) {
      const home = { x: WAITER_HOME.x + this.waiters.length * 30, y: WAITER_HOME.y };
      const person = this.addPerson(new Person(this.scene, home.x, home.y, 'waiter'));
      this.waiters.push({ person, busy: false });
    }
    const chefsNeeded = Phaser.Math.Clamp(1 + Math.floor(state.kitchenLevel / 25), 1, MAX_CHEFS);
    while (this.chefs.length < chefsNeeded) {
      const stove = STOVES[this.chefs.length];
      const chef = this.addPerson(new Person(this.scene, stove.x, KITCHEN.counterY - 20, 'chef'));
      this.chefs.push(chef);
    }
  }

  private animateSteam(time: number): void {
    this.steam.forEach((puff, i) => {
      const stove = STOVES[Math.floor(i / 3)];
      const active = Math.floor(i / 3) < this.chefs.length;
      const t = (time * 0.0006 + (i % 3) / 3) % 1;
      puff.setPosition(stove.x + Math.sin(time * 0.002 + i) * 10, stove.y - 20 - t * 120);
      puff.setAlpha(active ? 0.55 * (1 - t) : 0).setScale(0.6 + t);
    });
  }

  private showOrderBubble(person: Person, foodColor: number): Phaser.GameObjects.Container {
    const g = this.scene.add.graphics();
    g.fillStyle(0xffffff, 1).fillRoundedRect(-32, -30, 64, 52, 16);
    g.fillTriangle(-8, 20, 8, 20, 0, 34);
    g.fillStyle(foodColor, 1).fillCircle(0, -4, 16);
    const bubble = this.scene.add.container(person.x, person.y - 190, [g]).setDepth(5000);
    bubble.setScale(0);
    this.scene.tweens.add({ targets: bubble, scale: 1, duration: 220, ease: 'Back.easeOut' });
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
    this.people.delete(person);
    person.destroy();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => this.scene.time.delayedCall(ms, resolve));
  }
}
