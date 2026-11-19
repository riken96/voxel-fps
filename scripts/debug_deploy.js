import { spawn } from 'child_process';
import http from 'http';
import { WebSocket } from 'ws';

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
    await cdp.send('Console.enable');

    const logs = [];
    ws.on('message', (msg) => {
      const data = JSON.parse(msg.toString());
      if (data.method === 'Console.messageAdded') {
        logs.push(data.params.message);
      }
      if (data.method === 'Runtime.exceptionThrown') {
        logs.push({ text: 'EXCEPTION: ' + JSON.stringify(data.params.exceptionDetails) });
      }
    });

    console.log('Navigating to http://localhost:8080...');
    await cdp.send('Page.navigate', { url: 'http://localhost:8080' });
    await sleep(2000);

    // Check overlay state before click
    const stateBefore = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const overlay = document.getElementById('instructions-overlay');
          const btn = document.getElementById('deploy-btn');
          const input = document.getElementById('pilot-name-input');
          return {
            hasEngine: !!window.__engine,
            overlayDisplay: overlay ? overlay.style.display : null,
            overlayClass: overlay ? overlay.className : null,
            btnExists: !!btn,
            inputValue: input ? input.value : null
          };
        })()
      `,
      returnByValue: true
    });
    console.log('State BEFORE click:', stateBefore.result.value);

    // Simulate clicking deploy button
    console.log('Clicking Deploy button...');
    const clickResult = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.getElementById('deploy-btn');
          if (btn) {
            btn.click();
            return 'clicked';
          }
          return 'btn not found';
        })()
      `,
      returnByValue: true
    });
    console.log('Click result:', clickResult.result.value);
    await sleep(1000);

    const stateAfter = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const overlay = document.getElementById('instructions-overlay');
          return {
            overlayDisplay: overlay ? overlay.style.display : null,
            overlayClass: overlay ? overlay.className : null,
            isLocked: window.__engine ? window.__engine.inputManager.isLocked : null,
            playMode: window.__engine ? window.__engine.playMode : null
          };
        })()
      `,
      returnByValue: true
    });
    console.log('State AFTER click:', stateAfter.result.value);
    console.log('Console logs caught:', logs.length);
    for (const l of logs) {
      console.log(' - LOG:', l.text || l);
    }

    ws.close();
  } finally {
    chrome.kill();
  }
}

run().catch(console.error);
