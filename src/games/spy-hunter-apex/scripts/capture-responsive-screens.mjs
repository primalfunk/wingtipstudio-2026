import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const VIEWPORTS = [
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1366, 768],
  [1920, 1080],
];

const SCENES = [
  {
    name: 'title',
    url: '/',
    waitMs: 1400,
  },
  {
    name: 'world-map',
    url: '/',
    waitMs: 700,
    action: async (page) => {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(900);
    },
  },
  {
    name: 'briefing',
    url: '/',
    waitMs: 700,
    action: async (page) => {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(700);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(700);
    },
  },
  {
    name: 'gameplay',
    url: '/',
    waitMs: 1700,
    action: async (page) => {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(600);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1800);
    },
  },
  {
    name: 'divided-highway',
    url: '/?visualScenario=divided&missionId=1-5',
    waitMs: 1800,
  },
  {
    name: 'tunnel',
    url: '/?visualScenario=tunnel&missionId=1-8',
    waitMs: 1800,
  },
  {
    name: 'bridge',
    url: '/?visualScenario=bridge&missionId=1-1',
    waitMs: 1800,
  },
  {
    name: 'construction-merge',
    url: '/?visualScenario=construction&missionId=1-4',
    waitMs: 1800,
  },
  {
    name: 'finish-line',
    url: '/?visualScenario=finish&missionId=1-9',
    waitMs: 1200,
  },
  {
    name: 'support-repair',
    url: '/?visualScenario=support-repair&missionId=1-3',
    waitMs: 1300,
  },
  {
    name: 'support-ammo',
    url: '/?visualScenario=support-ammo&missionId=1-3',
    waitMs: 1300,
  },
  {
    name: 'support-upgrade',
    url: '/?visualScenario=support-upgrade&missionId=1-3',
    waitMs: 1300,
  },
  {
    name: 'debrief',
    url: '/?visualScenario=debrief&missionId=1-5',
    waitMs: 900,
  },
  {
    name: 'transmission',
    url: '/?visualScenario=transmission&transmissionId=world-1-after-1-5',
    waitMs: 1200,
  },
];

const baseUrl = process.env.RESPONSIVE_BASE_URL ?? 'http://127.0.0.1:5173/';
const outputDir = path.resolve('docs/responsive-screens');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const failures = [];

for (const [width, height] of VIEWPORTS) {
  for (const scene of SCENES) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });

    await page.goto(new URL(scene.url, baseUrl).toString(), { waitUntil: 'networkidle' });
    if (scene.action) {
      await scene.action(page);
    }
    await page.waitForTimeout(scene.waitMs);

    const canvasBox = await page.locator('canvas').boundingBox();
    if (!canvasBox || Math.round(canvasBox.width) !== width || Math.round(canvasBox.height) !== height) {
      failures.push(`${scene.name} ${width}x${height}: canvas ${JSON.stringify(canvasBox)}`);
    }
    if (errors.length > 0) {
      failures.push(`${scene.name} ${width}x${height}: ${errors.join(' | ')}`);
    }

    await page.screenshot({
      path: path.join(outputDir, `${scene.name}-${width}x${height}.png`),
      fullPage: true,
    });
    await page.close();
  }
}

await browser.close();

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Captured ${VIEWPORTS.length * SCENES.length} responsive screenshots in ${outputDir}`);
