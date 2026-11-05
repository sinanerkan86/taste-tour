import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { ROOM, type Point } from './layout';

const ROOM_HEIGHT = ROOM.bottom - ROOM.top;
const ROOM_CENTER_Y = ROOM.top + ROOM_HEIGHT / 2;
// Wall and floor art reach this far above and below the room, so zooming out shows more of
// the restaurant instead of empty bands.
export const ROOM_MARGIN = 400;
// Screen pixels a press may move before it counts as a drag instead of a tap.
const DRAG_THRESHOLD = 14;
// Fling speed decays by this factor per millisecond after the finger lifts.
const FRICTION = 0.994;
const MIN_FLING_SPEED = 0.02; // world pixels per millisecond
const PAN_MS = 450;
// Zoom limits: all the way out shows the whole room width; all the way in is this much closer
// than the zoom that fits the room's height (and at least MIN_MAX_ZOOM).
const MAX_ZOOM_OVER_FIT = 1.75;
const MIN_MAX_ZOOM = 2;
const WHEEL_ZOOM_STEP = 0.999; // zoom factor per wheel delta unit

// The restaurant is drawn in fixed world coordinates. This camera shows it in the band between
// the HUD and the panel: one finger drags it around, two fingers pinch to zoom (mouse wheel on
// desktop), and a press that does not move is a tap. It starts zoomed so the room's height fills
// the band, which on tall phones makes the room wider than the screen.
export class RoomCamera {
  private readonly touches = new Map<number, Point>();
  // Where the current gesture started, and whether it has moved enough to stop being a tap.
  private gesture: { start: Point; moved: boolean } | null = null;
  private velocity = { x: 0, y: 0 };
  private lastMoveTime = 0;
  private fitZoom = 1;
  private minZoom = 1;
  private maxZoom = MIN_MAX_ZOOM;
  private laidOut = false;

  // A press on the room that ended without dragging, in world coordinates.
  onTap: (at: Point, screen: Point) => void = () => {};

