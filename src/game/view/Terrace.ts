import Phaser from 'phaser';
import { BARTENDER_SPOT, ROOF, ROOF_BAR_SPOT, STAIR_DOOR, STAIR_HEAD, TERRACE_PLANTERS, TERRACE_TABLES, depthScale } from './layout';
import { ART_RES, addArt } from './paint';
import { Person } from './Person';
import {
  AC,
  BASE_TOP,
  BANNER,
  BAR,
  DECK,
  FENCE,
  HATCH,
  LIGHTS,
  PARASOL,
  RAIL,
  STAIR_DOOR_ART,
  TANK,
  airConditionersTexture,
  barStoolTexture,
  deckTexture,
  glassRailTexture,
  parasolTexture,
  roofBackdropTexture,
  roofBannerTexture,
  roofBarTexture,
  roofBaseTexture,
  roofFenceTexture,
  roofHazeTexture,
  stairDoorTexture,
  stairHeadTexture,
  stringLightsTexture,
  terraceChairTexture,
  terracePlanterTexture,
  terraceTableTexture,
  waterTankTexture,
} from './terraceArt';
import type { CityTheme } from './themes';

// The roof terrace above the dining room. Always there: the sky and the city's skyline behind the
// building, the roof with a water tank and air conditioners, and the stair head. While it is
// closed a banner and a builder's fence stand on the roof; opening it lays a wooden deck, a glass
// railing, string lights and four tables with parasols, and puts a doorway over the city poster
// in the room's back wall. The roof bar adds a counter with a bartender.

// How big the landmark is on the skyline compared with the wall poster.
const LANDMARK_SCALE = 2.5;
const LANDMARK_X = 640;
const FADE_MS = 700;

export interface TerraceHooks {
  addPerson: (person: Person) => Person;
}

export interface TerraceSeats {
  chairs: Phaser.GameObjects.Image[];
  tables: Phaser.GameObjects.Image[];
  parasols: Phaser.GameObjects.Image[];
}

