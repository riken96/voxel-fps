import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocket } from 'ws';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;
const ARTIFACT_DIR = 'C:\\Users\\Abhay\\.gemini\\antigravity\\brain\\21f8b19c-95e3-4ecd-b09a-4acb5917869e';

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
  console.log('Launching headless Chrome...');
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
    console.log('Connected to Chrome:', wsUrl);
    const ws = new WebSocket(wsUrl);
    await new Promise((r) => ws.on('open', r));
    const cdp = new CDPClient(ws);

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    console.log('Navigating to http://localhost:8080...');
    await cdp.send('Page.navigate', { url: 'http://localhost:8080' });
    await sleep(2500);

    // Click Settings button
    console.log('Opening Settings Modal...');
    await cdp.send('Runtime.evaluate', {
      expression: `
        const settingsBtn = document.getElementById('main-settings-btn');
        if (settingsBtn) settingsBtn.click();
      `
    });
    await sleep(800);

    console.log('Capturing Settings & Performance UI screenshot...');
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'settings_performance_ui.png'), Buffer.from(shot.data, 'base64'));

    console.log('Screenshot saved successfully!');
    ws.close();
  } finally {
    chrome.kill();
  }
}

run().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
