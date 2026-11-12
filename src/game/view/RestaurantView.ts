import Phaser from 'phaser';
import { styleTier, type SectionId } from '../../core/economy';
import { SectionLooks } from './sectionLooks';
import { t, type TranslationKey } from '../../i18n';
import { DISH_COLORS } from '../colors';
import { FONT, PALETTE, toCss } from '../config';
import { ROOM_FX_DEPTH, sparkle } from '../fx';
import {
  CASHIER_LINE,
  CASHIER_STAFF,
  CLEAN_STACK,
  COURIER_OUTSIDE,
  COURIER_SPOTS,
  CRITIC_SPOT,
  DELIVERY_SHELF,
  DELIVERY_SIGN,
  DIRTY_STACK,
  DISHPIT,
  DISHWASHER,
  DOOR,
  DOOR_IN,
  DOOR_OUT,
  KITCHEN,
  PASS_SPOTS,
  QUEUE_SPOTS,
  SEAT_OFFSET_X,
  SECTION_ANCHORS,
  STOVES,
  STREET_ENDS,
  TABLES,
  TOURIST_SPOTS,
  VIP_SPOT,
  WAITER_HOME,
  WALK_LANES,
  type Point,
} from './layout';
import { drawStreet } from './street';
import { StreetLife } from './StreetLife';
import { ParkingLot } from './ParkingLot';
import { Person, createPlate } from './Person';
import { drawRoom } from './room';
import { ART_RES, addArt, paintTexture, roundRect, vGradient, type Ctx } from './paint';
import { deliveryIcon, dishIcon } from '../ui/icons';
import type { CityTheme } from './themes';

// The scene shows at most this many customers per second (kept low so it reads as a calm
// restaurant, not a rush); above it, each visible customer
// stands for several real ones (their payment popup shows the combined amount).
const MAX_VISUAL_RATE = 0.45;
// Customers arrive a bit faster than the restaurant can serve them, so work visibly piles up
// in front of the bottleneck instead of every section running in lockstep.
const ARRIVAL_SURPLUS = 1.3;
const EAT_MS = 4500;
// After this long without food, the order bubble turns red and shakes.
const ORDER_PATIENCE_MS = 8000;
const PLATE_POOL = 14;
const MAX_WAITERS = 4;
const MAX_CHEFS = 3;
// One extra chef / waiter every this many section levels.
const LEVELS_PER_STAFF = 25;
// Rough distance a waiter walks per order; turns the waiters' rate into a walking speed.
const WAITER_TRIP_PX = 650;
const PASS_TO_TABLE_PX = 350;
const MAX_WAITER_SPEED = 330;
// A seat is claimed outside the door, so the walk to it counts toward the stay.
const DOOR_TO_SEAT_SECONDS = 3.7;
const STACK_VISIBLE = 10;
// Staff idle this long get a sleepy "zzz" bubble.
const IDLE_BUBBLE_SECONDS = 4;
// Delivery on screen: at most this many orders per second go out, couriers are added like other
// staff, and a ride takes this long at least and at most.
const MAX_VISUAL_DELIVERY_RATE = 0.3;
const MAX_COURIERS = COURIER_SPOTS.length;
const MIN_RIDE_SECONDS = 3;
const MAX_RIDE_SECONDS = 15;

// Small icons over people that explain why they are not working.
type Status = 'sleep' | 'noPlates' | 'passFull' | 'bill' | 'kitchenBusy';

export interface ViewState {
  rates: Record<SectionId, number>;
  levels: Record<SectionId, number>;
  customersPerSecond: number;
  incomePerSecond: number;
  bottleneck: SectionId;
  // Indices of dishes on the menu.
  menu: number[];
  delivery: {
    level: number;
    // What the couriers could take, and what they really take (the kitchen's spare capacity).
    courierRate: number;
    ordersPerSecond: number;
    incomePerSecond: number;
  };
  parking: {
    level: number;
    valet: boolean;
    // Share of customers who come by car.
    carShare: number;
  };
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
  couriers: number;
  // Seconds a courier is away delivering before coming back for the next box.
  rideSeconds: number;
  // Orders per second that really go out on screen (for the payment per box).
  deliveryRate: number;
}

