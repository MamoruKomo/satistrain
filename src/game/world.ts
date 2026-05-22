export type Tile = {
  x: number;
  z: number;
};

export const CELL_SIZE = 1.35;
export const HUB_TILE: Tile = { x: 0, z: 0 };
export const IRON_TILE: Tile = { x: -6, z: -4 };
export const MAP_LIMIT = {
  minX: -9,
  maxX: 8,
  minZ: -7,
  maxZ: 7
};

export const tileKey = (x: number, z: number) => `${x},${z}`;

export const tileFromKey = (key: string): Tile => {
  const [x, z] = key.split(',').map(Number);
  return { x, z };
};

export const isSameTile = (a: Tile, b: Tile) => a.x === b.x && a.z === b.z;

export const isEndpoint = (tile: Tile) =>
  isSameTile(tile, HUB_TILE) || isSameTile(tile, IRON_TILE);

export const isInsideMap = ({ x, z }: Tile) =>
  x >= MAP_LIMIT.minX && x <= MAP_LIMIT.maxX && z >= MAP_LIMIT.minZ && z <= MAP_LIMIT.maxZ;

export const worldPosition = ({ x, z }: Tile) => ({
  x: x * CELL_SIZE,
  z: z * CELL_SIZE
});

export const tileFromWorld = (x: number, z: number): Tile => ({
  x: Math.round(x / CELL_SIZE),
  z: Math.round(z / CELL_SIZE)
});

export const getNeighbors = ({ x, z }: Tile): Tile[] => [
  { x: x + 1, z },
  { x: x - 1, z },
  { x, z: z + 1 },
  { x, z: z - 1 }
];

export const canPlaceRail = (railTiles: string[], tile: Tile, railInventory = 1) => {
  if (railInventory <= 0 || !isInsideMap(tile) || isEndpoint(tile)) {
    return false;
  }

  const key = tileKey(tile.x, tile.z);
  if (railTiles.includes(key)) {
    return false;
  }

  return getNeighbors(tile).some((neighbor) => {
    const neighborKey = tileKey(neighbor.x, neighbor.z);
    return railTiles.includes(neighborKey) || isSameTile(neighbor, HUB_TILE);
  });
};

export const findRailRoute = (railTiles: string[]) => {
  const allowed = new Set<string>([
    ...railTiles,
    tileKey(HUB_TILE.x, HUB_TILE.z),
    tileKey(IRON_TILE.x, IRON_TILE.z)
  ]);
  const startKey = tileKey(HUB_TILE.x, HUB_TILE.z);
  const endKey = tileKey(IRON_TILE.x, IRON_TILE.z);
  const queue: Tile[] = [HUB_TILE];
  const visited = new Set<string>([startKey]);
  const previous = new Map<string, string>();

  while (queue.length > 0) {
    const current = queue.shift() as Tile;
    const currentKey = tileKey(current.x, current.z);

    if (currentKey === endKey) {
      const path: Tile[] = [];
      let cursor = endKey;

      while (cursor) {
        path.push(tileFromKey(cursor));
        const next = previous.get(cursor);
        if (!next) {
          break;
        }
        cursor = next;
      }

      return path.reverse();
    }

    for (const neighbor of getNeighbors(current)) {
      const neighborKey = tileKey(neighbor.x, neighbor.z);
      if (!allowed.has(neighborKey) || visited.has(neighborKey)) {
        continue;
      }

      visited.add(neighborKey);
      previous.set(neighborKey, currentKey);
      queue.push(neighbor);
    }
  }

  return null;
};

export const getTrainTilePosition = (
  route: Tile[],
  progress: number,
  direction: 1 | -1
) => {
  if (route.length < 2) {
    return { position: worldPosition(HUB_TILE), rotation: 0 };
  }

  const travelRoute = direction === 1 ? route : [...route].reverse();
  const clamped = Math.min(Math.max(progress, 0), 0.9999);
  const scaled = clamped * (travelRoute.length - 1);
  const index = Math.floor(scaled);
  const localT = scaled - index;
  const from = worldPosition(travelRoute[index]);
  const to = worldPosition(travelRoute[index + 1]);
  const x = from.x + (to.x - from.x) * localT;
  const z = from.z + (to.z - from.z) * localT;
  const rotation = Math.atan2(to.x - from.x, to.z - from.z);

  return {
    position: { x, z },
    rotation
  };
};
