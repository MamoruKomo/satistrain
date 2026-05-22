import { create } from 'zustand';
import {
  canPlaceRail,
  findRailRoute,
  IRON_TILE,
  tileKey,
  type Tile
} from './world';

export type Inventory = {
  ore: number;
  ingot: number;
  plate: number;
  rod: number;
  rail: number;
};

export type GameState = {
  inventory: Inventory;
  money: number;
  railTiles: string[];
  railMode: boolean;
  trainBuilt: boolean;
  drillBuilt: boolean;
  autoForgeBuilt: boolean;
  trainProgress: number;
  trainDirection: 1 | -1;
  trainCargo: number;
  oreDelivered: number;
  manualMined: number;
  forgeTimer: number;
  lastEvent: string;
  mineIron: () => void;
  smeltOre: () => void;
  craftPlates: () => void;
  craftRods: () => void;
  craftRails: () => void;
  buildTrain: () => void;
  buildDrill: () => void;
  buildAutoForge: () => void;
  placeRail: (tile: Tile) => void;
  toggleRailMode: () => void;
  tick: (delta: number) => void;
};

const canPay = (inventory: Inventory, cost: Partial<Inventory>) =>
  Object.entries(cost).every(([key, value]) => inventory[key as keyof Inventory] >= (value ?? 0));

const pay = (inventory: Inventory, cost: Partial<Inventory>) => {
  const next = { ...inventory };
  Object.entries(cost).forEach(([key, value]) => {
    next[key as keyof Inventory] -= value ?? 0;
  });
  return next;
};

export const useGameStore = create<GameState>((set, get) => ({
  inventory: {
    ore: 0,
    ingot: 0,
    plate: 0,
    rod: 0,
    rail: 0
  },
  money: 120,
  railTiles: [],
  railMode: true,
  trainBuilt: false,
  drillBuilt: false,
  autoForgeBuilt: false,
  trainProgress: 0,
  trainDirection: 1,
  trainCargo: 0,
  oreDelivered: 0,
  manualMined: 0,
  forgeTimer: 0,
  lastEvent: '鉄鉱床から始めよう。手掘りした鉄が最初の線路になる。',

  mineIron: () => {
    const { inventory, manualMined } = get();
    set({
      inventory: { ...inventory, ore: inventory.ore + 1 },
      manualMined: manualMined + 1,
      lastEvent: '鉄鉱石を1個掘った。'
    });
  },

  smeltOre: () => {
    const { inventory } = get();
    if (inventory.ore < 2) {
      set({ lastEvent: '精錬には鉄鉱石が2個必要。' });
      return;
    }

    set({
      inventory: { ...inventory, ore: inventory.ore - 2, ingot: inventory.ingot + 1 },
      lastEvent: '小型炉で鉄インゴットを作った。'
    });
  },

  craftPlates: () => {
    const { inventory } = get();
    if (inventory.ingot < 1) {
      set({ lastEvent: '鉄板にはインゴットが必要。' });
      return;
    }

    set({
      inventory: { ...inventory, ingot: inventory.ingot - 1, plate: inventory.plate + 2 },
      lastEvent: '鉄板を2枚打ち出した。'
    });
  },

  craftRods: () => {
    const { inventory } = get();
    if (inventory.ingot < 1) {
      set({ lastEvent: '鉄棒にはインゴットが必要。' });
      return;
    }

    set({
      inventory: { ...inventory, ingot: inventory.ingot - 1, rod: inventory.rod + 2 },
      lastEvent: '鉄棒を2本作った。'
    });
  },

  craftRails: () => {
    const { inventory } = get();
    const cost = { plate: 2, rod: 1 };

    if (!canPay(inventory, cost)) {
      set({ lastEvent: '線路キットには鉄板2枚と鉄棒1本が必要。' });
      return;
    }

    set({
      inventory: { ...pay(inventory, cost), rail: inventory.rail - 0 + 4 },
      lastEvent: '線路キットを作った。4マス分の線路を敷ける。'
    });
  },

  buildTrain: () => {
    const { inventory, money, trainBuilt } = get();
    const cost = { plate: 6, rod: 4 };

    if (trainBuilt) {
      set({ lastEvent: '小型機関車はもう稼働している。' });
      return;
    }

    if (money < 80 || !canPay(inventory, cost)) {
      set({ lastEvent: '小型機関車には80cr、鉄板6枚、鉄棒4本が必要。' });
      return;
    }

    set({
      inventory: pay(inventory, cost),
      money: money - 80,
      trainBuilt: true,
      lastEvent: '小型機関車を組み上げた。鉄鉱床まで線路がつながると走り出す。'
    });
  },

  buildDrill: () => {
    const { inventory, money, drillBuilt } = get();
    const cost = { plate: 10, rod: 8 };

    if (drillBuilt) {
      set({ lastEvent: '簡易ドリルは鉄鉱床で稼働中。' });
      return;
    }

    if (money < 110 || !canPay(inventory, cost)) {
      set({ lastEvent: '簡易ドリルには110cr、鉄板10枚、鉄棒8本が必要。' });
      return;
    }

    set({
      inventory: pay(inventory, cost),
      money: money - 110,
      drillBuilt: true,
      lastEvent: '簡易ドリルを鉄鉱床に設置した。列車の積載量が増える。'
    });
  },

  buildAutoForge: () => {
    const { inventory, money, autoForgeBuilt } = get();
    const cost = { plate: 8, rod: 6 };

    if (autoForgeBuilt) {
      set({ lastEvent: '自動炉は拠点で稼働中。' });
      return;
    }

    if (money < 90 || !canPay(inventory, cost)) {
      set({ lastEvent: '自動炉には90cr、鉄板8枚、鉄棒6本が必要。' });
      return;
    }

    set({
      inventory: pay(inventory, cost),
      money: money - 90,
      autoForgeBuilt: true,
      lastEvent: '自動炉を起動した。鉱石がある間、インゴットを作り続ける。'
    });
  },

  placeRail: (tile) => {
    const { inventory, railTiles } = get();

    if (!canPlaceRail(railTiles, tile, inventory.rail)) {
      set({ lastEvent: '拠点からつながる場所に線路を伸ばせる。' });
      return;
    }

    const key = tileKey(tile.x, tile.z);
    const nextRails = [...railTiles, key];
    const connected = Boolean(findRailRoute(nextRails));
    set({
      railTiles: nextRails,
      inventory: { ...inventory, rail: inventory.rail - 1 },
      lastEvent: connected
        ? '鉄鉱床まで線路がつながった。列車の出番だ。'
        : '線路を1マス敷いた。'
    });
  },

  toggleRailMode: () => {
    const { railMode } = get();
    set({
      railMode: !railMode,
      lastEvent: !railMode ? '線路敷設モードにした。' : '線路敷設モードを解除した。'
    });
  },

  tick: (delta) => {
    const state = get();
    const route = findRailRoute(state.railTiles);
    const nextInventory = { ...state.inventory };
    let nextMoney = state.money;
    let nextProgress = state.trainProgress;
    let nextDirection = state.trainDirection;
    let nextCargo = state.trainCargo;
    let nextDelivered = state.oreDelivered;
    let nextForgeTimer = state.forgeTimer;
    let nextEvent = state.lastEvent;
    let changed = false;

    if (state.autoForgeBuilt) {
      nextForgeTimer += delta;
      if (nextForgeTimer >= 2.2 && nextInventory.ore >= 2) {
        nextForgeTimer = 0;
        nextInventory.ore -= 2;
        nextInventory.ingot += 1;
        nextEvent = '自動炉が鉱石をインゴットに変えた。';
        changed = true;
      }
    }

    if (route && state.trainBuilt) {
      const speed = state.drillBuilt ? 0.105 : 0.075;
      nextProgress += delta * speed;

      if (nextProgress >= 1) {
        nextProgress = 0;

        if (nextDirection === 1) {
          nextDirection = -1;
          nextCargo = state.drillBuilt ? 8 : 4;
          nextEvent = state.drillBuilt
            ? 'ドリルの積み出しで鉱石を8個積載。'
            : '坑口の積み場で鉱石を4個積載。';
        } else {
          nextDirection = 1;
          nextInventory.ore += nextCargo;
          nextMoney += nextCargo * 4;
          nextDelivered += nextCargo;
          nextEvent = `列車が鉄鉱石${nextCargo}個を拠点へ搬入。`;
          nextCargo = 0;
        }

        changed = true;
      } else {
        changed = true;
      }
    }

    if (changed) {
      set({
        inventory: nextInventory,
        money: nextMoney,
        trainProgress: nextProgress,
        trainDirection: nextDirection,
        trainCargo: nextCargo,
        oreDelivered: nextDelivered,
        forgeTimer: nextForgeTimer,
        lastEvent: nextEvent
      });
    } else if (state.autoForgeBuilt && nextForgeTimer !== state.forgeTimer) {
      set({ forgeTimer: nextForgeTimer });
    }
  }
}));

