import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useGameStore } from '../game/store';
import {
  canPlaceRail,
  CELL_SIZE,
  findRailRoute,
  getNeighbors,
  getTrainTilePosition,
  HUB_TILE,
  IRON_TILE,
  tileFromKey,
  tileFromWorld,
  tileKey,
  worldPosition,
  type Tile
} from '../game/world';

type RailRender = {
  group: THREE.Group;
  keys: Set<string>;
};

const makeMaterial = (color: number, roughness = 0.8, metalness = 0.1) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

const createBox = (
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0
) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

const createCylinder = (
  radiusTop: number,
  radiusBottom: number,
  height: number,
  material: THREE.Material,
  radialSegments = 16
) => {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments),
    material
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

const createStation = (labelColor: number) => {
  const group = new THREE.Group();
  const concrete = makeMaterial(0x8b8174, 0.9, 0);
  const roof = makeMaterial(labelColor, 0.55, 0.15);
  const stripe = makeMaterial(0xf0c25b, 0.45, 0.2);

  group.add(createBox(1.7, 0.18, 1.2, concrete, 0, 0.09, 0));
  group.add(createBox(1.5, 0.18, 0.28, roof, 0, 0.42, -0.22));
  group.add(createBox(1.5, 0.18, 0.28, roof, 0, 0.42, 0.22));
  group.add(createBox(1.1, 0.08, 0.1, stripe, 0, 0.58, 0));
  return group;
};

const createIronNode = () => {
  const group = new THREE.Group();
  const rock = makeMaterial(0x5a3d35, 0.95, 0.05);
  const ore = makeMaterial(0xdb7f42, 0.55, 0.4);

  for (let index = 0; index < 9; index += 1) {
    const radius = 0.22 + (index % 3) * 0.08;
    const mesh = createCylinder(radius * 0.7, radius, 0.42 + radius, rock, 7);
    const angle = index * 0.72;
    mesh.position.set(Math.cos(angle) * 0.45, 0.22, Math.sin(angle) * 0.34);
    mesh.rotation.set(Math.random() * 0.3, angle, Math.random() * 0.25);
    mesh.userData.kind = 'iron';
    group.add(mesh);
  }

  for (let index = 0; index < 5; index += 1) {
    const chunk = createBox(0.22, 0.1, 0.18, ore);
    const angle = index * 1.2;
    chunk.position.set(Math.cos(angle) * 0.38, 0.55 + index * 0.02, Math.sin(angle) * 0.28);
    chunk.rotation.set(0.4, angle, 0.25);
    chunk.userData.kind = 'iron';
    group.add(chunk);
  }

  group.userData.kind = 'iron';
  return group;
};

const createHub = () => {
  const group = new THREE.Group();
  const wall = makeMaterial(0xb66a39, 0.65, 0.05);
  const dark = makeMaterial(0x423735, 0.75, 0.2);
  const metal = makeMaterial(0xaab3ad, 0.35, 0.45);
  const glow = new THREE.MeshStandardMaterial({
    color: 0xffaa45,
    emissive: 0xff7a23,
    emissiveIntensity: 0.45,
    roughness: 0.4
  });

  group.add(createBox(1.7, 0.8, 1.2, wall, 0, 0.4, 0));
  group.add(createBox(1.9, 0.22, 1.35, dark, 0, 0.9, 0));
  group.add(createBox(0.55, 0.6, 0.55, metal, -0.62, 0.32, 0.55));
  group.add(createBox(0.46, 0.25, 0.46, glow, -0.62, 0.78, 0.55));

  const chimney = createCylinder(0.13, 0.18, 1.35, dark, 12);
  chimney.position.set(0.56, 1.35, -0.36);
  group.add(chimney);

  return group;
};

