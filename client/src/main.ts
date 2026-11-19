import { Engine } from './core/Engine.ts';

const init = () => {
  const container = document.getElementById('game-container');
  const overlay = document.getElementById('instructions-overlay');
  const paletteSlots = document.querySelectorAll<HTMLElement>('.palette-slot');

  if (!container || !overlay) {
    console.error('Failed to locate game DOM root elements.');
    return;
  }

  // Initialize Core Game Engine
  let engine: Engine;
  try {
    engine = new Engine(container);
    (window as any).__engine = engine;
  } catch (err) {
    console.error('[Engine] Fatal error initializing engine:', err);
    return;
  }

  // Pilot Callsign Setup & Persistence
  const nameInput = document.getElementById('pilot-name-input') as HTMLInputElement | null;
  const settingsBtn = document.getElementById('main-settings-btn') as HTMLButtonElement | null;
  const deployBtn = document.getElementById('deploy-btn') as HTMLElement | null;

  if (nameInput) {
    const savedName = localStorage.getItem('voxel_pilot_callsign');
    const defaultName = savedName || `Viper_${Math.floor(Math.random() * 900 + 100)}`;
    nameInput.value = defaultName;

    nameInput.addEventListener('click', (e) => e.stopPropagation());
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        startPlay();
      } else {
        e.stopPropagation();
      }
    });
    nameInput.addEventListener('input', () => {
      const val = nameInput.value.trim();
      if (val) {
        localStorage.setItem('voxel_pilot_callsign', val);
      }
    });
  }

  if (settingsBtn) {
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      engine.settingsModal.setVisible(true);
    });
  }

  let hasStarted = false;

  const startPlay = () => {
    if (hasStarted) return;
    hasStarted = true;

    // Permanently hide and disable start overlay
    overlay.classList.add('hidden');
    overlay.style.display = 'none';
    overlay.style.pointerEvents = 'none';

    // Broadcast pilot callsign to server
    const pilotName = (nameInput ? nameInput.value.trim() : '') || 'Viper';
    try {
      localStorage.setItem('voxel_pilot_callsign', pilotName);
      engine.networkManager.sendJoin(pilotName);
    } catch {}

    // Request pointer lock for FPS camera
    engine.inputManager.requestLock();
  };

  // Ensure overlay never resurrects once deployed
  engine.inputManager.addLockListener((isLocked) => {
    if (hasStarted) {
      overlay.classList.add('hidden');
      overlay.style.display = 'none';
      overlay.style.pointerEvents = 'none';
    }
  });

  if (deployBtn) {
    deployBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      startPlay();
    });
  }

  overlay.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.id === 'pilot-name-input' || target.id === 'main-settings-btn') return;
    startPlay();
  });

  // Palette Slot Highlight Sync
  window.addEventListener('keydown', (e) => {
    const num = parseInt(e.key);
    if (num >= 1 && num <= 9) {
      paletteSlots.forEach((slot) => {
        if (slot.dataset.slot === e.key) {
          slot.classList.add('active');
        } else {
          slot.classList.remove('active');
        }
      });
    }
  });
};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
