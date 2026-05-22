import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useGameStore } from '../game/store';
import {
  canPlaceRail,
  findRailRoute,
  getNeighbors,
  HUB_TILE,
  IRON_TILE,
  isSameTile,
  MAP_LIMIT,
  tileFromKey,
  tileKey,
  type Tile
} from '../game/world';

const VIEWBOX_WIDTH = 1040;
const VIEWBOX_HEIGHT = 650;
const TILE_WIDTH = 56;
const TILE_HEIGHT = 32;
const ORIGIN_X = 520;
const ORIGIN_Y = 306;

const allTiles: Tile[] = [];

for (let z = MAP_LIMIT.minZ; z <= MAP_LIMIT.maxZ; z += 1) {
  for (let x = MAP_LIMIT.minX; x <= MAP_LIMIT.maxX; x += 1) {
    allTiles.push({ x, z });
  }
}

allTiles.sort((a, b) => a.x + a.z - (b.x + b.z) || a.x - b.x);

const toIso = ({ x, z }: Tile) => ({
  x: ORIGIN_X + (x - z) * (TILE_WIDTH / 2),
  y: ORIGIN_Y + (x + z) * (TILE_HEIGHT / 2)
});

const diamondPoints = (tile: Tile) => {
  const point = toIso(tile);
  return [
    `${point.x},${point.y - TILE_HEIGHT / 2}`,
    `${point.x + TILE_WIDTH / 2},${point.y}`,
    `${point.x},${point.y + TILE_HEIGHT / 2}`,
    `${point.x - TILE_WIDTH / 2},${point.y}`
  ].join(' ');
};

const tileClass = (tile: Tile) => {
  if (isSameTile(tile, HUB_TILE)) {
    return 'tile-hub';
  }
  if (isSameTile(tile, IRON_TILE)) {
    return 'tile-iron';
  }

  const hash = Math.abs(tile.x * 13 + tile.z * 19) % 5;
  return `tile-ground-${hash}`;
};

const routePath = (route: Tile[]) =>
  route
    .map((tile, index) => {
      const point = toIso(tile);
      return `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`;
    })
    .join(' ');

const getRailSegments = (railTiles: string[]) => {
  const network = new Set([
    ...railTiles,
    tileKey(HUB_TILE.x, HUB_TILE.z),
    tileKey(IRON_TILE.x, IRON_TILE.z)
  ]);
  const segments: Array<{ from: Tile; to: Tile; key: string }> = [];

  network.forEach((key) => {
    const from = tileFromKey(key);
    getNeighbors(from).forEach((to) => {
      const toKey = tileKey(to.x, to.z);
      if (network.has(toKey) && key < toKey) {
        segments.push({ from, to, key: `${key}:${toKey}` });
      }
    });
  });

  return segments;
};

const getTrainTransform = (
  route: Tile[],
  progress: number,
  direction: 1 | -1
) => {
  const travelRoute = direction === 1 ? route : [...route].reverse();
  const clamped = Math.min(Math.max(progress, 0), 0.9999);
  const scaled = clamped * (travelRoute.length - 1);
  const index = Math.floor(scaled);
  const localT = scaled - index;
  const from = toIso(travelRoute[index]);
  const to = toIso(travelRoute[index + 1]);
  const x = from.x + (to.x - from.x) * localT;
  const y = from.y + (to.y - from.y) * localT;
  const rotation = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;

  return { x, y, rotation };
};

