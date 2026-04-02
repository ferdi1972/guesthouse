import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary';

console.log('Main.tsx: Starting app...');

const rootElement = document.getElementById('root');
console.log('Main.tsx: Root element found:', !!rootElement);
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
} else {
  console.error('Main.tsx: Root element NOT found');
}
