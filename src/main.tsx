import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './designsystem';
import { App } from './appshell';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
