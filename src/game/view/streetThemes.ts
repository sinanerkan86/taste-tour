// Look of the street in front of the restaurant, per city: the front wall, the pavement, the road
// and the traffic. Colors are 0xRRGGBB.

export type VehicleShape = 'sedan' | 'hatch' | 'van' | 'minibus' | 'bug' | 'kei' | 'tuktuk' | 'scooter';

export interface VehicleSpec {
  shape: VehicleShape;
  // Body color; random from the city's car colors when left out.
  body?: number;
  // A second color: a taxi's stripe or roof, a tuk-tuk's canopy.
  trim?: number;
  taxi?: boolean;
  // A band of black and white squares along the side (New York cabs, Cairo taxis).
  checker?: boolean;
}

export interface StreetTheme {
  // The material of the front wall's outer face.
  facade: 'stone' | 'brick' | 'stucco' | 'wood' | 'tiles';
  facadeColor: number;
  // Coping stone on the cut wall, door frame and sign frame.
  trim: number;
  paving: 'slabs' | 'cobbles' | 'waves' | 'bricks' | 'hex';
  pavingA: number;
  pavingB: number;
  road: 'asphalt' | 'cobbles';
  // Center line color (yellow in the Americas, white elsewhere).
  roadLine: number;
  // Traffic keeps left (Mumbai, Bangkok, Tokyo).
  leftHand: boolean;
  // Body color of the city bus that stops by the restaurant.
  bus: number;
  tree: { kind: 'round' | 'palm' | 'umbrella'; leaf: number; blossom?: number };
  carColors: number[];
  // Passing traffic, picked at random (repeat an entry to make it more common).
  vehicles: VehicleSpec[];
}

const CAR_COLORS = [0xd9dde2, 0x2f3438, 0xa8302c, 0x2f5e9e, 0xf2f2ee, 0x7c8a92, 0x3f6e4a, 0xc9a26a];