const createSmokePuff = (index: number) => {
  const material = new THREE.MeshStandardMaterial({
    color: 0xc5c2b9,
    transparent: true,
    opacity: 0.18,
    roughness: 1
  });
  const puff = new THREE.Mesh(new THREE.SphereGeometry(0.13 + index * 0.03, 12, 8), material);
  puff.position.set(0.56, 2.0 + index * 0.32, -0.36);
  return puff;
};

const createRailTile = (
  tile: Tile,
  railTiles: string[],
  routeKeys: Set<string>
) => {
  const group = new THREE.Group();
  const pos = worldPosition(tile);
  group.position.set(pos.x, 0.035, pos.z);

  const ballast = makeMaterial(routeKeys.has(tileKey(tile.x, tile.z)) ? 0x73695c : 0x5e625c, 0.98, 0);
  const wood = makeMaterial(0x6b4a32, 0.75, 0.05);
  const steel = makeMaterial(0xc2ccc8, 0.28, 0.55);
  const available = new Set([
    ...railTiles,
    tileKey(HUB_TILE.x, HUB_TILE.z),
    tileKey(IRON_TILE.x, IRON_TILE.z)
  ]);
  const neighbors = getNeighbors(tile).filter((neighbor) =>
    available.has(tileKey(neighbor.x, neighbor.z))
  );
  const horizontal = neighbors.some((neighbor) => neighbor.x !== tile.x);
  const vertical = neighbors.some((neighbor) => neighbor.z !== tile.z);

  group.add(createBox(CELL_SIZE * 0.82, 0.05, CELL_SIZE * 0.82, ballast, 0, 0.02, 0));

  const addStraight = (rotation: number) => {
    const sleeperCount = 4;
    for (let index = 0; index < sleeperCount; index += 1) {
      const offset = -0.42 + index * 0.28;
      const sleeper = createBox(0.92, 0.08, 0.09, wood, 0, 0.08, offset);
      sleeper.rotation.y = rotation;
      group.add(sleeper);
    }

    const railLeft = createBox(0.08, 0.1, 1.08, steel, -0.24, 0.15, 0);
    const railRight = createBox(0.08, 0.1, 1.08, steel, 0.24, 0.15, 0);
    railLeft.rotation.y = rotation;
    railRight.rotation.y = rotation;
    group.add(railLeft, railRight);
  };

  if (vertical || !horizontal) {
    addStraight(0);
  }
  if (horizontal) {
    addStraight(Math.PI / 2);
  }

  return group;
};

const createTrain = () => {
  const train = new THREE.Group();
  const cab = makeMaterial(0xd95c32, 0.48, 0.2);
  const body = makeMaterial(0x2d8b79, 0.5, 0.25);
  const dark = makeMaterial(0x262523, 0.55, 0.4);
  const metal = makeMaterial(0xc5cfcb, 0.3, 0.55);
  const ore = makeMaterial(0xd7773a, 0.5, 0.35);

  train.add(createBox(0.55, 0.36, 0.78, body, 0, 0.38, 0.15));
  train.add(createBox(0.46, 0.45, 0.38, cab, 0, 0.55, -0.27));
  train.add(createBox(0.35, 0.16, 0.22, metal, 0, 0.72, -0.48));

  const wagon = createBox(0.7, 0.28, 0.7, dark, 0, 0.32, 0.88);
  train.add(wagon);

  for (let index = 0; index < 5; index += 1) {
    const lump = createBox(0.17, 0.11, 0.16, ore);
    lump.position.set((index - 2) * 0.12, 0.54 + (index % 2) * 0.05, 0.88 + (index % 3) * 0.1 - 0.1);
    lump.rotation.set(0.4, index, 0.2);
    train.add(lump);
  }

  for (const x of [-0.32, 0.32]) {
    for (const z of [-0.22, 0.3, 0.7, 1.05]) {
      const wheel = createCylinder(0.1, 0.1, 0.08, dark, 14);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.18, z);
      train.add(wheel);
    }
  }

  train.visible = false;
  return train;
};