interface Seat {
  table: Point;
  side: -1 | 1;
  chair: Phaser.GameObjects.Image;
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

interface Courier {
  person: Person;
  spot: number;
  // Waiting at the counter for a box.
  waiting: boolean;
}

interface DeliveryOrder {
  courier: Courier;
  ready: (box: Phaser.GameObjects.Image) => void;
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
  const cookSeconds = Phaser.Math.Clamp(chefs / rate('kitchen'), 1.5, 20);
  const waiterSpeed = Phaser.Math.Clamp((WAITER_TRIP_PX * rate('waiters')) / waiters, 140, MAX_WAITER_SPEED);

  // A seat serves one customer per stay, so the dining room's rate is seats / stay length.
  const stay = DOOR_TO_SEAT_SECONDS + cookSeconds + PASS_TO_TABLE_PX / waiterSpeed + EAT_MS / 1000;
  const seats = rate('seating') * stay;
  // Other sections get a spare seat so the dining room never looks like the bottleneck by accident.
  const seatsOpen = Phaser.Math.Clamp(
    state.bottleneck === 'seating' ? Math.round(seats) : Math.ceil(seats) + 1,
    1,
    TABLES.length * 2,
  );

  // Couriers ride at their own (scaled) rate; the kitchen cooks dine-in orders first, so when it
  // has no time to spare they stand waiting at the counter.
  const couriers = state.delivery.level > 0 ? staffCount(state.delivery.level, MAX_COURIERS) : 0;
  const courierRate = Math.min(state.delivery.courierRate * scale, MAX_VISUAL_DELIVERY_RATE * 1.5);
  const rideSeconds = Phaser.Math.Clamp(couriers / Math.max(courierRate, 1e-6), MIN_RIDE_SECONDS, MAX_RIDE_SECONDS);

  return {
    couriers,
    rideSeconds,
    deliveryRate: Math.min(state.delivery.ordersPerSecond * scale, MAX_VISUAL_DELIVERY_RATE),
    visualRate,
    arrivalRate: state.bottleneck === 'entrance' ? visualRate : Math.min(rate('entrance'), visualRate * ARRIVAL_SURPLUS),
    seatsOpen,
    cookSeconds,
    waiterSpeed,
    cashierSeconds: Phaser.Math.Clamp(1 / rate('cashier'), 1, 10),
    washSeconds: Phaser.Math.Clamp(1 / rate('dishwashing'), 0.8, 10),
    chefs,
    waiters,
  };
}

export class RestaurantView {
  private readonly seats: Seat[];
  private readonly tables: Phaser.GameObjects.Image[];
  private readonly doorQueue: { person: Person; admit: (seat: Seat) => void }[] = [];
  private readonly orders: Order[] = [];
  private readonly readyPlates: ReadyPlate[] = [];
  private readonly passTaken: boolean[] = PASS_SPOTS.map(() => false);
  private readonly cashierLine: Checkout[] = [];
  // Customers who finished eating but wait in their seat because the cashier line is full.
  private readonly checkoutWaiting: Checkout[] = [];
  private readonly waiters: Waiter[] = [];
  private readonly chefs: Chef[] = [];
  private readonly couriers: Courier[] = [];
  private readonly deliveryOrders: DeliveryOrder[] = [];
  private deliverySign: Phaser.GameObjects.Image | null = null;
  // Boxes the kitchen may cook for couriers: it fills at the economy's delivery rate, so the scene
  // never sends out more than the kitchen's spare time allows (none while it is the bottleneck).
  private deliveryCredit = 0;
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
  private critic: { person: Person; bubble: Bubble | null } | null = null;
  private tourists: Person[] = [];
  private state: ViewState | null = null;
  private readonly looks: SectionLooks;
  private flow: Flow | null = null;
  private readonly streetLife: StreetLife;
  private readonly lot: ParkingLot;