  constructor(
    scene: Phaser.Scene,
    readonly camera: Phaser.Cameras.Scene2D.Camera,
  ) {
    // One extra pointer for the second finger of a pinch.
    if (scene.input.manager.pointersTotal < 3) scene.input.addPointer(1);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => this.move(pointer));
    scene.input.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => this.release(pointer));
    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, (pointer: Phaser.Input.Pointer, _: unknown, __: number, dy: number) => {
      if (this.contains(pointer)) this.zoomAt(pointer, this.zoom * Math.pow(WHEEL_ZOOM_STEP, dy));
    });
  }

  get zoom(): number {
    return this.camera.zoom;
  }

  // Shows the room in the screen band [top, top + height]. The first call fits the room's
  // height; later calls (screen resized) keep the player's zoom relative to that fit.
  layout(top: number, height: number): void {
    const first = !this.laidOut;
    this.laidOut = true;
    const relative = this.zoom / this.fitZoom;
    const center = this.center;
    this.camera.setViewport(0, top, GAME_WIDTH, height);
    this.fitZoom = Math.max(1, height / ROOM_HEIGHT);
    this.minZoom = 1;
    this.maxZoom = Math.max(MIN_MAX_ZOOM, this.fitZoom * MAX_ZOOM_OVER_FIT);
    this.camera.setZoom(Phaser.Math.Clamp(first ? this.fitZoom : this.fitZoom * relative, this.minZoom, this.maxZoom));
    this.centerOn(first ? { x: GAME_WIDTH / 2, y: ROOM_CENTER_Y } : center);
  }

  // Called from the room's tap area on pointer down.
  startPress(pointer: Phaser.Input.Pointer): void {
    // The finger takes over from an automatic pan.
    this.camera.panEffect.reset();
    this.velocity = { x: 0, y: 0 };
    this.touches.set(pointer.id, { x: pointer.x, y: pointer.y });
    if (this.touches.size === 1) this.gesture = { start: { x: pointer.x, y: pointer.y }, moved: false };
    // A second finger turns the gesture into a pinch, never a tap.
    else if (this.gesture) this.gesture.moved = true;
    this.lastMoveTime = pointer.time;
  }

  private move(pointer: Phaser.Input.Pointer): void {
    const previous = this.touches.get(pointer.id);
    if (!previous || !this.gesture) return;
    const current = { x: pointer.x, y: pointer.y };

    if (this.touches.size >= 2) {
      const [a, b] = [...this.touches.entries()].slice(0, 2);
      const other = a[0] === pointer.id ? b[1] : a[1];
      const before = { distance: distance(previous, other), mid: midpoint(previous, other) };
      const after = { distance: distance(current, other), mid: midpoint(current, other) };
      this.touches.set(pointer.id, current);
      if (before.distance > 0) this.zoomAt(after.mid, (this.zoom * after.distance) / before.distance);
      this.scrollBy((before.mid.x - after.mid.x) / this.zoom, (before.mid.y - after.mid.y) / this.zoom);
      return;
    }

    this.touches.set(pointer.id, current);
    if (!this.gesture.moved && distance(current, this.gesture.start) < DRAG_THRESHOLD) return;
    this.gesture.moved = true;
    const dx = (previous.x - current.x) / this.zoom;
    const dy = (previous.y - current.y) / this.zoom;
    this.scrollBy(dx, dy);
    const elapsed = pointer.time - this.lastMoveTime;
    if (elapsed > 0) {
      this.velocity.x = this.velocity.x * 0.5 + (dx / elapsed) * 0.5;
      this.velocity.y = this.velocity.y * 0.5 + (dy / elapsed) * 0.5;
    }
    this.lastMoveTime = pointer.time;
  }

  private release(pointer: Phaser.Input.Pointer): void {
    if (!this.touches.delete(pointer.id) || !this.gesture) return;
    if (this.touches.size > 0) {
      // Lifting one finger of a pinch: the other keeps dragging without a fling.
      this.velocity = { x: 0, y: 0 };
      return;
    }
    const tapped = !this.gesture.moved;
    this.gesture = null;
    // A finger that stopped before lifting should not fling.
    if (pointer.time - this.lastMoveTime > 80) this.velocity = { x: 0, y: 0 };
    if (tapped) this.onTap(this.toWorld(pointer), { x: pointer.x, y: pointer.y });
  }

  // Called every frame for the fling after a drag.
  update(delta: number): void {
    if (this.touches.size > 0) return;
    const speed = Math.hypot(this.velocity.x, this.velocity.y);
    if (speed < MIN_FLING_SPEED) {
      this.velocity = { x: 0, y: 0 };
      return;
    }
    this.scrollBy(this.velocity.x * delta, this.velocity.y * delta);
    const decay = Math.pow(FRICTION, delta);
    this.velocity.x *= decay;
    this.velocity.y *= decay;
  }

  // Smoothly brings a world position to the middle of the view (as far as the limits allow).
  panTo(point: Point): void {
    this.velocity = { x: 0, y: 0 };
    const target = this.clampCenter(point, this.zoom);
    this.camera.pan(target.x, target.y, PAN_MS, 'Sine.easeInOut', true);
  }

  // Whether a world position is inside the view, at least `margin` world pixels from its edges.
  shows(point: Point, margin = 0): boolean {
    const view = this.view;
    return (
      point.x >= view.x + margin &&
      point.x <= view.x + view.width - margin &&
      point.y >= view.y + margin &&
      point.y <= view.y + view.height - margin
    );
  }

  // Screen rectangle of the room band.
  get screenRect(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.camera.x, this.camera.y, this.camera.width, this.camera.height);
  }

  toScreen(point: Point): Point {
    const view = this.view;
    return {
      x: this.camera.x + (point.x - view.x) * this.zoom,
      y: this.camera.y + (point.y - view.y) * this.zoom,
    };
  }

  toWorld(screen: Point): Point {
    const view = this.view;
    return {
      x: view.x + (screen.x - this.camera.x) / this.zoom,
      y: view.y + (screen.y - this.camera.y) / this.zoom,
    };
  }

  // The visible world rectangle, computed from the current scroll and zoom (Phaser's own
  // worldView is only refreshed once per frame).
  private get view(): Phaser.Geom.Rectangle {
    const { x, y } = this.center;
    const width = this.camera.width / this.zoom;
    const height = this.camera.height / this.zoom;
    return new Phaser.Geom.Rectangle(x - width / 2, y - height / 2, width, height);
  }

  private get center(): Point {
    return { x: this.camera.scrollX + this.camera.width / 2, y: this.camera.scrollY + this.camera.height / 2 };
  }

  private contains(screen: Point): boolean {
    return this.screenRect.contains(screen.x, screen.y);
  }

  // Changes the zoom while keeping the world point under `screen` in place.
  private zoomAt(screen: Point, zoom: number): void {
    const anchor = this.toWorld(screen);
    this.camera.setZoom(Phaser.Math.Clamp(zoom, this.minZoom, this.maxZoom));
    const offsetX = (screen.x - this.camera.x - this.camera.width / 2) / this.zoom;
    const offsetY = (screen.y - this.camera.y - this.camera.height / 2) / this.zoom;
    this.centerOn({ x: anchor.x - offsetX, y: anchor.y - offsetY });
  }

  private scrollBy(dx: number, dy: number): void {
    const { x, y } = this.center;
    const before = { x, y };
    this.centerOn({ x: x + dx, y: y + dy });
    // Stop a fling that ran into an edge.
    const after = this.center;
    if (after.x === before.x) this.velocity.x = 0;
    if (after.y === before.y) this.velocity.y = 0;
  }

  private centerOn(point: Point): void {
    const { x, y } = this.clampCenter(point, this.zoom);
    this.camera.centerOn(x, y);
  }

  // Keeps the room filling the view: the view may not leave the room's width, and vertically it
  // stays inside the room, or is centered on it when zoomed out far enough to show more.
  private clampCenter(point: Point, zoom: number): Point {
    const halfWidth = this.camera.width / zoom / 2;
    const halfHeight = this.camera.height / zoom / 2;
    const x = halfWidth * 2 >= GAME_WIDTH ? GAME_WIDTH / 2 : Phaser.Math.Clamp(point.x, halfWidth, GAME_WIDTH - halfWidth);
    const y =
      halfHeight * 2 >= ROOM_HEIGHT ? ROOM_CENTER_Y : Phaser.Math.Clamp(point.y, ROOM.top + halfHeight, ROOM.bottom - halfHeight);
    return { x, y };
  }
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
