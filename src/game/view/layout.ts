import type { SectionId } from '../../core/economy';
import { LAYOUT } from '../config';

export interface Point {
  x: number;
  y: number;
}

// Restaurant scene coordinates (the band between the HUD and the upgrade panel).
export const ROOM = {
  top: LAYOUT.hudHeight + 8,
  wallBottom: 470,
  bottom: LAYOUT.panelTop,
} as const;

export const KITCHEN = { left: 560, right: 1060, counterY: 470 } as const;
export const DISHPIT = { left: 20, right: 250, counterY: 470 } as const;

export const DOOR: Point = { x: 40, y: 830 };
export const OUTSIDE: Point = { x: -80, y: 830 };
export const CASHIER_DESK: Point = { x: 170, y: 640 };
export const CASHIER_SPOT: Point = { x: 170, y: 735 };
export const WAITER_HOME: Point = { x: 470, y: 560 };

// Where finished plates wait for a waiter, along the kitchen counter's front edge.
export const PASS_SPOTS: Point[] = [640, 720, 800, 880, 960].map((x) => ({ x, y: KITCHEN.counterY + 4 }));
export const STOVES: Point[] = [660, 820, 980].map((x) => ({ x, y: KITCHEN.counterY - 70 }));

export const TABLES: Point[] = [440, 660, 880].flatMap((x) => [
  { x, y: 650 },
  { x, y: 870 },
]);
export const SEAT_OFFSET_X = 78;

// Where customers line up when every seat is taken.
export const QUEUE_SPOTS: Point[] = [0, 1, 2, 3, 4, 5].map((i) => ({ x: 110 + (i % 2) * 40, y: 900 + i * 18 }));

// Where the bottleneck marker floats for each section.
export const SECTION_ANCHORS: Record<SectionId, Point> = {
  entrance: { x: DOOR.x + 80, y: DOOR.y - 200 },
  seating: { x: 660, y: 560 },
  kitchen: { x: 820, y: 260 },
  waiters: { x: WAITER_HOME.x, y: WAITER_HOME.y - 150 },
  cashier: { x: CASHIER_DESK.x, y: CASHIER_DESK.y - 150 },
  dishwashing: { x: 135, y: 270 },
};