export const STREET_THEMES: Record<string, StreetTheme> = {
  istanbul: {
    facade: 'stone',
    facadeColor: 0xd8c3a0,
    trim: 0xefe3cb,
    paving: 'cobbles',
    pavingA: 0x9c968d,
    pavingB: 0x7d776f,
    road: 'asphalt',
    roadLine: 0xf2f2ee,
    leftHand: false,
    bus: 0x2f6fb3,
    tree: { kind: 'round', leaf: 0x4f8a3c },
    carColors: CAR_COLORS,
    vehicles: [
      { shape: 'sedan' },
      { shape: 'hatch' },
      { shape: 'sedan', body: 0xf6c400, taxi: true },
      { shape: 'sedan', body: 0xf6c400, taxi: true },
      { shape: 'minibus', body: 0xf6c400, trim: 0x2a2a2a },
      { shape: 'van' },
    ],
  },
  rome: {
    facade: 'stucco',
    facadeColor: 0xd98b52,
    trim: 0xf1e2c8,
    paving: 'cobbles',
    pavingA: 0x6a6560,
    pavingB: 0x524d48,
    road: 'cobbles',
    roadLine: 0xf2f2ee,
    leftHand: false,
    bus: 0xd9622b,
    tree: { kind: 'umbrella', leaf: 0x3f6e34 },
    carColors: CAR_COLORS,
    vehicles: [
      { shape: 'hatch' },
      { shape: 'scooter', body: 0x9fd4c8 },
      { shape: 'scooter', body: 0xc0392b },
      { shape: 'hatch', body: 0xf4f4f0, taxi: true },
      { shape: 'bug' },
      { shape: 'sedan' },
    ],
  },
  paris: {
    facade: 'wood',
    facadeColor: 0x2f4a3c,
    trim: 0xc9a54a,
    paving: 'slabs',
    pavingA: 0xbfb8ac,
    pavingB: 0xa9a296,
    road: 'asphalt',
    roadLine: 0xf2f2ee,
    leftHand: false,
    bus: 0x3a9e8a,
    tree: { kind: 'round', leaf: 0x6a9a48 },
    carColors: CAR_COLORS,
    vehicles: [
      { shape: 'hatch' },
      { shape: 'hatch' },
      { shape: 'sedan', body: 0x2a2a2e, taxi: true },
      { shape: 'scooter', body: 0xe8e2d0 },
      { shape: 'van', body: 0xf2f2ee },
      { shape: 'bug' },
    ],
  },
  cairo: {
    facade: 'stone',
    facadeColor: 0xd6b47c,
    trim: 0xeedcb4,
    paving: 'slabs',
    pavingA: 0xcdb58e,
    pavingB: 0xb69e78,
    road: 'asphalt',
    roadLine: 0xf2f2ee,
    leftHand: false,
    bus: 0xe8e2d4,
    tree: { kind: 'palm', leaf: 0x4f8a3c },
    carColors: CAR_COLORS,
    vehicles: [
      { shape: 'sedan' },
      { shape: 'sedan', body: 0xf2f2ee, taxi: true, checker: true },
      { shape: 'sedan', body: 0xf2f2ee, taxi: true, checker: true },
      { shape: 'minibus', body: 0xf2f2ee, trim: 0x2f5e9e },
      { shape: 'tuktuk', body: 0x2f5e9e, trim: 0x2a2a2a },
      { shape: 'van' },
    ],
  },
  mumbai: {
    facade: 'stucco',
    facadeColor: 0xe9b89a,
    trim: 0xf6e7d0,
    paving: 'slabs',
    pavingA: 0xaaa59c,
    pavingB: 0x958f87,
    road: 'asphalt',
    roadLine: 0xf2f2ee,
    leftHand: true,
    bus: 0xc0392b,
    tree: { kind: 'round', leaf: 0x3f7a34 },
    carColors: CAR_COLORS,
    vehicles: [
      { shape: 'tuktuk', body: 0x2f7a3a, trim: 0xf2c200 },
      { shape: 'tuktuk', body: 0x2f7a3a, trim: 0xf2c200 },
      { shape: 'hatch', body: 0x2a2a2a, trim: 0xf2c200, taxi: true },
      { shape: 'hatch' },
      { shape: 'scooter', body: 0x2a2a2a },
      { shape: 'sedan' },
    ],
  },
  bangkok: {
    facade: 'wood',
    facadeColor: 0x8b5a3c,
    trim: 0xd9b25a,
    paving: 'bricks',
    pavingA: 0xbb8d6e,
    pavingB: 0xa47a5e,
    road: 'asphalt',
    roadLine: 0xf2f2ee,
    leftHand: true,
    bus: 0xd8577e,
    tree: { kind: 'palm', leaf: 0x4a8a3a },
    carColors: CAR_COLORS,
    vehicles: [
      { shape: 'tuktuk', body: 0x2f5e9e, trim: 0xf2c200 },
      { shape: 'tuktuk', body: 0xc0392b, trim: 0xf2c200 },
      { shape: 'sedan', body: 0xe85a9a, taxi: true },
      { shape: 'scooter', body: 0xf2f2ee },
      { shape: 'hatch' },
      { shape: 'minibus', body: 0xf2f2ee, trim: 0xe85a9a },
    ],
  },
  tokyo: {
    facade: 'wood',
    facadeColor: 0x3d3530,
    trim: 0xe9e1d0,
    paving: 'slabs',
    pavingA: 0xcac5bb,
    pavingB: 0xb8b3a9,
    road: 'asphalt',
    roadLine: 0xf2f2ee,
    leftHand: true,
    bus: 0x4c9a4a,
    tree: { kind: 'round', leaf: 0x6a9a48, blossom: 0xf6c4d4 },
    carColors: CAR_COLORS,
    vehicles: [
      { shape: 'kei' },
      { shape: 'kei' },
      { shape: 'hatch', body: 0x1f2a44, trim: 0xf2c200, taxi: true },
      { shape: 'sedan' },
      { shape: 'scooter', body: 0xf2f2ee },
      { shape: 'van', body: 0xf2f2ee },
    ],
  },
  rio: {
    facade: 'tiles',
    facadeColor: 0x2a6fb5,
    trim: 0xf4efe4,
    paving: 'waves',
    pavingA: 0xf0ece2,
    pavingB: 0x2e2c2a,
    road: 'asphalt',
    roadLine: 0xf2c200,
    leftHand: false,
    bus: 0xe3b23c,
    tree: { kind: 'palm', leaf: 0x4f8f3a },
    carColors: CAR_COLORS,
    vehicles: [
      { shape: 'hatch' },
      { shape: 'sedan', body: 0xf6c400, trim: 0x2a5fbf, taxi: true },
      { shape: 'bug' },
      { shape: 'van' },
      { shape: 'hatch' },
    ],
  },
  mexicoCity: {
    facade: 'stucco',
    facadeColor: 0xd9577f,
    trim: 0xf7e6c4,
    paving: 'slabs',
    pavingA: 0xb3a899,
    pavingB: 0x9e9384,
    road: 'asphalt',
    roadLine: 0xf2c200,
    leftHand: false,
    bus: 0xb83a6b,
    tree: { kind: 'round', leaf: 0x5a8a44, blossom: 0x9a7ad8 },
    carColors: CAR_COLORS,
    vehicles: [
      { shape: 'bug' },
      { shape: 'bug', body: 0xe85a8a, trim: 0xf4f1ea, taxi: true },
      { shape: 'hatch', body: 0xe85a8a, trim: 0xf4f1ea, taxi: true },
      { shape: 'sedan' },
      { shape: 'van' },
    ],
  },
  newYork: {
    facade: 'brick',
    facadeColor: 0x9a4a32,
    trim: 0xd9cfc0,
    paving: 'slabs',
    pavingA: 0xbdbab3,
    pavingB: 0xaaa79f,
    road: 'asphalt',
    roadLine: 0xf2c200,
    leftHand: false,
    bus: 0x2f5e9e,
    tree: { kind: 'round', leaf: 0x5a8a3c },
    carColors: CAR_COLORS,
    vehicles: [
      { shape: 'sedan', body: 0xf4c20d, taxi: true, checker: true },
      { shape: 'sedan', body: 0xf4c20d, taxi: true, checker: true },
      { shape: 'sedan' },
      { shape: 'van' },
      { shape: 'hatch' },
    ],
  },
};
