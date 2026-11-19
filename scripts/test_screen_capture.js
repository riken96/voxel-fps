import { spawn } from 'child_process';
import http from 'http';
import { WebSocket } from 'ws';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getDebuggerUrl() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${PORT}/json`, (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
      });
      if (res && res.length > 0 && res[0].webSocketDebuggerUrl) {
        return res[0].webSocketDebuggerUrl;
      }
    } catch {
      await sleep(250);
    }
  }
  throw new Error('Failed to connect to Chrome debugger');
}

class CDPClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.callbacks = new Map();
    ws.on('message', (msg) => {
      const res = JSON.parse(msg.toString());
      if (res.id && this.callbacks.has(res.id)) {
        const { resolve, reject } = this.callbacks.get(res.id);
        this.callbacks.delete(res.id);
        if (res.error) reject(res.error);
        else resolve(res.result);
      }
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function run() {
  const chrome = spawn(
    CHROME_PATH,
    [
      `--remote-debugging-port=${PORT}`,
      '--headless=new',
      '--window-size=1280,720',
      '--no-sandbox',
      '--disable-gpu-sandbox',
      '--use-gl=angle',
      '--mute-audio',
      'about:blank'
    ],
    { stdio: 'ignore' }
  );

  try {
    const wsUrl = await getDebuggerUrl();
    const ws = new WebSocket(wsUrl);
    await new Promise((r) => ws.on('open', r));
    const cdp = new CDPClient(ws);

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    console.log('Navigating to http://localhost:8080...');
    await cdp.send('Page.navigate', { url: 'http://localhost:8080' });
    await sleep(2000);

    // 1. Test typing callsign and pressing Enter
    console.log('Typing callsign "Shadow_Sniper" and pressing Enter...');
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const input = document.getElementById('pilot-name-input');
          if (input) {
            input.value = 'Shadow_Sniper';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
          }
        })()
      `
    });

    await sleep(1500);

    // 2. Check if deployed
    const deployState = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const overlay = document.getElementById('instructions-overlay');
          const isEngine = !!window.__engine;
          const ammoBefore = isEngine ? window.__engine.ammoInMag : null;
          return {
            overlayDisplay: overlay ? overlay.style.display : null,
            overlayOpacity: overlay ? window.getComputedStyle(overlay).opacity : null,
            overlayPointerEvents: overlay ? window.getComputedStyle(overlay).pointerEvents : null,
            ammoBefore,
            callsignSaved: localStorage.getItem('voxel_pilot_callsign')
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Deploy state after pressing Enter:', deployState.result.value);

    // 3. Test shooting with Left Mouse Button (even without native pointer lock)
    console.log('Simulating mouse click to fire weapon...');
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          if (window.__engine) {
            // Simulate mouse down on canvas
            window.__engine.inputManager.mouseButtons[0] = true;
          }
        })()
      `
    });
    await sleep(100);
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          if (window.__engine) {
            window.__engine.inputManager.mouseButtons[0] = false;
          }
        })()
      `
    });
    await sleep(400);

    const shootState = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          return {
            ammoAfter: window.__engine ? window.__engine.ammoInMag : null,
            isReloading: window.__engine ? window.__engine.weaponRenderer.isReloading : null
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Shoot state after left-click:', shootState.result.value);

    // Capture in-game combat viewmodel screenshot
    const combatShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scripts/combat_viewmodel_ready.png', Buffer.from(combatShot.data, 'base64'));
    console.log('Saved scripts/combat_viewmodel_ready.png');

    // 4. Test pressing 'B' to switch to Builder Mode
    console.log('Pressing B to switch to Builder mode...');
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB', key: 'b' }));
        })()
      `
    });
    await sleep(500);

    // Capture Builder mode viewmodel screenshot
    const builderShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scripts/builder_viewmodel_ready.png', Buffer.from(builderShot.data, 'base64'));
    console.log('Saved scripts/builder_viewmodel_ready.png');

    // 5. Test pressing 'Alt' to verify overlay NEVER pops back up!
    console.log('Pressing Alt to test cursor unlock safety...');
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'AltLeft', key: 'Alt' }));
        })()
      `
    });
    await sleep(400);

    const altState = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const overlay = document.getElementById('instructions-overlay');
          return {
            overlayDisplay: overlay ? overlay.style.display : null,
            overlayOpacity: overlay ? window.getComputedStyle(overlay).opacity : null,
            overlayPointerEvents: overlay ? window.getComputedStyle(overlay).pointerEvents : null
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Overlay state after pressing Alt:', altState.result.value);

    ws.close();
  } finally {
    chrome.kill();
  }
}

run().catch(console.error);
