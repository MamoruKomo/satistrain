import { GameUI } from './components/GameUI';
import { SatisTrainMap2D } from './scene/SatisTrainMap2D';

export const App = () => (
  <main className="app">
    <SatisTrainMap2D />
    <GameUI />
  </main>
);
