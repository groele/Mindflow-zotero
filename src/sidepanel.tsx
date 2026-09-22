import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './pages/app/App';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App isSidepanelMode={true} />
  </React.StrictMode>
);
