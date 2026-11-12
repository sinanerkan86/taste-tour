import Phaser from 'phaser';
import { STREET, STREET_ENDS, WALK_LANES } from './layout';
import { Person, WALK_SPEED } from './Person';
import type { StreetTheme } from './streetThemes';
import { createVehicle, vehicleArt } from './vehicles';

// Background life on the street: traffic in both lanes and people walking by. None of it touches
// the economy; customers are sent by RestaurantView and walk the same pavement.

// Lane speeds in pixels per second. Every vehicle in a lane drives at the same speed, so they
// never catch up with each other.
const LANE_SPEEDS = [290, 330];
// Seconds between vehicles in one lane, and between passers-by.
const TRAFFIC_GAP = { min: 3, max: 9 };
const WALKER_GAP = { min: 4, max: 10 };
const OFFSCREEN = 260;

interface Vehicle {
  container: Phaser.GameObjects.Container;
  wheels: Phaser.GameObjects.Image[];
  radius: number;
  // +1 drives right, -1 left.
  direction: 1 | -1;
  speed: number;
}

export class StreetLife {
  private readonly vehicles: Vehicle[] = [];
  private readonly walkers = new Set<Person>();
  private readonly laneTimers: number[];
  private walkerTimer: number;

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
  private direction(lane: number): 1 | -1 {
    const nearLaneLeft = !this.street.leftHand;
    return (lane === 0) === nearLaneLeft ? -1 : 1;
  }

  update(time: number, delta: number): void {
    const dt = delta / 1000;
    LANE_SPEEDS.forEach((_, lane) => {
      this.laneTimers[lane] -= dt;
      if (this.laneTimers[lane] > 0) return;
      this.laneTimers[lane] = Phaser.Math.FloatBetween(TRAFFIC_GAP.min, TRAFFIC_GAP.max);
      this.spawnVehicle(lane);
    });
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      const step = v.speed * dt * v.direction;
      v.container.x += step;
      // Wheels turn by the distance over their radius.
      v.wheels.forEach((w) => (w.rotation += step / v.radius));
      if (v.container.x < -OFFSCREEN * 2 || v.container.x > 1080 + OFFSCREEN * 2) {
        v.container.destroy();
        this.vehicles.splice(i, 1);
      }
    }
    this.walkerTimer -= dt;
    if (this.walkerTimer <= 0) {
      this.walkerTimer = Phaser.Math.FloatBetween(WALKER_GAP.min, WALKER_GAP.max);
      void this.spawnWalker();
    }
    this.walkers.forEach((p) => p.animate(time));
  }

  // x: where it appears (default: just off the screen on its side).
  private spawnVehicle(lane: number, x?: number): void {
    const spec = Phaser.Utils.Array.GetRandom(this.street.vehicles);
    const body = spec.body ?? Phaser.Utils.Array.GetRandom(this.street.carColors);
    const direction = this.direction(lane);
    const art = vehicleArt(this.scene, spec, body, direction === -1);
    const startX = x ?? (direction === 1 ? -OFFSCREEN : 1080 + OFFSCREEN);
    const y = STREET.lanes[lane];
    const { container, wheels } = createVehicle(this.scene, art, startX, y);
    container.setDepth(y);
    this.vehicles.push({ container, wheels, radius: art.wheelRadius, direction, speed: LANE_SPEEDS[lane] });
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
