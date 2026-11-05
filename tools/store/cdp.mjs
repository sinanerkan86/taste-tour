// A headless Edge driven over the Chrome DevTools Protocol, for the store graphics scripts.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9333;

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function launchEdge() {
  const profile = mkdtempSync(join(tmpdir(), 'taste-tour-edge-'));
  const edge = spawn(EDGE, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--mute-audio',
    '--hide-scrollbars',
    'about:blank',
  ]);

  let socketUrl = null;
  for (let i = 0; i < 50 && !socketUrl; i++) {
    try {
      const pages = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      socketUrl = pages.find((p) => p.type === 'page')?.webSocketDebuggerUrl ?? null;
    } catch {
      // Edge is still starting.
    }
    if (!socketUrl) await sleep(200);
  }
  if (!socketUrl) throw new Error('Edge did not start');

  const ws = new WebSocket(socketUrl);
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });

  const send = (method, params = {}) => {
    const id = nextId++;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  };
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? 'evaluate failed');
    return result.result.value;
  };
  // Runs code for its effect only (its value may be a huge object that cannot be returned).
  const run = (code) => evaluate(`${code};0`);
  const waitFor = async (expression, timeoutMs = 20000) => {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      if (await evaluate(`(() => { try { return !!(${expression}); } catch { return false; } })()`)) return;
      await sleep(200);
    }
    throw new Error(`Timed out waiting for ${expression}`);
  };
  const navigate = async (url) => {
    await send('Page.navigate', { url });
    await waitFor('document.readyState === "complete"');
  };
  const screenshot = async () => Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64');
  const close = async () => {
    ws.close();
    edge.kill();
    await sleep(500);
    rmSync(profile, { recursive: true, force: true });
  };

  await send('Page.enable');
  await send('Runtime.enable');
  return { send, evaluate, run, waitFor, navigate, screenshot, close };
}