export class Terrace {
  readonly seats: TerraceSeats = { chairs: [], tables: [], parasols: [] };
  private level = -1;
  private bar = false;
  // What shows while the terrace is closed, and what shows once it is open.
  private readonly closed: Phaser.GameObjects.Image[] = [];
  private readonly open: Phaser.GameObjects.Image[] = [];
  private readonly stairDoor: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly theme: CityTheme,
    private readonly hooks: TerraceHooks,
  ) {
    // Sky, far buildings, then the city's landmark standing on the horizon, a veil of haze and
    // the roof with the nearer buildings.
    addArt(scene, 0, ROOF.top, roofBackdropTexture(scene, theme), 0, 0).setDepth(-993);
    const landmark = scene.add.graphics().setDepth(-992);
    landmark.fillStyle(theme.sky, 1);
    theme.landmark(landmark, 0, 0);
    landmark.setScale(LANDMARK_SCALE).setPosition(LANDMARK_X, ROOF.parapetTop + 18 - 45 * LANDMARK_SCALE);
    addArt(scene, 0, ROOF.parapetTop - 150, roofHazeTexture(scene, theme), 0, 0).setDepth(-991);
    addArt(scene, 0, BASE_TOP, roofBaseTexture(scene, theme), 0, 0).setDepth(-990);

    // Roof furniture that is always there.
    addArt(scene, 78, ROOF.deckTop + 6, waterTankTexture(scene), TANK.ox, TANK.oy).setDepth(ROOF.deckTop + 6);
    addArt(scene, 1000, ROOF.deckTop + 6, airConditionersTexture(scene), AC.ox, AC.oy).setDepth(ROOF.deckTop + 6);
    addArt(scene, STAIR_HEAD.x, STAIR_HEAD.base, stairHeadTexture(scene, theme), HATCH.ox, HATCH.oy).setDepth(STAIR_HEAD.base);

    // The doorway in the back wall sits over the poster once the terrace is open.
    this.stairDoor = addArt(scene, STAIR_DOOR.x, STAIR_DOOR_ART.top, stairDoorTexture(scene, theme), STAIR_DOOR_ART.w / 2, 0)
      .setDepth(-950)
      .setVisible(false);

    // Closed: a banner over the middle of the roof and a builder's fence along the edge.
    this.closed.push(
      addArt(scene, 540, 50, roofBannerTexture(scene, theme), BANNER.ox, BANNER.oy).setDepth(50),
      addArt(scene, 0, ROOF.deckBottom - FENCE.h - 4, roofFenceTexture(scene), 0, 0).setDepth(ROOF.deckBottom),
    );

    // Open: deck, railing, lights, planters and the tables with their parasols.
    this.open.push(
      addArt(scene, 0, DECK.top, deckTexture(scene), 0, 0).setDepth(-985),
      addArt(scene, 0, ROOF.deckBottom - RAIL.h, glassRailTexture(scene), 0, 0).setDepth(ROOF.deckBottom),
      addArt(scene, 0, LIGHTS.top, stringLightsTexture(scene, false), 0, 0).setDepth(-100),
    );
    this.glow = addArt(scene, 0, LIGHTS.top, stringLightsTexture(scene, true), 0, 0).setDepth(-99).setVisible(false);
    scene.tweens.add({ targets: this.glow, alpha: { from: 0.7, to: 1 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const planter = terracePlanterTexture(scene, theme);
    TERRACE_PLANTERS.forEach((p) => {
      this.open.push(addArt(scene, p.x, p.y, planter, 60, 100).setDepth(p.y).setScale(depthScale(p.y) / ART_RES));
    });
    const table = terraceTableTexture(scene, theme);
    const chair = terraceChairTexture(scene, theme);
    const parasol = parasolTexture(scene, theme);
    TERRACE_TABLES.forEach((t) => {
      const scale = depthScale(t.y) / ART_RES;
      [-1, 1].forEach((side) => this.seats.chairs.push(addArt(scene, t.x + side * 78, t.y, chair, 32, 80).setDepth(t.y - 30).setScale(scale).setFlipX(side > 0)));
      this.seats.tables.push(addArt(scene, t.x, t.y, table, 80, 46).setDepth(t.y + 1).setScale(scale));
      this.seats.parasols.push(addArt(scene, t.x, t.y, parasol, PARASOL.ox, PARASOL.oy).setDepth(t.y + 2).setScale(scale));
    });
    this.seatObjects.forEach((o) => o.setVisible(false));
    this.open.forEach((o) => o.setVisible(false));
  }

  private get seatObjects(): Phaser.GameObjects.Image[] {
    return [...this.seats.chairs, ...this.seats.tables, ...this.seats.parasols];
  }

  // Shows what the terrace level and the roof bar change. animate: just bought.
  sync(level: number, roofBar: boolean, animate: boolean): void {
    if (level !== this.level) {
      const first = this.level < 0;
      const wasOpen = this.level > 0;
      this.level = level;
      if (level > 0 !== wasOpen || first) this.setOpen(level > 0, animate && !first);
    }
    if (roofBar && !this.bar) {
      this.bar = true;
      this.buildBar(animate);
    }
  }

  private setOpen(open: boolean, animate: boolean): void {
    // Dimmed seats keep their own alpha (the view sets it), so only the other things fade.
    const swap = (images: Phaser.GameObjects.Image[], visible: boolean) =>
      images.forEach((image) => {
        if (!animate) {
          image.setVisible(visible);
        } else if (visible) {
          const keep = image.alpha;
          image.setVisible(true).setAlpha(0);
          this.scene.tweens.add({ targets: image, alpha: keep, duration: FADE_MS });
        } else {
          this.scene.tweens.add({ targets: image, alpha: 0, duration: FADE_MS, onComplete: () => image.setVisible(false).setAlpha(1) });
        }
      });
    swap(this.closed, !open);
    swap(this.open, open);
    this.seatObjects.forEach((o) => o.setVisible(open));
    this.glow.setVisible(open);
    this.stairDoor.setVisible(open);
    if (open && animate) {
      this.stairDoor.setAlpha(0);
      this.scene.tweens.add({ targets: this.stairDoor, alpha: 1, duration: FADE_MS });
    }
  }

  private buildBar(animate: boolean): void {
    const { scene, theme } = this;
    const scale = depthScale(ROOF_BAR_SPOT.y) / ART_RES;
    const parts: Phaser.GameObjects.Image[] = [
      addArt(scene, ROOF_BAR_SPOT.x, ROOF_BAR_SPOT.y, roofBarTexture(scene, theme), BAR.ox, BAR.oy).setDepth(ROOF_BAR_SPOT.y).setScale(scale),
    ];
    [-50, 50].forEach((dx) =>
      parts.push(addArt(scene, ROOF_BAR_SPOT.x + dx, ROOF_BAR_SPOT.y + 40, barStoolTexture(scene, theme), 22, 80).setDepth(ROOF_BAR_SPOT.y + 40).setScale(scale)),
    );
    const bartender = this.hooks.addPerson(new Person(scene, BARTENDER_SPOT.x, BARTENDER_SPOT.y, 'waiter'));
    bartender.setStyle(1);
    bartender.face(-1);
    bartender.busy = true;
    if (animate) {
      [...parts, bartender].forEach((o) => {
        o.setAlpha(0);
        scene.tweens.add({ targets: o, alpha: 1, duration: FADE_MS });
      });
    }
  }
}