  constructor(
    private readonly scene: Phaser.Scene,
    theme: CityTheme,
    // Dish ids of the city menu, in DISH_TIERS order (for the order bubbles).
    private readonly dishes: string[],
  ) {
    const art = drawRoom(scene, theme);
    drawStreet(scene, theme.street);
    this.streetLife = new StreetLife(scene, theme.street);
    this.lot = new ParkingLot(scene, theme.street, this.streetLife, {
      addPerson: (person) => this.addPerson(person),
      removePerson: (person) => this.removePerson(person),
      onArrived: (person) => void this.runCustomer(person),
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.lot.destroy());
    this.tables = art.tables;
    this.looks = new SectionLooks(scene, theme, art);
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
    const wasStarted = this.state !== null;
    this.state = state;
    this.flow = computeFlow(state);
    this.syncStaff(this.flow);
    this.syncDelivery(this.flow, wasStarted);
    this.lot.sync(state.parking.level, state.parking.valet, wasStarted);
    this.deliveryCredit = Math.min(this.deliveryCredit + (this.flow.deliveryRate * delta) / 1000, 1.5);
    this.applyLooks(state.levels, wasStarted);
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
    this.streetLife.update(time, delta);
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
    const person = this.addPerson(this.newPasserBy('vip'));
    const vip: NonNullable<RestaurantView['vip']> = { person, bubble: null, leave: null };
    this.vip = vip;
    await this.walkIn(person);
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
      await this.walkOut(person);
      return;
    }
    const bubble = this.showBubble(person, (g) => {
      g.fillStyle(PALETTE.success, 1).fillCircle(0, -4, 18);
      g.fillStyle(0xffffff, 1).fillCircle(-6, -8, 3).fillCircle(6, -8, 3);
      g.lineStyle(3, 0xffffff, 1).beginPath().arc(0, -2, 8, 0.4, Math.PI - 0.4).strokePath();
    });
    await this.delay(900);
    bubble.close();
    await this.walkOut(person);
  }

  // A food critic walks in and stands taking notes until dismissCritic().
  async spawnCritic(): Promise<void> {
    if (this.critic) return;
    const person = this.addPerson(this.newPasserBy('critic'));
    const critic: NonNullable<RestaurantView['critic']> = { person, bubble: null };
    this.critic = critic;
    await this.walkIn(person);
    await person.walkTo(CRITIC_SPOT);
    if (this.critic !== critic) return;
    person.face(1);
    person.busy = true;
    critic.bubble = this.showBubble(person, (g) => {
      g.fillStyle(0xfffdf4, 1).fillRect(-14, -20, 28, 32);
      g.lineStyle(2, 0x5a78b0, 0.7);
      [-12, -5, 2].forEach((y) => g.lineBetween(-9, y, 9, y));
      g.lineStyle(3, 0x2a2a2a, 1).lineBetween(14, -16, 2, 6);
    });
    this.scene.tweens.add({ targets: critic.bubble.container, angle: { from: -6, to: 6 }, duration: 400, yoyo: true, repeat: -1 });
  }

  // The critic leaves: five stars if the visit went well, a shrug if not.
  async dismissCritic(happy: boolean): Promise<void> {
    const critic = this.critic;
    if (!critic) return;
    this.critic = null;
    critic.bubble?.close();
    const person = critic.person;
    if (!person.active) return;
    person.busy = false;
    const bubble = this.showBubble(
      person,
      (g) => {
        if (happy) {
          for (let i = 0; i < 5; i++) drawStar(g, -24 + i * 12, -4, 7, PALETTE.saffron);
        } else {
          g.fillStyle(PALETTE.muted, 1).fillCircle(0, -4, 18);
          g.fillStyle(0xffffff, 1).fillCircle(-6, -8, 3).fillCircle(6, -8, 3);
          g.lineStyle(3, 0xffffff, 1).lineBetween(-7, 4, 7, 4);
        }
      },
      happy ? 1.2 : 1,
    );
    await this.delay(1600);
    bubble.close();
    await this.walkOut(person);
  }

  // A group of tourists from the tour bus walks in and gathers by the door.
  spawnTourists(): void {
    if (this.tourists.length > 0) return;
    TOURIST_SPOTS.forEach((spot, i) => {
      this.scene.time.delayedCall(i * 260, async () => {
        const person = this.addPerson(this.newPasserBy('tourist'));
        this.tourists.push(person);
        await this.walkIn(person, 260);
        if (!this.tourists.includes(person)) return;
        await person.walkTo(spot, 260);
        if (this.tourists.includes(person)) person.face(1);
      });
    });
  }

