// Entry point: wire up UI, boot the scene, handle fallback + loader.

import { initUI } from './ui.js';
import { initScene } from './scene.js';
import { webglSupported } from './utils.js';

const loader = document.getElementById('loader');

function hideLoader() {
  if (!loader) return;
  loader.classList.add('is-hidden');
  setTimeout(() => loader.remove(), 700);
}

// Safety net: never leave the loader stuck.
setTimeout(() => { if (loader) hideLoader(); }, 6000);

// UI always initialises, even if WebGL is unavailable.
initUI();

if (!webglSupported()) {
  document.body.classList.add('no-webgl');
  hideLoader();
} else {
  initScene()
    .then(hideLoader)
    .catch((err) => {
      console.error('[three] init failed, falling back:', err);
      document.body.classList.add('no-webgl');
      hideLoader();
    });
}