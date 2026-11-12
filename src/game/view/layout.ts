import type { SectionId } from '../../core/economy';
import { LAYOUT } from '../config';

export interface Point {
  x: number;
  y: number;
}

// Restaurant world coordinates. On a 1080x1920 screen the room fills the band between the HUD
// and the upgrade panel 1:1; taller screens zoom it in (see RoomCamera).
export const ROOM = {
  top: LAYOUT.hudHeight + 8,
  wallBottom: 470,
  bottom: 1010,
} as const;

// In front of the room: the front wall (cut low, like a doll's house, so the room stays visible),
// the pavement where customers queue and passers-by walk, and the street with traffic.
export const FRONT = {
  // The floor runs to the inner side of the front wall.
  floorEnd: 1046,
  // Top of the cut wall, then its outer face down to the pavement.
  capTop: 1040,
  faceTop: 1064,
  faceBottom: 1146,
} as const;
export const STREET = {
  pavementTop: FRONT.faceBottom,
  curb: 1336,
  roadTop: 1356,
  roadBottom: 1640,
  // Lanes are the y of the wheels' contact with the road.
  lanes: [1468, 1592],
  // The strip of the far pavement at the bottom edge of the world.
  bottom: 1730,
} as const;
// People cross the road here (traffic stops for them), between the near and the far pavement.
export const CROSSWALK = { left: 700, right: 840 } as const;

// The parking lot across the street, behind the far pavement. Traffic is one-way through it:
// cars turn in from the far lane at one end, drive along the aisle and leave at the other end
// (which end depends on the side of the road the city drives on). Parked cars face the viewer.
export const LOT = {
  top: STREET.bottom,
  // The ground line of cars driving along the aisle, and of parked cars.
  aisle: 1838,
  slot: 1990,
  // Slots are drawn between these lines; the low wall closes the lot at the bottom.
  slotTop: 1880,
  slotBottom: 2010,
  bottom: 2100,
} as const;
// Gaps in the far pavement where cars turn in and out.
export const DRIVEWAYS = { left: { from: 20, to: 200 }, right: { from: 880, to: 1060 } } as const;
export const LOT_SLOTS: number[] = [130, 296, 462, 628, 794, 960];
// Where guests stand while the car is parked for them, and the valet's own spot.
export const VALET_DROP = { left: 330, right: 750 } as const;
export const PARKING_ANCHOR: Point = { x: 540, y: 1880 };
// The bus stop on the restaurant's pavement, left of the door: the shelter, the pole with the sign,
// and where riders step off (the bus stops in the near lane with a door here).
export const BUS_STOP_SPOT = { x: 130, y: STREET.curb - 6, signX: 242, alightY: STREET.curb + 4 } as const;
export const BUS_STOP_ANCHOR: Point = { x: BUS_STOP_SPOT.x - 90, y: BUS_STOP_SPOT.y - 280 };
// Everything the camera may show.
export const WORLD = { top: ROOM.top, bottom: LOT.bottom, left: 0, right: 1080 } as const;
// Passers-by walk along the pavement here, between the queue and the curb.
export const WALK_LANES = [1272, 1300];

// People and furniture farther back (higher on screen) are drawn a little smaller, which gives
// the room depth.
export function depthScale(y: number): number {
  const t = (y - ROOM.wallBottom) / (ROOM.bottom - ROOM.wallBottom);
  return Math.min(1.12, Math.max(0.8, 0.86 + t * 0.22));
}

export const KITCHEN = { left: 560, right: 1060, counterY: 470 } as const;
export const DISHPIT = { left: 20, right: 250, counterY: 470 } as const;
export const DISHWASHER: Point = { x: 130, y: 452 };
// Dirty plates pile up left of the sink, clean ones stack on the right.
export const DIRTY_STACK: Point = { x: DISHPIT.left + 32, y: DISHPIT.counterY - 82 };
export const CLEAN_STACK: Point = { x: DISHPIT.right - 34, y: DISHPIT.counterY - 82 };

// City landmark poster on the wall between the dish pit and the kitchen.
export const POSTER = { x: 405, y: 262, width: 240, height: 110 } as const;

