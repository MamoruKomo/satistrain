import { GameUI } from './components/GameUI';
import { SatisTrainScene } from './scene/SatisTrainScene';

export const App = () => (
  <main className="app">
    <SatisTrainScene />
    <GameUI />
  </main>
);