  // A tap during the tour bus: a tourist takes a photo (a flash) and hops.
  cheerTourist(): void {
    const person = Phaser.Utils.Array.GetRandom(this.tourists.filter((p) => p.active && !p.isWalking));
    if (!person) return;
    const flash = this.scene.add.circle(person.x + 17 * person.scaleX, person.y - 53 * person.scaleY, 10, 0xffffff, 0.95).setDepth(person.depth + 1);
    this.scene.tweens.add({ targets: flash, scale: 3, alpha: 0, duration: 260, onComplete: () => flash.destroy() });
    this.scene.tweens.add({ targets: person, y: person.y - 14, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
  }

  // The tourists head back to their bus.
  dismissTourists(): void {
    const leaving = this.tourists;
    this.tourists = [];
    leaving.forEach((person, i) =>
      this.scene.time.delayedCall(i * 180, async () => {
        if (!person.active) return;
        await this.walkOut(person, 260);
      }),
    );
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
    // Drivers come in groups: a car brings a few customers at once, which counts for the next
    // arrivals too.
    const carShare = this.state?.parking.carShare ?? 0;
    if (carShare > 0 && Math.random() < carShare && this.lot.canTakeCar()) {
      const passengers = Phaser.Math.Between(1, 3);
      this.spawnTimer -= (passengers - 1) * interval;
      void this.lot.bringCar(passengers);
      return;
    }
    void this.runCustomer();
  }

  // Someone walking along the pavement from either end of the street.
  private newPasserBy(kind: 'customer' | 'vip' | 'critic' | 'tourist'): Person {
    const fromLeft = Math.random() < 0.5;
    const lane = Phaser.Utils.Array.GetRandom(WALK_LANES) + Phaser.Math.Between(-6, 6);
    return new Person(this.scene, fromLeft ? STREET_ENDS.left : STREET_ENDS.right, lane, kind);
  }

  // From the pavement through the door onto the floor.
  private async walkIn(person: Person, speed?: number): Promise<void> {
    if (person.y > DOOR_OUT.y + 20) await person.walkTo({ x: DOOR_OUT.x + (person.x < DOOR_OUT.x ? -30 : 30), y: person.y }, speed);
    await person.walkTo(DOOR_OUT, speed);
    await person.walkTo(DOOR, speed);
    await person.walkTo(DOOR_IN, speed);
  }

  // Out through the door and away along the pavement, then gone.
  private async walkOut(person: Person, speed?: number): Promise<void> {
    if (person.y < DOOR_IN.y - 10) await person.walkTo(DOOR_IN, speed);
    await person.walkTo(DOOR, speed);
    await person.walkTo(DOOR_OUT, speed);
    const lane = Phaser.Utils.Array.GetRandom(WALK_LANES) + Phaser.Math.Between(-6, 6);
    const toLeft = Math.random() < 0.5;
    await person.walkTo({ x: DOOR_OUT.x + (toLeft ? -40 : 40), y: lane }, speed);
    await person.walkTo({ x: toLeft ? STREET_ENDS.left : STREET_ENDS.right, y: lane }, speed);
    this.removePerson(person);
  }

  // person: someone already on the pavement (a driver who crossed from the lot).
  private async runCustomer(arrived?: Person): Promise<void> {
    const person = arrived ?? this.addPerson(this.newPasserBy('customer'));
    // Walk along the pavement to where the line ends (or to the door), then decide.
    const tail = this.doorQueue.length === 0 ? DOOR_OUT : QUEUE_SPOTS[Math.min(this.doorQueue.length, QUEUE_SPOTS.length - 1)];
    await person.walkTo({ x: tail.x + (person.x < tail.x ? -20 : 20), y: person.y });

    let seat: Seat;
    const free = this.doorQueue.length === 0 ? this.freeSeat() : null;
    if (free) {
      seat = this.claimSeat(free, person);
      await this.walkIn(person);
    } else if (this.doorQueue.length < QUEUE_SPOTS.length) {
      seat = await this.waitForSeat(person);
      await this.walkIn(person);
    } else {
      await this.turnAway(person);
      return;
    }

    await person.walkTo({ x: seat.table.x + seat.side * SEAT_OFFSET_X, y: seat.table.y - 6 });
    person.face(seat.side === 1 ? -1 : 1);
    person.sit();

    // Order, wait for the kitchen and the waiters, then eat.
    const menu = this.state?.menu ?? [0];
    const dish = Phaser.Utils.Array.GetRandom(menu);
    const color = DISH_COLORS[dish];
    const bubble = this.showOrderBubble(person, dish);
    const plate = await new Promise<Phaser.GameObjects.Container>((served) => this.orders.push({ seat, color, served }));
    bubble.close();
    await this.delay(EAT_MS);
    this.clearPlate(plate);

    await new Promise<void>((paid) => {
      const checkout: Checkout = { person, paid, leaveSeat: () => (seat.occupant = null) };
      if (this.cashierLine.length < CASHIER_LINE.length) this.enterCashierLine(checkout);
      else this.checkoutWaiting.push(checkout);
    });
    await this.walkOut(person);
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
    // Walk on along the pavement, the way they were going.
    const goingRight = person.x >= DOOR_OUT.x;
    await person.walkTo({ x: goingRight ? STREET_ENDS.right : STREET_ENDS.left, y: person.y });
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
      void person.walkTo(QUEUE_SPOTS[this.doorQueue.length - 1]).then(() => {
        // Wait facing the door.
        if (this.doorQueue.some((q) => q.person === person)) person.face(-1);
      });
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
    if (moved) {
      this.doorQueue.forEach((q, i) =>
        void q.person.walkTo(QUEUE_SPOTS[i]).then(() => {
          if (this.doorQueue.some((w) => w.person === q.person)) q.person.face(-1);
        }),
      );
    }
  }

  // --- Kitchen ---------------------------------------------------------------------------

  // A dine-in order needs a clean plate and a free spot on the pass. Dine-in comes first; a chef
  // with nothing to cook for the dining room (or blocked by plates or the pass) cooks for a
  // waiting courier instead, so delivery gets the kitchen's spare time, as in the economy.
  private startCooking(): void {
    if (!this.flow) return;
    for (const chef of this.chefs) {
      if (chef.cooking) continue;
      const spot = this.passTaken.indexOf(false);
      if (this.orders.length > 0 && this.cleanPlates > 0 && spot >= 0) this.cookForTable(chef, spot);
      else if (this.deliveryOrders.length > 0 && this.deliveryCredit >= 1) this.cookForCourier(chef);
      else return;
    }
  }

  private cookForTable(chef: Chef, spot: number): void {
    const order = this.orders.shift()!;
    this.passTaken[spot] = true;
    this.cleanPlates--;
    this.drawStacks();
    this.cook(chef, () => {
      const pass = PASS_SPOTS[spot];
      const plate = createPlate(this.scene, order.color);
      plate.setPosition(pass.x, pass.y - 12).setDepth(KITCHEN.counterY + 2).setScale(0);
      this.scene.tweens.add({ targets: plate, scale: 1, duration: 200, ease: 'Back.easeOut' });
      this.readyPlates.push({ order, plate, spot });
    });
  }

  private cookForCourier(chef: Chef): void {
    const order = this.deliveryOrders.shift()!;
    this.deliveryCredit -= 1;
    this.cook(chef, () => {
      const box = addArt(this.scene, DELIVERY_SHELF.x, DELIVERY_SHELF.y, paintTexture(this.scene, 'takeaway-box', 46, 36, paintBox), 23, 30);
      box.setDepth(KITCHEN.counterY + 2).setScale(0);
      this.scene.tweens.add({ targets: box, scale: 1 / ART_RES, duration: 200, ease: 'Back.easeOut', onComplete: () => order.ready(box) });
    });
  }

  private cook(chef: Chef, done: () => void): void {
    chef.cooking = true;
    chef.person.busy = true;
    this.scene.time.delayedCall((this.flow?.cookSeconds ?? 3) * 1000, () => {
      chef.cooking = false;
      chef.person.busy = false;
      done();
    });
  }

  // --- Delivery --------------------------------------------------------------------------

  // Couriers and the sign over the counter appear once delivery is open; more couriers come
  // with the level, like other staff.
  private syncDelivery(flow: Flow, animate: boolean): void {
    if (flow.couriers > 0 && !this.deliverySign) {
      this.deliverySign = this.scene.add
        .image(DELIVERY_SIGN.x, DELIVERY_SIGN.y, deliveryIcon(this.scene))
        .setScale(0.9 / ART_RES)
        .setDepth(KITCHEN.counterY - 1);
      if (animate) sparkle(this.scene, DELIVERY_SIGN.x, DELIVERY_SIGN.y, 0xfff3c4, ROOM_FX_DEPTH);
    }
    while (this.couriers.length < flow.couriers) {
      const courier: Courier = {
        person: this.addPerson(new Person(this.scene, COURIER_OUTSIDE.x, COURIER_OUTSIDE.y, 'courier')),
        spot: this.couriers.length,
        waiting: false,
      };
      this.couriers.push(courier);
      // New couriers start one after another rather than all at once.
      void this.delay(courier.spot * 1500).then(() => this.runCourier(courier));
    }
  }

  // A courier comes in, asks for a box, waits for the kitchen, takes it out and rides away.
  private async runCourier(courier: Courier): Promise<void> {
    const { person } = courier;
    for (;;) {
      await person.walkTo(COURIER_SPOTS[courier.spot]);
      if (!person.active) return;
      courier.waiting = true;
      const box = await new Promise<Phaser.GameObjects.Image>((ready) => this.deliveryOrders.push({ courier, ready }));
      courier.waiting = false;
      if (!person.active) return;
      // The box flies from the counter into the courier's hands.
      await new Promise<void>((done) =>
        this.scene.tweens.add({
          targets: box,
          x: person.x,
          y: person.y - 62 * person.scale,
          duration: 250,
          ease: 'Quad.easeOut',
          onComplete: () => done(),
        }),
      );
      person.hands.add(box);
      box.setPosition(0, 0).setScale(1 / ART_RES);
      // The amount floats a little to the left so it stays clear of the screen edge.
      this.onPayment(this.paymentPerDelivery(), { x: Math.min(person.x, 950), y: person.y - 170 });
      await person.walkTo(COURIER_OUTSIDE);
      box.destroy();
      if (!person.active) return;
      // Rides vary a little, so couriers do not move in lockstep.
      await this.delay((this.flow?.rideSeconds ?? MIN_RIDE_SECONDS) * Phaser.Math.FloatBetween(0.7, 1.3) * 1000);
    }
  }

  private paymentPerDelivery(): number {
    if (!this.state || !this.flow || this.flow.deliveryRate <= 0) return 0;
    return this.state.delivery.incomePerSecond / this.flow.deliveryRate;
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

  // Staff outfits and room props follow each section's style tier. Changes after the first
  // frame are celebrated with a little sparkle.
  private applyLooks(levels: Record<SectionId, number>, animate: boolean): void {
    this.looks.update(levels, animate);
    const restyle = (person: Person, section: SectionId) => {
      if (person.setStyle(styleTier(levels[section])) && animate) sparkle(this.scene, person.x, person.y - 100, 0xfff3c4, ROOM_FX_DEPTH);
    };
    this.waiters.forEach((w) => restyle(w.person, 'waiters'));
    this.chefs.forEach((c) => restyle(c.person, 'kitchen'));
    restyle(this.cashier, 'cashier');
    restyle(this.dishwasher, 'dishwashing');
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
    // A courier kept waiting shows a busy pot: the kitchen has no time for delivery.
    for (const courier of this.couriers) {
      const waited = idle(courier.person, !courier.waiting);
      this.setStatus(courier.person, waited ? 'kitchenBusy' : null, 200);
    }
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
      case 'kitchenBusy':
        // A steaming pot.
        g.fillStyle(0x6f757b, 1).fillRoundedRect(-18, -8, 36, 22, 6);
        g.fillStyle(0x8d9399, 1).fillRect(-22, -11, 44, 6);
        g.fillStyle(0x3a2618, 1).fillRect(-26, -9, 6, 4).fillRect(20, -9, 6, 4);
        g.lineStyle(3, 0xb8c4cc, 1);
        [-8, 2, 12].forEach((x) => g.beginPath().arc(x, -18, 4, Math.PI * 0.5, Math.PI * 1.5).strokePath());
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
  private showOrderBubble(person: Person, dish: number): Bubble {
    const bubble = this.showBubble(person, () => {});
    const icon = this.scene.add.image(0, -4, dishIcon(this.scene, this.dishes[dish] ?? '', DISH_COLORS[dish])).setScale(0.62 / ART_RES);
    bubble.container.add(icon);
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

// A kraft paper takeaway box with a teal band and a handle.
function paintBox(ctx: Ctx): void {
  ctx.fillStyle = vGradient(ctx, 8, 36, [
    [0, '#d9b07a'],
    [1, '#a77a45'],
  ]);
  roundRect(ctx, 3, 8, 40, 26, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(70,45,20,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#2a9d8f';
  ctx.fillRect(3, 17, 40, 6);
  ctx.strokeStyle = '#7a5530';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(23, 9, 8, Math.PI, 0);
  ctx.stroke();
}