// The entrance is a gap in the front wall. People walk through it from the pavement: outside
// the door, the threshold, and the first step onto the floor.
export const DOOR_X = 300;
export const DOOR_WIDTH = 150;
export const DOOR_OUT: Point = { x: DOOR_X, y: 1182 };
export const DOOR: Point = { x: DOOR_X, y: 1086 };
export const DOOR_IN: Point = { x: DOOR_X, y: 1000 };
// Where people appear and disappear: just past either end of the pavement.
export const STREET_ENDS = { left: -70, right: 1150 } as const;
export const CASHIER_DESK: Point = { x: 170, y: 640 };
export const CASHIER_STAFF: Point = { x: 170, y: 625 };
// Customers line up to pay from the front of the desk toward the tables.
export const CASHIER_LINE: Point[] = [0, 1, 2, 3, 4, 5].map((i) => ({ x: 170 + i * 52, y: 740 + (i % 2) * 14 }));
export const WAITER_HOME: Point = { x: 470, y: 560 };
// Where a VIP guest waits to be noticed, in the open floor inside the door.
export const VIP_SPOT: Point = { x: 190, y: 985 };
// Where a food critic stands taking notes, between the front tables.
export const CRITIC_SPOT: Point = { x: 560, y: 990 };
// Where tour bus tourists gather, in the open floor inside the door.
export const TOURIST_SPOTS: Point[] = [
  { x: 200, y: 1010 },
  { x: 250, y: 950 },
  { x: 390, y: 1010 },
  { x: 410, y: 950 },
  { x: 120, y: 960 },
];

// Delivery: takeaway boxes come out at the right end of the kitchen counter, and couriers walk in
// from the right edge of the room and wait in front of it.
export const DELIVERY_SHELF: Point = { x: 1015, y: KITCHEN.counterY - 8 };
export const DELIVERY_SIGN: Point = { x: 1020, y: KITCHEN.counterY - 175 };
export const COURIER_OUTSIDE: Point = { x: 1180, y: 560 };
export const COURIER_SPOTS: Point[] = [
  { x: 1008, y: KITCHEN.counterY + 70 },
  { x: 1044, y: KITCHEN.counterY + 90 },
  { x: 972, y: KITCHEN.counterY + 96 },
];

// Where finished plates wait for a waiter, along the kitchen counter's front edge.
export const PASS_SPOTS: Point[] = [640, 720, 800, 880, 960].map((x) => ({ x, y: KITCHEN.counterY + 4 }));
export const STOVES: Point[] = [660, 820, 980].map((x) => ({ x, y: KITCHEN.counterY - 70 }));

export const TABLES: Point[] = [440, 660, 880].flatMap((x) => [
  { x, y: 650 },
  { x, y: 870 },
]);
export const SEAT_OFFSET_X = 78;

// Where customers line up outside when every seat is taken: from the door along the front wall.
export const QUEUE_SPOTS: Point[] = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ x: DOOR_X + 8 + i * 76, y: 1196 + (i % 2) * 10 }));

// Where the bottleneck marker floats for each section.
export const SECTION_ANCHORS: Record<SectionId, Point> = {
  entrance: { x: DOOR_X + 110, y: FRONT.capTop - 40 },
  seating: { x: 660, y: 560 },
  kitchen: { x: 820, y: 260 },
  waiters: { x: WAITER_HOME.x, y: WAITER_HOME.y - 150 },
  cashier: { x: CASHIER_DESK.x, y: CASHIER_DESK.y - 150 },
  dishwashing: { x: 135, y: 270 },
};

// Where a tap in the scene opens a part of the restaurant's upgrades (checked in this order).
// Rectangles in world coordinates: x, y, width, height.
export type SpotId = SectionId | 'parking' | 'busStop';
export const SPOT_AREAS: [SpotId, [number, number, number, number][]][] = [
  [
    'busStop',
    [
      [0, 1050, 230, 300],
      [0, STREET.roadTop, 560, 130],
    ],
  ],
  ['cashier', [[40, 530, 260, 240]]],
  ['waiters', [[330, 470, 230, 130]]],
  ['kitchen', [[560, 190, 520, 410]]],
  ['dishwashing', [[0, 190, 300, 330]]],
  ['seating', [[330, 600, 750, 400]]],
  [
    'entrance',
    [
      [140, 940, 330, 220],
      [140, 1150, 760, 120],
    ],
  ],
  ['parking', [[0, LOT.top, 1080, LOT.bottom - LOT.top]]],
];
export const SPOT_ANCHORS: Record<SpotId, Point> = { ...SECTION_ANCHORS, parking: PARKING_ANCHOR, busStop: BUS_STOP_ANCHOR };

export function spotAt(point: Point): SpotId | null {
  for (const [id, rects] of SPOT_AREAS) {
    if (rects.some(([x, y, w, h]) => point.x >= x && point.x <= x + w && point.y >= y && point.y <= y + h)) return id;
  }
  return null;
}
