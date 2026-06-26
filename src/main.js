// main.js — bootstraps the app: loads data, applies theme, builds services,
// starts Phaser, wires the on-screen touch controls, registers the service
// worker. No game content here.

import { DataLoader } from './engine/DataLoader.js';
import { EventModel } from './engine/EventModel.js';
import { Storage } from './engine/Storage.js';
import { Theme } from './engine/Theme.js';
import { UI } from './ui/UI.js';
import { BootScene } from './scenes/BootScene.js';
import { OverworldScene } from './scenes/OverworldScene.js';
import { InteriorScene } from './scenes/InteriorScene.js';

async function main() {
  const loading = document.getElementById('loading');
  let data;
  try {
    data = await DataLoader.loadAll();
  } catch (err) {
    loading.innerHTML = '<div class="load-err">Failed to load data.<br><small>' + err.message + '</small></div>';
    return;
  }

  // Theme: stored override > config default
  const theme = new Theme(data.config);
  const savedTheme = Storage.getSetting('theme', data.config.theme);
  theme.apply(theme.names().indexOf(savedTheme) >= 0 ? savedTheme : data.config.theme);

  document.title = data.config.appName || 'Core Seven';

  const model = new EventModel(data.events);
  const ui = new UI({ data, model, storage: Storage, theme });

  // Phaser game
  const map = data.map;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: theme.hex('bgDeep'),
    pixelArt: false,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: '100%',
      height: '100%'
    },
    physics: { default: 'arcade', arcade: { debug: false } },
    scene: [BootScene, OverworldScene, InteriorScene]
  });

  game.registry.set('data', data);
  game.registry.set('theme', theme);
  game.registry.set('model', model);
  game.registry.set('storage', Storage);
  game.registry.set('ui', ui);

  // hide loading once Boot starts Overworld
  ui.onOverworldReady = () => { if (loading) loading.style.display = 'none'; };

  wireControls(game);
  registerSW();

  // Lightweight support/debug handle (no gameplay effect). Useful for QA and
  // for instructors inspecting state from the console.
  window.CoreSeven = { game, ui, model, storage: Storage, theme };
}

// The currently controllable scene (Overworld or an Interior).
function active(game) { return game.registry.get('activeScene'); }

function wireControls(game) {
  const dpad = document.getElementById('dpad');
  if (dpad) {
    dpad.querySelectorAll('[data-dir]').forEach(btn => {
      const dir = btn.getAttribute('data-dir');
      const press = (e) => { e.preventDefault(); const o = active(game); if (o && o.setDir) o.setDir(dir); btn.classList.add('active'); };
      const release = (e) => { e.preventDefault(); const o = active(game); if (o && o.clearDir) o.clearDir(dir); btn.classList.remove('active'); };
      btn.addEventListener('touchstart', press, { passive: false });
      btn.addEventListener('touchend', release, { passive: false });
      btn.addEventListener('touchcancel', release, { passive: false });
      btn.addEventListener('mousedown', press);
      btn.addEventListener('mouseup', release);
      btn.addEventListener('mouseleave', release);
    });
  }
  const actionBtn = document.getElementById('btn-action');
  if (actionBtn) {
    const fire = (e) => { e.preventDefault(); const o = active(game); if (o && o.action) o.action(); };
    actionBtn.addEventListener('touchstart', fire, { passive: false });
    actionBtn.addEventListener('click', fire);
  }
  const menuBtn = document.getElementById('btn-menu');
  if (menuBtn) {
    const fire = (e) => { e.preventDefault(); const ui = game.registry.get('ui'); if (ui && !ui.isModalOpen()) ui.openHub(); };
    menuBtn.addEventListener('touchstart', fire, { passive: false });
    menuBtn.addEventListener('click', fire);
  }
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => { /* offline-first best effort */ });
    });
  }
}

main();