const useGameTicker = () => {
  useEffect(() => {
    let frame = 0;
    let last = performance.now();

    const animate = (now: number) => {
      const delta = Math.min((now - last) / 1000, 0.08);
      last = now;
      useGameStore.getState().tick(delta);
      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);
};

const FacilityHub = ({ tile }: { tile: Tile }) => {
  const point = toIso(tile);

  return (
    <g className="facility facility-hub" transform={`translate(${point.x} ${point.y - 28})`}>
      <path className="facility-shadow" d="M -44 28 L 0 6 L 44 28 L 0 50 Z" />
      <path className="hub-foundation" d="M -34 20 L 0 2 L 34 20 L 0 38 Z" />
      <path className="hub-body" d="M -25 12 L 0 0 L 25 12 L 25 34 L 0 47 L -25 34 Z" />
      <path className="hub-roof" d="M -32 9 L 0 -8 L 32 9 L 0 27 Z" />
      <rect className="hub-door" x="-6" y="21" width="12" height="18" rx="2" />
      <rect className="hub-window" x="-20" y="17" width="10" height="7" rx="2" />
      <rect className="hub-window" x="10" y="17" width="10" height="7" rx="2" />
      <rect className="hub-chimney" x="15" y="-20" width="10" height="23" rx="3" />
      <text className="map-label" x="0" y="67" textAnchor="middle">
        拠点
      </text>
    </g>
  );
};

const IronDeposit = ({ tile, onMine }: { tile: Tile; onMine: () => void }) => {
  const point = toIso(tile);

  return (
    <g
      className="facility facility-iron"
      onClick={onMine}
      role="button"
      tabIndex={0}
      transform={`translate(${point.x} ${point.y - 22})`}
      onKeyDown={(event: KeyboardEvent<SVGGElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onMine();
        }
      }}
    >
      <path className="facility-shadow" d="M -42 30 L 0 10 L 42 30 L 0 50 Z" />
      <path className="mine-rim" d="M -32 24 L 0 8 L 32 24 L 0 40 Z" />
      <circle className="ore-node ore-node-a" cx="-16" cy="15" r="13" />
      <circle className="ore-node ore-node-b" cx="2" cy="7" r="16" />
      <circle className="ore-node ore-node-c" cx="18" cy="21" r="12" />
      <path className="ore-vein" d="M -24 19 C -8 8, 8 9, 26 22" />
      <text className="map-label" x="0" y="66" textAnchor="middle">
        鉄鉱床
      </text>
    </g>
  );
};

const DrillIcon = ({ tile, active }: { tile: Tile; active: boolean }) => {
  if (!active) {
    return null;
  }

  const point = toIso(tile);
  return (
    <g className="upgrade-icon drill-icon" transform={`translate(${point.x - 54} ${point.y - 44})`}>
      <path className="upgrade-pad" d="M -18 20 L 10 7 L 38 20 L 10 34 Z" />
      <rect className="drill-tower" x="0" y="-18" width="14" height="38" rx="3" />
      <path className="drill-arm" d="M 6 -12 L 33 7 L 28 15 L 4 1 Z" />
      <path className="drill-bit" d="M 29 13 L 43 20 L 27 28 Z" />
    </g>
  );
};

const AutoForgeIcon = ({ tile, active }: { tile: Tile; active: boolean }) => {
  if (!active) {
    return null;
  }

  const point = toIso(tile);
  return (
    <g className="upgrade-icon forge-icon" transform={`translate(${point.x + 58} ${point.y - 30})`}>
      <path className="upgrade-pad" d="M -26 18 L 0 5 L 28 18 L 0 32 Z" />
      <rect className="forge-body" x="-16" y="-10" width="34" height="34" rx="5" />
      <rect className="forge-mouth" x="-8" y="7" width="18" height="12" rx="3" />
      <rect className="forge-stack" x="8" y="-28" width="9" height="24" rx="3" />
    </g>
  );
};

const GhostExpansion = ({ tile, label }: { tile: Tile; label: string }) => {
  const point = toIso(tile);

  return (
    <g className="ghost-expansion" transform={`translate(${point.x} ${point.y - 18})`}>
      <path d="M -30 20 L 0 5 L 30 20 L 0 35 Z" />
      <rect x="-18" y="0" width="12" height="22" rx="3" />
      <rect x="-2" y="-10" width="12" height="32" rx="3" />
      <rect x="14" y="6" width="12" height="16" rx="3" />
      <text x="0" y="52" textAnchor="middle">
        {label}
      </text>
    </g>
  );
};

const TrainMarker = ({
  route,
  progress,
  direction,
  cargo
}: {
  route: Tile[];
  progress: number;
  direction: 1 | -1;
  cargo: number;
}) => {
  if (route.length < 2) {
    return null;
  }

  const transform = getTrainTransform(route, progress, direction);

  return (
    <g
      className="train-marker"
      transform={`translate(${transform.x} ${transform.y - 9}) rotate(${transform.rotation})`}
    >
      <rect className="train-shadow" x="-28" y="9" width="58" height="14" rx="7" />
      <rect className="train-body" x="-27" y="-12" width="34" height="22" rx="5" />
      <rect className="train-cab" x="-3" y="-18" width="20" height="24" rx="5" />
      <rect className="train-wagon" x="18" y="-10" width="26" height="20" rx="4" />
      {cargo > 0 && (
        <g className="cargo-stack">
          <rect x="23" y="-17" width="8" height="8" rx="2" />
          <rect x="33" y="-15" width="8" height="8" rx="2" />
        </g>
      )}
      <circle cx="-16" cy="13" r="4" />
      <circle cx="6" cy="13" r="4" />
      <circle cx="27" cy="13" r="4" />
      <circle cx="41" cy="13" r="4" />
    </g>
  );
};

export const SatisTrainMap2D = () => {
  useGameTicker();
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const state = useGameStore();
  const route = useMemo(() => findRailRoute(state.railTiles), [state.railTiles]);
  const routeKeys = useMemo(
    () => new Set(route?.map((tile) => tileKey(tile.x, tile.z)) ?? []),
    [route]
  );
  const railSet = useMemo(() => new Set(state.railTiles), [state.railTiles]);
  const railSegments = useMemo(() => getRailSegments(state.railTiles), [state.railTiles]);

  const handleTileAction = (tile: Tile) => {
    if (isSameTile(tile, IRON_TILE)) {
      state.mineIron();
      return;
    }

    if (state.railMode) {
      state.placeRail(tile);
    }
  };

  return (
    <section className="map-2d" aria-label="SatisTrain 2D map">
      <svg className="map-svg" viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} role="img">
        <defs>
          <linearGradient id="connected-rail" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f2b85b" />
            <stop offset="100%" stopColor="#57b8ad" />
          </linearGradient>
        </defs>

        <rect className="map-water" x="0" y="0" width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} />
        <path className="map-contour map-contour-a" d="M 108 444 C 232 320, 374 292, 506 374 C 646 460, 800 430, 948 294" />
        <path className="map-contour map-contour-b" d="M 164 196 C 310 138, 448 184, 586 150 C 716 118, 820 150, 930 92" />
        <path className="map-contour map-contour-c" d="M 210 564 C 366 494, 496 536, 612 482 C 732 426, 812 486, 936 422" />
        <path className="map-river" d="M 872 0 C 824 110, 890 176, 846 284 C 802 392, 896 458, 854 650" />

        <g className="tile-layer">
          {allTiles.map((tile) => {
            const key = tileKey(tile.x, tile.z);
            const isRail = railSet.has(key);
            const placeable =
              state.railMode && canPlaceRail(state.railTiles, tile, state.inventory.rail);
            const hovered = hoveredKey === key;
            const classes = [
              'map-tile',
              tileClass(tile),
              isRail ? 'has-rail' : '',
              routeKeys.has(key) ? 'is-route' : '',
              placeable ? 'can-place' : '',
              hovered ? 'is-hovered' : ''
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <polygon
                aria-label={`tile ${tile.x},${tile.z}`}
                className={classes}
                key={key}
                points={diamondPoints(tile)}
                role="button"
                tabIndex={0}
                onBlur={() => setHoveredKey(null)}
                onClick={() => handleTileAction(tile)}
                onFocus={() => setHoveredKey(key)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleTileAction(tile);
                  }
                }}
                onMouseEnter={() => setHoveredKey(key)}
                onMouseLeave={() => setHoveredKey(null)}
              />
            );
          })}
        </g>

        <g className="rail-layer">
          {railSegments.map((segment) => {
            const from = toIso(segment.from);
            const to = toIso(segment.to);
            const connected =
              routeKeys.has(tileKey(segment.from.x, segment.from.z)) &&
              routeKeys.has(tileKey(segment.to.x, segment.to.z));

            return (
              <g className={connected ? 'rail-segment connected' : 'rail-segment'} key={segment.key}>
                <line className="rail-bed" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
                <line className="rail-left" x1={from.x} y1={from.y - 4} x2={to.x} y2={to.y - 4} />
                <line className="rail-right" x1={from.x} y1={from.y + 4} x2={to.x} y2={to.y + 4} />
              </g>
            );
          })}
          {route && <path className="rail-route-glow" d={routePath(route)} />}
        </g>

        <GhostExpansion tile={{ x: 6, z: -3 }} label="都市" />
        <GhostExpansion tile={{ x: 4, z: 5 }} label="港湾" />
        <FacilityHub tile={HUB_TILE} />
        <IronDeposit tile={IRON_TILE} onMine={state.mineIron} />
        <DrillIcon tile={IRON_TILE} active={state.drillBuilt} />
        <AutoForgeIcon tile={HUB_TILE} active={state.autoForgeBuilt} />
        {route && state.trainBuilt && (
          <TrainMarker
            cargo={state.trainCargo}
            direction={state.trainDirection}
            progress={state.trainProgress}
            route={route}
          />
        )}
      </svg>

      <div className="map-caption">
        <span>{route ? '稼働線' : '計画線'}</span>
        <strong>{route ? '鉄鉱床線 接続' : `${state.railTiles.length} / 鉄鉱床線`}</strong>
      </div>
    </section>
  );
};
