import Phaser from 'phaser';
import { CROSSWALK, STREET, STREET_ENDS, WALK_LANES } from './layout';
import { Person, WALK_SPEED } from './Person';
import type { StreetTheme, VehicleSpec } from './streetThemes';
import { createVehicle, hasFrontView, vehicleArt, type VehicleArt } from './vehicles';

// Background life on the street: traffic in both lanes and people walking by. Cars keep their
// distance from the car ahead and stop at the crosswalk while someone crosses. Cars going to and
// from the parking lot leave and join this traffic (see ParkingLot). None of it touches the
// economy; customers are sent by RestaurantView and walk the same pavement.

// Cruising speed per lane in pixels per second.
const LANE_SPEEDS = [290, 330];
// Seconds between vehicles in one lane, and between passers-by.
const TRAFFIC_GAP = { min: 3, max: 9 };
const WALKER_GAP = { min: 4, max: 10 };
const OFFSCREEN = 260;
// Pixels per second squared: gentle speeding up, firm braking.
const ACCEL = 260;
const BRAKE = 520;
// Space kept to the car ahead, and in front of the zebra while people cross.
const FOLLOW_GAP = 46;
const STOP_GAP = 26;
// Lot cars slow to this speed for the turn into the driveway.
const TURN_SPEED = 120;

export interface Vehicle {
  container: Phaser.GameObjects.Container;
  wheels: Phaser.GameObjects.Image[];
  art: VehicleArt;
  // What it was built from (the lot paints the same car from the front).
  spec: { spec: VehicleSpec; body: number };
  // Half the body length, for keeping distance.
  half: number;
  lane: number;
  // +1 drives right, -1 left.
  direction: 1 | -1;
  speed: number;
  // A car on its way to the parking lot leaves the traffic at this x.
  exit?: { x: number; done: (vehicle: Vehicle) => void };
}