const rebuildRails = (railRender: RailRender, railTiles: string[]) => {
  const route = findRailRoute(railTiles);
  const routeKeys = new Set(route?.map((tile) => tileKey(tile.x, tile.z)) ?? []);
  const nextKeys = new Set(railTiles);
  const unchanged =
    railRender.keys.size === nextKeys.size &&
    [...nextKeys].every((key) => railRender.keys.has(key));

  if (unchanged) {
    return;
  }

  railRender.group.clear();
  railTiles.forEach((key) => {
    railRender.group.add(createRailTile(tileFromKey(key), railTiles, routeKeys));
  });
  railRender.keys = nextKeys;
};

export const SatisTrainScene = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mountRef.current) {
      return;
    }

    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xc8d5c0);
    scene.fog = new THREE.Fog(0xc8d5c0, 18, 36);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(48, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(9.5, 9.2, 10.8);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.46;
    controls.minDistance = 8;
    controls.maxDistance = 25;
    controls.target.set(-2.7, 0, -2.0);

    const sun = new THREE.DirectionalLight(0xfff5df, 2.2);
    sun.position.set(8, 12, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -18;
    sun.shadow.camera.right = 18;
    sun.shadow.camera.top = 18;
    sun.shadow.camera.bottom = -18;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xf7f2da, 0x53645a, 1.65));

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 24, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x8aa06b, roughness: 0.92 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.userData.kind = 'ground';
    scene.add(ground);

    const grid = new THREE.GridHelper(24.3, 18, 0x55614b, 0x728162);
    grid.position.y = 0.012;
    scene.add(grid);

    const staticGroup = new THREE.Group();
    scene.add(staticGroup);

    const hub = createHub();
    const hubPos = worldPosition(HUB_TILE);
    hub.position.set(hubPos.x, 0.02, hubPos.z + 1.1);
    staticGroup.add(hub);

    const hubStation = createStation(0x2d8b79);
    hubStation.position.set(hubPos.x, 0.04, hubPos.z);
    staticGroup.add(hubStation);

    const ironStation = createStation(0xd95c32);
    const ironPos = worldPosition(IRON_TILE);
    ironStation.position.set(ironPos.x, 0.04, ironPos.z + 1.05);
    staticGroup.add(ironStation);

    const iron = createIronNode();
    iron.position.set(ironPos.x - 0.2, 0.05, ironPos.z - 0.3);
    staticGroup.add(iron);

    const drill = new THREE.Group();
    drill.visible = false;
    const drillBase = makeMaterial(0x544c43, 0.7, 0.25);
    const drillArm = makeMaterial(0xe1a74f, 0.45, 0.25);
    drill.add(createBox(0.8, 0.22, 0.8, drillBase, 0, 0.12, 0));
    const mast = createBox(0.18, 1.2, 0.18, drillArm, 0, 0.75, 0);
    mast.rotation.z = -0.24;
    drill.add(mast);
    const bit = createCylinder(0.08, 0.14, 0.58, drillArm, 12);
    bit.position.set(-0.16, 0.36, -0.18);
    bit.rotation.x = 0.4;
    drill.add(bit);
    drill.position.set(ironPos.x - 0.9, 0.05, ironPos.z - 0.62);
    staticGroup.add(drill);

    const forge = new THREE.Group();
    forge.visible = false;
    const forgeBody = makeMaterial(0x5e4f44, 0.7, 0.18);
    const forgeGlow = new THREE.MeshStandardMaterial({
      color: 0xff8243,
      emissive: 0xff6d1f,
      emissiveIntensity: 0.65,
      roughness: 0.3
    });
    forge.add(createBox(0.8, 0.55, 0.7, forgeBody, 0, 0.28, 0));
    forge.add(createBox(0.62, 0.16, 0.5, forgeGlow, 0, 0.2, -0.36));
    forge.position.set(hubPos.x + 1.35, 0.05, hubPos.z + 0.86);
    staticGroup.add(forge);

    const railRender: RailRender = {
      group: new THREE.Group(),
      keys: new Set()
    };
    scene.add(railRender.group);

    const train = createTrain();
    scene.add(train);

    const smoke = Array.from({ length: 4 }, (_, index) => createSmokePuff(index));
    smoke.forEach((puff) => scene.add(puff));

    const highlight = new THREE.Mesh(
      new THREE.PlaneGeometry(CELL_SIZE * 0.86, CELL_SIZE * 0.86),
      new THREE.MeshBasicMaterial({
        color: 0x7fd169,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
      })
    );
    highlight.rotation.x = -Math.PI / 2;
    highlight.position.y = 0.045;
    highlight.visible = false;
    scene.add(highlight);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hoveredTile: Tile | null = null;
    let miningPulse = 0;
    let lastTime = performance.now();
    let disposed = false;

    const updatePointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
    };

    const getGroundTile = () => {
      const intersects = raycaster.intersectObject(ground);
      if (intersects.length === 0) {
        return null;
      }

      const point = intersects[0].point;
      return tileFromWorld(point.x, point.z);
    };

    const onPointerMove = (event: PointerEvent) => {
      updatePointer(event);
      hoveredTile = getGroundTile();
    };

    const onPointerDown = (event: PointerEvent) => {
      updatePointer(event);
      const game = useGameStore.getState();
      const hitObjects = raycaster.intersectObjects(staticGroup.children, true);
      const hitIron = hitObjects.some((hit) => hit.object.userData.kind === 'iron');

      if (hitIron) {
        game.mineIron();
        miningPulse = 1;
        return;
      }

      if (game.railMode) {
        const tile = getGroundTile();
        if (tile) {
          game.placeRail(tile);
        }
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', resize);

    const animate = (now: number) => {
      if (disposed) {
        return;
      }

      const delta = Math.min((now - lastTime) / 1000, 0.08);
      lastTime = now;
      const game = useGameStore.getState();

      useGameStore.getState().tick(delta);
      rebuildRails(railRender, game.railTiles);

      const route = findRailRoute(game.railTiles);
      if (route && game.trainBuilt) {
        const { position, rotation } = getTrainTilePosition(route, game.trainProgress, game.trainDirection);
        train.visible = true;
        train.position.set(position.x, 0.16, position.z);
        train.rotation.y = rotation;
      } else {
        train.visible = false;
      }

      drill.visible = game.drillBuilt;
      forge.visible = game.autoForgeBuilt;

      if (game.railMode && hoveredTile) {
        const pos = worldPosition(hoveredTile);
        const allowed = canPlaceRail(game.railTiles, hoveredTile, game.inventory.rail);
        highlight.visible = true;
        highlight.position.x = pos.x;
        highlight.position.z = pos.z;
        (highlight.material as THREE.MeshBasicMaterial).color.set(allowed ? 0x7fd169 : 0xff6b5f);
        (highlight.material as THREE.MeshBasicMaterial).opacity = allowed ? 0.32 : 0.2;
      } else {
        highlight.visible = false;
      }

      miningPulse = Math.max(0, miningPulse - delta * 2.6);
      iron.scale.setScalar(1 + miningPulse * 0.08 + Math.sin(now * 0.002) * 0.015);
      drill.rotation.y = Math.sin(now * 0.002) * 0.08;
      forge.scale.y = 1 + Math.sin(now * 0.006) * 0.025;

      smoke.forEach((puff, index) => {
        const cycle = ((now * 0.00018 + index * 0.25) % 1);
        puff.position.y = 1.82 + cycle * 1.35;
        puff.position.x = 0.56 + Math.sin(cycle * Math.PI * 2) * 0.18;
        puff.position.z = 0.74 + Math.cos(cycle * Math.PI * 2) * 0.12;
        (puff.material as THREE.MeshStandardMaterial).opacity = 0.18 * (1 - cycle);
      });

      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);

    return () => {
      disposed = true;
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', resize);
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div className="scene" ref={mountRef} />;
};
