import Phaser from 'phaser';
import { BUS_STOP_SPOT } from './layout';
import { addArt } from './paint';
import { Person } from './Person';
import { BOARD, busSignTexture, shelterTexture } from './stopArt';
import type { StreetLife, Vehicle } from './StreetLife';
import type { StreetTheme } from './streetThemes';
import { BUS_DOORS } from './vehicles';

// The bus stop on the restaurant's pavement. The pole with the bus sign is always there; once the
// stop is open a shelter stands beside it with a board counting down to the next bus. The scene
// keeps the timetable (it runs only while the game is open) and calls call(): a city bus drives
// up in the near lane and stops (the traffic behind it waits), its riders step off behind it and
// RestaurantView takes them in as customers, then the bus drives on.

const LANE = 0;
const STEP_OFF_MS = 380;
const WAIT_AFTER_MS = 1400;

export interface StopHooks {
  addPerson: (person: Person) => Person;
  // A rider stepped off and stands on the pavement.
  onRider: (person: Person) => void;
}

export class BusStop {
  private level = -1;
  private shelter: Phaser.GameObjects.Image | null = null;
  private board: Phaser.GameObjects.Text | null = null;
  private shown = '';
  private bus: Vehicle | null = null;
  private readonly direction: 1 | -1;
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly street: StreetTheme,
    private readonly streetLife: StreetLife,
    private readonly hooks: StopHooks,
  ) {
    this.direction = streetLife.direction(LANE);
    const signY = BUS_STOP_SPOT.y + 2;
    addArt(scene, BUS_STOP_SPOT.signX, signY, busSignTexture(scene, street), 40, 300).setDepth(signY);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => (this.destroyed = true));
  }

  get busy(): boolean {
    return this.bus !== null;
  }

  // Shows or removes the shelter. animate: the stop was just opened.
  sync(level: number, animate: boolean): void {
    if ((level > 0) === (this.level > 0) && this.level >= 0) {
      this.level = level;
      return;
    }
    this.level = level;
    if (level <= 0) {
      this.shelter?.destroy();
      this.board?.destroy();
      this.shelter = null;
      this.board = null;
      return;
    }
    const { x, y } = BUS_STOP_SPOT;
    this.shelter = addArt(this.scene, x, y, shelterTexture(this.scene, this.street), 130, 300).setDepth(y);
    this.board = this.scene.add
      .text(x + BOARD.x, y + BOARD.y, '', { fontFamily: 'monospace', fontSize: '26px', fontStyle: 'bold', color: '#ffb627' })
      .setOrigin(0.5)
      .setDepth(y + 1);
    this.shown = '';
    if (animate) {
      [this.shelter, this.board].forEach((o) => {
        o.setScale(0.6).setAlpha(0);
        this.scene.tweens.add({ targets: o, scale: 1, alpha: 1, duration: 500, ease: 'Back.easeOut' });
      });
    }
  }

  // Seconds to the next bus on the board (null: the bus is here).
  setCountdown(seconds: number | null): void {
    if (!this.board) return;
    let text = 'BUS';
    if (seconds !== null) {
      const s = Math.max(0, Math.ceil(seconds));
      text = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }
    if (text === this.shown) return;
    this.shown = text;
    this.board.setText(text);
  }

  // Brings a bus. onStop runs when it stands at the stop and returns how many riders step off.
  async call(onStop: () => number): Promise<void> {
    if (this.bus) return;
    // The door next to the shelter: the front door on buses driving left, the rear one otherwise.
    const door = this.direction === -1 ? -BUS_DOORS.front : BUS_DOORS.rear;
    const bus = await this.streetLife.callBus(LANE, this.street.bus, BUS_STOP_SPOT.x - door);
    if (this.destroyed) return;
    this.bus = bus;
    const riders = onStop();
    for (let i = 0; i < riders; i++) {
      await this.wait(STEP_OFF_MS);
      if (this.destroyed) return;
      const person = this.hooks.addPerson(new Person(this.scene, BUS_STOP_SPOT.x + Phaser.Math.Between(-16, 16), BUS_STOP_SPOT.alightY, 'customer'));
      this.hooks.onRider(person);
    }
    await this.wait(WAIT_AFTER_MS);
    if (this.destroyed) return;
    this.streetLife.releaseBus(bus);
    this.bus = null;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.scene.time.delayedCall(ms, resolve));
  }
}