export const getObjective = (state: GameState) => {
  const connected = Boolean(findRailRoute(state.railTiles));

  if (state.manualMined < 8) {
    return {
      title: '手掘りで鉄を集める',
      detail: '鉄鉱床を叩いて最初の素材を確保する。',
      progress: state.manualMined / 8
    };
  }

  if (state.inventory.rail < 1 && state.railTiles.length < 1) {
    return {
      title: '鉄を線路キットに加工する',
      detail: '精錬、鉄板、鉄棒、線路キットの順に作る。',
      progress: Math.min((state.inventory.plate + state.inventory.rod + state.inventory.rail) / 7, 1)
    };
  }

  if (!connected) {
    const distanceToMine = Math.abs(IRON_TILE.x) + Math.abs(IRON_TILE.z);
    return {
      title: '鉄鉱床まで線路を伸ばす',
      detail: '拠点から連続する線路だけが敷設できる。',
      progress: Math.min(state.railTiles.length / (distanceToMine - 1), 1)
    };
  }

  if (!state.trainBuilt) {
    return {
      title: '小型機関車を組み上げる',
      detail: '線路がつながったら、鉱石輸送を自動化する。',
      progress: Math.min((state.inventory.plate + state.inventory.rod) / 10, 1)
    };
  }

  if (state.oreDelivered < 24) {
    return {
      title: '鉄道で鉱石を搬入する',
      detail: '列車が往復するほど次の設備が近づく。',
      progress: state.oreDelivered / 24
    };
  }

  if (!state.drillBuilt) {
    return {
      title: '簡易ドリルで鉱山化する',
      detail: '手掘りの坑口を、積載量の大きい鉱山に変える。',
      progress: Math.min((state.inventory.plate + state.inventory.rod + state.money / 20) / 24, 1)
    };
  }

  if (!state.autoForgeBuilt) {
    return {
      title: '自動炉で加工ラインを作る',
      detail: '鉱石搬入と精錬がつながると開拓が回り始める。',
      progress: Math.min((state.inventory.plate + state.inventory.rod + state.money / 20) / 20, 1)
    };
  }

  return {
    title: '路線網を拡張する',
    detail: 'ここからは資源地、工場、都市を増やしていく段階。',
    progress: 1
  };
};
