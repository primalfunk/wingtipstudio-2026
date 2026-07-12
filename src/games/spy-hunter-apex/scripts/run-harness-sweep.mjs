import { execFile, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const PROJECT_PORT = Number(process.env.PORT ?? 5180);
const REPORT_PORT = Number(process.env.REPORT_PORT ?? 9410);
const RUNS = Number(process.env.RUNS ?? 8);
const SECONDS = Number(process.env.SECONDS ?? 90);
const MISSION = process.env.MISSION ?? '1-1';
const DIFFICULTIES = (process.env.DIFFICULTIES ?? 'easy,medium,hard')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const HEADLESS = process.env.HEADLESS !== '0';
const SLOW_MO = Number(process.env.SLOW_MO ?? 0);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHttp(url, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Server is still starting.
    }
    await wait(300);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function startServer() {
  const child = spawn(`npx vite --host 127.0.0.1 --port ${PROJECT_PORT} --strictPort`, {
    cwd: process.cwd(),
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => process.stdout.write(`[vite] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[vite] ${chunk}`));
  return child;
}

async function stopServer(child) {
  if (!child || child.killed) {
    return;
  }

  if (process.platform === 'win32' && child.pid) {
    await new Promise((resolve) => {
      execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => resolve());
    });
    return;
  }

  child.kill();
}

function startReportServer() {
  const runsByDifficulty = new Map(DIFFICULTIES.map((difficulty) => [difficulty, []]));
  const eventsByDifficulty = new Map(DIFFICULTIES.map((difficulty) => [difficulty, []]));
  const server = createServer((request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method !== 'POST' || request.url === null || !request.url.startsWith('/report')) {
      response.writeHead(404);
      response.end();
      return;
    }

    const url = new URL(request.url, `http://127.0.0.1:${REPORT_PORT}`);
    const difficulty = url.searchParams.get('difficulty') ?? 'unknown';
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      try {
        const summary = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (summary.reason) {
          if (!runsByDifficulty.has(difficulty)) {
            runsByDifficulty.set(difficulty, []);
          }
          runsByDifficulty.get(difficulty).push(summary);
          console.log(`[HarnessSweep] received ${difficulty} run ${runsByDifficulty.get(difficulty).length}/${RUNS}`);
        } else {
          if (!eventsByDifficulty.has(difficulty)) {
            eventsByDifficulty.set(difficulty, []);
          }
          eventsByDifficulty.get(difficulty).push(summary);
          console.log(`[HarnessEvent:${difficulty}] ${summary.event ?? 'event'} ${summary.message ?? ''}`);
          if (summary.stack) {
            console.log(summary.stack);
          }
        }
        response.writeHead(204);
      } catch (error) {
        response.writeHead(400);
        response.write(String(error));
      }
      response.end();
    });
  });

  return new Promise((resolve) => {
    server.listen(REPORT_PORT, '127.0.0.1', () => resolve({ server, runsByDifficulty, eventsByDifficulty }));
  });
}

async function waitForRuns(runsByDifficulty, difficulty) {
  const started = Date.now();
  const timeoutMs = Math.max(45000, RUNS * SECONDS * 1400);
  while ((runsByDifficulty.get(difficulty)?.length ?? 0) < RUNS && Date.now() - started < timeoutMs) {
    await wait(500);
  }
  const runs = runsByDifficulty.get(difficulty) ?? [];
  if (runs.length < RUNS) {
    throw new Error(`Expected ${RUNS} runs for ${difficulty}, captured ${runs.length}`);
  }
  return runs;
}

async function runDifficulty(browser, reportServer, difficulty) {
  const page = await browser.newPage({
    viewport: { width: 480, height: 720 },
    deviceScaleFactor: 1,
  });
  page.setDefaultTimeout(15000);
  page.on('console', (message) => {
    if (message.type() === 'error' || message.text().includes('[AI Harness]')) {
      console.log(`[console:${difficulty}:${message.type()}] ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    console.error(`[pageerror:${difficulty}] ${error.stack ?? error.message}`);
  });

  const reportUrl = `http://127.0.0.1:${REPORT_PORT}/report?difficulty=${difficulty}`;
  const url = `http://127.0.0.1:${PROJECT_PORT}/?harness=1&runs=${RUNS}&seconds=${SECONDS}&missionId=${MISSION}&difficulty=${difficulty}&reportUrl=${encodeURIComponent(reportUrl)}`;
  console.log(`\n[HarnessSweep] Running ${difficulty} (${RUNS} runs, ${SECONDS}s, mission ${MISSION})`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const runs = await waitForRuns(reportServer.runsByDifficulty, difficulty);
  await page.close();
  return runs;
}

function summarize(difficulty, runs) {
  const sum = (key) => runs.reduce((total, run) => total + Number(run[key] ?? 0), 0);
  const avg = (key) => sum(key) / runs.length;
  return {
    difficulty,
    runs: runs.length,
    survived: runs.filter((run) => run.reason === 'timeout' || run.reason === 'missionComplete').length,
    destroyed: runs.filter((run) => run.reason === 'destroyed').length,
    avgElapsed: Number(avg('elapsedTime').toFixed(1)),
    avgDistance: Number(avg('distance').toFixed(1)),
    avgDamage: Number(avg('damage').toFixed(2)),
    avgLivesRemaining: Number(avg('livesRemaining').toFixed(2)),
    avgLifeLosses: Number(avg('lifeLosses').toFixed(2)),
    avgFallbacks: Number(avg('vehicleFallbacks').toFixed(2)),
    avgUpgrades: Number(avg('upgrades').toFixed(2)),
    avgCollisions: Number(avg('collisions').toFixed(2)),
    avgEnemiesDestroyed: Number(avg('enemiesDestroyed').toFixed(2)),
    lastDamageSources: [...new Set(runs.map((run) => run.lastDamageSource).filter(Boolean))].join(', '),
  };
}

const server = startServer();
const reportServer = await startReportServer();
let browser = null;
let exitCode = 0;

try {
  await waitForHttp(`http://127.0.0.1:${PROJECT_PORT}/`, 30000);
  browser = await chromium.launch({
    headless: HEADLESS,
    slowMo: SLOW_MO,
    args: [
      '--mute-audio',
      '--disable-gpu-sandbox',
      '--disable-dev-shm-usage',
      '--use-angle=swiftshader',
      '--use-gl=angle',
      '--enable-unsafe-swiftshader',
    ],
  });

  const all = {};
  for (const difficulty of DIFFICULTIES) {
    all[difficulty] = await runDifficulty(browser, reportServer, difficulty);
    console.table(all[difficulty]);
    console.log('[HarnessSweep] Summary');
    console.table([summarize(difficulty, all[difficulty])]);
  }

  console.log('\n[HarnessSweep] Combined summary');
  console.table(DIFFICULTIES.map((difficulty) => summarize(difficulty, all[difficulty])));
} catch (error) {
  exitCode = 1;
  console.error(error);
} finally {
  await browser?.close();
  reportServer.server.closeAllConnections?.();
  await Promise.race([
    new Promise((resolve) => reportServer.server.close(resolve)),
    wait(1500),
  ]);
  await stopServer(server);
  process.exit(exitCode);
}
