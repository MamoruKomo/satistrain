import {
  Coins,
  Factory,
  Hammer,
  Pickaxe,
  Package,
  Route,
  Train,
  Wrench
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useGameStore, getObjective, type Inventory } from '../game/store';
import { findRailRoute } from '../game/world';

type ActionButtonProps = {
  icon: ReactNode;
  label: string;
  meta: string;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
};

type StatChipProps = {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: 'good' | 'warn';
};

const resourceLabels: Record<keyof Inventory, string> = {
  ore: '鉱石',
  ingot: '鋼塊',
  plate: '鉄板',
  rod: '鉄棒',
  rail: '線路'
};

const resourceUnits: Record<keyof Inventory, string> = {
  ore: 'raw',
  ingot: 'bar',
  plate: 'pcs',
  rod: 'pcs',
  rail: 'tiles'
};

const ActionButton = ({
  icon,
  label,
  meta,
  disabled = false,
  active = false,
  onClick
}: ActionButtonProps) => (
  <button
    className={`action-button${active ? ' is-active' : ''}`}
    disabled={disabled}
    onClick={onClick}
    type="button"
  >
    <span className="action-icon">{icon}</span>
    <span className="action-text">
      <strong>{label}</strong>
      <small>{meta}</small>
    </span>
  </button>
);

const StatChip = ({ icon, label, value, tone }: StatChipProps) => (
  <span className={`stat-chip${tone ? ` is-${tone}` : ''}`}>
    <span className="stat-icon">{icon}</span>
    <span>
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  </span>
);

export const GameUI = () => {
  const state = useGameStore();
  const route = findRailRoute(state.railTiles);
  const connected = Boolean(route);
  const objective = getObjective(state);
  const objectiveProgress = `${Math.round(Math.min(objective.progress, 1) * 100)}%`;

  return (
    <div className="hud-shell">
      <header className="command-bar">
        <div className="brand-lockup">
          <p className="eyebrow">SATISTRAIN</p>
          <h1>開拓鉄道</h1>
          <span>Ironworks Railway Desk</span>
        </div>
        <div className="metric-row" aria-label="経営指標">
          <StatChip icon={<Coins size={16} />} label="資金" value={`${state.money}cr`} />
          <StatChip icon={<Package size={16} />} label="搬入" value={`${state.oreDelivered}`} />
          <StatChip
            icon={<Route size={16} />}
            label="鉄鉱床線"
            tone={connected ? 'good' : 'warn'}
            value={connected ? '接続済' : '未接続'}
          />
        </div>
      </header>

      <aside className="left-console">
        <section className="console-section objective-section">
          <div className="section-heading">
            <span>現在の目標</span>
            <strong>{objectiveProgress}</strong>
          </div>
          <h2>{objective.title}</h2>
          <p>{objective.detail}</p>
          <div className="progress-track">
            <span style={{ width: objectiveProgress }} />
          </div>
        </section>

        <section className="console-section inventory-section">
          <div className="section-heading">
            <span>資材</span>
            <strong>{state.inventory.rail} tiles</strong>
          </div>
          <div className="resource-stack">
            {(Object.keys(resourceLabels) as Array<keyof Inventory>).map((key) => (
              <div className="resource-row" key={key}>
                <span>
                  <small>{resourceLabels[key]}</small>
                  <strong>{state.inventory[key]}</strong>
                </span>
                <em>{resourceUnits[key]}</em>
              </div>
            ))}
          </div>
        </section>
      </aside>

      <aside className="right-console">
        <section className="console-section actions-section">
          <div className="section-heading">
            <span>作業盤</span>
            <strong>{state.trainCargo > 0 ? `積載 ${state.trainCargo}` : '手作業'}</strong>
          </div>
          <div className="action-group">
            <span className="action-group-title">採掘と加工</span>
            <ActionButton
              icon={<Pickaxe size={18} />}
              label="掘る"
              meta="+鉱石1"
              onClick={state.mineIron}
            />
            <ActionButton
              icon={<Factory size={18} />}
              label="精錬"
              meta="鉱石2 -> 鋼塊1"
              disabled={state.inventory.ore < 2}
              onClick={state.smeltOre}
            />
            <ActionButton
              icon={<Hammer size={18} />}
              label="鉄板"
              meta="鋼塊1 -> 2"
              disabled={state.inventory.ingot < 1}
              onClick={state.craftPlates}
            />
            <ActionButton
              icon={<Wrench size={18} />}
              label="鉄棒"
              meta="鋼塊1 -> 2"
              disabled={state.inventory.ingot < 1}
              onClick={state.craftRods}
            />
          </div>

          <div className="action-group">
            <span className="action-group-title">鉄道建設</span>
            <ActionButton
              icon={<Route size={18} />}
              label="線路キット"
              meta="鉄板2 + 鉄棒1"
              disabled={state.inventory.plate < 2 || state.inventory.rod < 1}
              onClick={state.craftRails}
            />
            <ActionButton
              icon={<Route size={18} />}
              label="敷設"
              meta={state.railMode ? '2Dマップ選択中' : '停止中'}
              active={state.railMode}
              onClick={state.toggleRailMode}
            />
          </div>

          <div className="action-group">
            <span className="action-group-title">自動化</span>
            <ActionButton
              icon={<Train size={18} />}
              label="機関車"
              meta="80cr + 鉄板6 + 鉄棒4"
              disabled={state.trainBuilt || state.money < 80 || state.inventory.plate < 6 || state.inventory.rod < 4}
              active={state.trainBuilt}
              onClick={state.buildTrain}
            />
            <ActionButton
              icon={<Factory size={18} />}
              label="ドリル"
              meta="110cr + 鉄板10 + 鉄棒8"
              disabled={state.drillBuilt || state.money < 110 || state.inventory.plate < 10 || state.inventory.rod < 8}
              active={state.drillBuilt}
              onClick={state.buildDrill}
            />
            <ActionButton
              icon={<Factory size={18} />}
              label="自動炉"
              meta="90cr + 鉄板8 + 鉄棒6"
              disabled={state.autoForgeBuilt || state.money < 90 || state.inventory.plate < 8 || state.inventory.rod < 6}
              active={state.autoForgeBuilt}
              onClick={state.buildAutoForge}
            />
          </div>
        </section>
      </aside>

      <footer className="event-strip">
        <span>LOG</span>
        <p>{state.lastEvent}</p>
        <strong>{state.railTiles.length} tiles</strong>
      </footer>
    </div>
  );
};
