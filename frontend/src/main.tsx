import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import App from './App.tsx';

// Add animated background orbs
const addBackgroundOrbs = () => {
  const orbs = [
    { class: 'orb-1' },
    { class: 'orb-2' },
    { class: 'orb-3' },
  ];

  const existingOrbs = document.querySelectorAll('.bg-orb');
  if (existingOrbs.length === 0) {
    orbs.forEach(orb => {
      const div = document.createElement('div');
      div.className = `bg-orb ${orb.class}`;
      document.body.appendChild(div);
    });
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

addBackgroundOrbs();
