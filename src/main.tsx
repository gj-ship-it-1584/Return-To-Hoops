import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/inter/wght.css';
import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import './index.css';
import App from './App';
import { ensureSettings, getMeta, setMeta } from './lib/store';
import { applySetupHash } from './lib/backup';
import { connect, readJoinHash, start } from './lib/sync';

async function boot() {
  await ensureSettings();
  if (!(await getMeta('firstLaunch'))) {
    await setMeta('firstLaunch', Date.now());
    try {
      await navigator.storage?.persist?.();
    } catch {
      /* not supported */
    }
  }
  const hash = location.hash;
  if (!hash.startsWith('#/')) {
    const join = readJoinHash(hash);
    if (join) await connect(join);
    await applySetupHash(hash);
  }
  void start();
}

registerSW({ immediate: true });
void boot().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
