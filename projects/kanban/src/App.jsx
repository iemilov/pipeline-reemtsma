import Board from './components/Board';
import cloudriseLogo from './assets/Cloudrise_Logo320px.svg';

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <img src={cloudriseLogo} alt="CloudRise" className="app-header-logo" />
        <h1>Kanban</h1>
        <span>Task Board</span>
      </header>
      <Board />
    </div>
  );
}
