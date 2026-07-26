import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/base.css';
import './styles/game.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Hold the splash long enough to be seen, then hand over to the board.
const splash = document.getElementById('splash');
if (splash) {
  const shown = performance.now();
  const dismiss = () => {
    splash.classList.add('is-gone');
    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
  };
  requestAnimationFrame(() => setTimeout(dismiss, Math.max(0, 420 - (performance.now() - shown))));
}
