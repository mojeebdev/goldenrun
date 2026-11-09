import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { isBirthdayHost } from '../shared/birthday';
import { App, BirthdayApp } from './App';
import { AccountProvider } from './lib/account';
import './styles.css';

const root = createRoot(document.getElementById('root')!);

if (isBirthdayHost(window.location.hostname)) {
  // birthday.goldenrun.fun is read-only: no account bootstrap, no game until "Play".
  root.render(
    <StrictMode>
      <BrowserRouter>
        <BirthdayApp />
      </BrowserRouter>
    </StrictMode>,
  );
} else {
  root.render(
    <StrictMode>
      <BrowserRouter>
        <AccountProvider>
          <App />
        </AccountProvider>
      </BrowserRouter>
    </StrictMode>,
  );
}