export class StreetLife {
  private readonly vehicles: Vehicle[] = [];
  private readonly walkers = new Set<Person>();
  private readonly laneTimers: number[];
  private walkerTimer: number;
  // People waiting at the curb for the cars to stop, and people on the zebra.
  private readonly waiting: (() => void)[] = [];
  private crossers = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly street: StreetTheme,
  ) {
    // Some traffic is already on the road when the scene opens.
    this.laneTimers = LANE_SPEEDS.map(() => Math.random() * 2);
    this.walkerTimer = 1 + Math.random() * 3;
    LANE_SPEEDS.forEach((_, lane) => this.spawnVehicle(lane, 200 + Math.random() * 600));
  }

  // Traffic in the lane nearer the restaurant drives left with right-hand traffic.
  direction(lane: number): 1 | -1 {
    const nearLaneLeft = !this.street.leftHand;
    return (lane === 0) === nearLaneLeft ? -1 : 1;
  }

  update(time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.1);
    LANE_SPEEDS.forEach((_, lane) => {
      this.laneTimers[lane] -= dt;
      if (this.laneTimers[lane] > 0) return;
      // A blocked lane end waits for the next frame.
      if (!this.spawnVehicle(lane)) return;
      this.laneTimers[lane] = Phaser.Math.FloatBetween(TRAFFIC_GAP.min, TRAFFIC_GAP.max);
    });
    this.drive(dt);
    this.letPeopleCross();
    this.walkerTimer -= dt;
    if (this.walkerTimer <= 0) {
      this.walkerTimer = Phaser.Math.FloatBetween(WALKER_GAP.min, WALKER_GAP.max);
      void this.spawnWalker();
    }
    this.walkers.forEach((p) => p.animate(time));
  }

  private get crossingActive(): boolean {
    return this.crossers > 0 || this.waiting.length > 0;
  }

  // How far a vehicle may still go: to the car ahead, to the zebra while people cross.
  private room(v: Vehicle): number {
    let room = Infinity;
    const front = v.container.x + v.direction * v.half;
    for (const other of this.vehicles) {
      if (other === v || other.lane !== v.lane) continue;
      const gap = (other.container.x - v.container.x) * v.direction;
      if (gap <= 0) continue;
      room = Math.min(room, gap - other.half - v.half - FOLLOW_GAP);
    }
    if (this.crossingActive) {
      const edge = v.direction === 1 ? CROSSWALK.left - STOP_GAP : CROSSWALK.right + STOP_GAP;
      const toEdge = (edge - front) * v.direction;
      // Only cars that can still stop in time stop; the others are already past the line.
      if (toEdge > -4 && toEdge >= (v.speed * v.speed) / (2 * BRAKE) - 30) room = Math.min(room, toEdge);
    }
    return room;
  }

  private drive(dt: number): void {
    for (const v of [...this.vehicles]) {
      const cruise = LANE_SPEEDS[v.lane];
      let target = Math.min(cruise, Math.sqrt(2 * BRAKE * Math.max(0, this.room(v))));
      if (v.exit) {
        const toExit = (v.exit.x - v.container.x) * v.direction;
        target = Math.min(target, Math.max(TURN_SPEED, Math.sqrt(2 * BRAKE * Math.max(0, toExit)) + TURN_SPEED));
      }
      v.speed = target > v.speed ? Math.min(target, v.speed + ACCEL * dt) : Math.max(target, v.speed - BRAKE * 3 * dt);
      const step = v.speed * dt * v.direction;
      v.container.x += step;
      // Wheels turn by the distance over their radius.
      v.wheels.forEach((w) => (w.rotation += step / v.art.wheelRadius));
      if (v.exit && (v.container.x - v.exit.x) * v.direction >= 0) {
        this.vehicles.splice(this.vehicles.indexOf(v), 1);
        v.exit.done(v);
        continue;
      }
      if (v.container.x < -OFFSCREEN * 2 || v.container.x > 1080 + OFFSCREEN * 2) {
        v.container.destroy();
        this.vehicles.splice(this.vehicles.indexOf(v), 1);
      }
    }
  }

  // People at the curb go once no car is on the zebra or about to roll onto it.
  private letPeopleCross(): void {
    if (this.waiting.length === 0) return;
    const blocked = this.vehicles.some((v) => {
      const back = v.container.x - v.direction * v.half;
      const front = v.container.x + v.direction * v.half;
      const left = Math.min(back, front);
      const right = Math.max(back, front);
      if (right > CROSSWALK.left - 10 && left < CROSSWALK.right + 10) return true;
      // Still moving toward the zebra.
      const edge = v.direction === 1 ? CROSSWALK.left : CROSSWALK.right;
      return v.speed > 30 && (edge - front) * v.direction > 0 && (edge - front) * v.direction < 40;
    });
    if (blocked) return;
    const go = this.waiting.splice(0);
    this.crossers += go.length;
    go.forEach((resolve) => resolve());
  }

  // Resolves when the cars have stopped and the person may step onto the zebra. Call
  // endCrossing() once they are across.
  requestCrossing(): Promise<void> {
    return new Promise((resolve) => this.waiting.push(resolve));
  }

  endCrossing(): void {
    this.crossers = Math.max(0, this.crossers - 1);
  }

  // Whether a car of this half length could join the lane at x without cutting anyone off.
  canMerge(lane: number, x: number, half: number): boolean {
    const direction = this.direction(lane);
    return this.vehicles.every((v) => {
      if (v.lane !== lane) return true;
      const ahead = (v.container.x - x) * direction;
      const clear = v.half + half + FOLLOW_GAP;
      // A car behind needs room to brake as well.
      return ahead > clear + 30 || ahead < -(clear + (v.speed * v.speed) / (2 * BRAKE) + 40);
    });
  }

  // Hands a car (leaving the lot) to the traffic of a lane.
  merge(vehicle: Vehicle): void {
    vehicle.exit = undefined;
    vehicle.container.setDepth(STREET.lanes[vehicle.lane]);
    this.vehicles.push(vehicle);
  }

  // A private car the city's drivers would own: a random shape that has a front view.
  privateCar(): { spec: VehicleSpec; body: number } {
    const own = this.street.vehicles.filter((v) => hasFrontView(v.shape) && !v.taxi && v.shape !== 'minibus');
    const spec = own.length > 0 ? Phaser.Utils.Array.GetRandom(own) : ({ shape: 'sedan' } as VehicleSpec);
    return { spec: { shape: spec.shape }, body: spec.body ?? Phaser.Utils.Array.GetRandom(this.street.carColors) };
  }

  // A car that drives in from the end of the lane and leaves the traffic at exitX (the
  // driveway). Resolves with the car, no longer part of the traffic, once it gets there.
  callCar(lane: number, spec: VehicleSpec, body: number, exitX: number): Promise<Vehicle> {
    return new Promise((resolve) => {
      const tryNow = () => {
        if (!this.spawnVehicle(lane, undefined, { spec, body }, { x: exitX, done: resolve })) {
          this.scene.time.delayedCall(400, tryNow);
        }
      };
      tryNow();
    });
  }

  // x: where it appears (default: just off the screen on its side). Returns false when the
  // lane end is still taken by the last car.
  private spawnVehicle(lane: number, x?: number, car?: { spec: VehicleSpec; body: number }, exit?: Vehicle['exit']): boolean {
    const spec = car?.spec ?? Phaser.Utils.Array.GetRandom(this.street.vehicles);
    const body = car?.body ?? spec.body ?? Phaser.Utils.Array.GetRandom(this.street.carColors);
    const direction = this.direction(lane);
    const startX = x ?? (direction === 1 ? -OFFSCREEN : 1080 + OFFSCREEN);
    const art = vehicleArt(this.scene, spec, body, direction === -1);
    const half = art.width / 2 - 26;
    if (!this.canMerge(lane, startX, half)) return false;
    const y = STREET.lanes[lane];
    const { container, wheels } = createVehicle(this.scene, art, startX, y);
    container.setDepth(y);
    this.vehicles.push({ container, wheels, art, spec: { spec, body }, half, lane, direction, speed: LANE_SPEEDS[lane], exit });
    return true;
  }

  // A car that is not in the traffic yet (parked in the lot), facing `direction`.
  parkedVehicle(spec: VehicleSpec, body: number, direction: 1 | -1, x: number, y: number, lane: number): Vehicle {
    const art = vehicleArt(this.scene, spec, body, direction === -1);
    const { container, wheels } = createVehicle(this.scene, art, x, y);
    container.setDepth(y);
    return { container, wheels, art, spec: { spec, body }, half: art.width / 2 - 26, lane, direction, speed: 0 };
  }

  private async spawnWalker(): Promise<void> {
    const fromLeft = Math.random() < 0.5;
    const y = Phaser.Utils.Array.GetRandom(WALK_LANES) + Phaser.Math.Between(-6, 6);
    const person = new Person(this.scene, fromLeft ? STREET_ENDS.left : STREET_ENDS.right, y, 'customer');
    this.walkers.add(person);
    await person.walkTo({ x: fromLeft ? STREET_ENDS.right : STREET_ENDS.left, y }, WALK_SPEED * Phaser.Math.FloatBetween(0.85, 1.2));
    this.walkers.delete(person);
    person.destroy();
  }

  destroy(): void {
    this.vehicles.forEach((v) => v.container.destroy());
    this.walkers.forEach((p) => p.destroy());
  }
}
