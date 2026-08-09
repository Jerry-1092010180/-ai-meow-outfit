import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer';

const targetUrl = process.argv[2] ?? 'http://127.0.0.1:5173/#/game';
const artifactDir = path.resolve('tmp/smoke');
const startedAt = Date.now();
const consoleErrors = [];
const pageErrors = [];

async function waitForText(page, text, timeout = 12_000) {
  await page.waitForFunction(
    (expected) => document.body?.innerText.includes(expected),
    { timeout },
    text,
  );
}

async function clickButton(page, label) {
  await page.waitForFunction(
    (expected) => Array.from(document.querySelectorAll('button'))
      .some((button) => button.textContent?.includes(expected)),
    { timeout: 12_000 },
    label,
  );
  await page.evaluate((expected) => {
    const button = Array.from(document.querySelectorAll('button'))
      .find((candidate) => candidate.textContent?.includes(expected));
    if (!(button instanceof HTMLButtonElement)) throw new Error(`Button not found: ${expected}`);
    button.click();
  }, label);
}

function observePage(page) {
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
}

await fs.mkdir(artifactDir, { recursive: true });
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();
  observePage(page);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });

  const loadStartedAt = Date.now();
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await waitForText(page, '今天穿什么');
  const homeLoadedMs = Date.now() - loadStartedAt;
  const quickStartVisible = await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('button'))
      .find((candidate) => candidate.textContent?.includes('30 秒看结果'));
    if (!button) return false;
    const rect = button.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  });
  if (!quickStartVisible) throw new Error('Quick demo entry is not visible in the first viewport.');
  await new Promise((resolve) => setTimeout(resolve, 500));
  await page.screenshot({ path: path.join(artifactDir, 'latest-home.png'), fullPage: false });

  const generationStartedAt = Date.now();
  await clickButton(page, '30 秒看结果');
  await waitForText(page, '你的今日动漫角色已生成');
  const resultGeneratedMs = Date.now() - generationStartedAt;
  await new Promise((resolve) => setTimeout(resolve, 500));
  await page.screenshot({ path: path.join(artifactDir, 'latest-result.png'), fullPage: false });

  await clickButton(page, '复制共创链接');
  await waitForText(page, '共创链接已复制');

  const joinPage = await browser.newPage();
  observePage(joinPage);
  await joinPage.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  const appBase = targetUrl.split('#')[0];
  const joinUrl = `${appBase}#/game?join=smoke-scene&max=4&host=item-001.item-004.item-002.item-005.item-006`;
  const joinStartedAt = Date.now();
  await joinPage.goto(joinUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await waitForText(joinPage, '好友邀请你');
  await clickButton(joinPage, '生成我的角色并加入同框');
  await waitForText(joinPage, '你已加入');
  const friendJoinedMs = Date.now() - joinStartedAt;
  await new Promise((resolve) => setTimeout(resolve, 500));
  await joinPage.screenshot({ path: path.join(artifactDir, 'latest-join.png'), fullPage: false });

  if (pageErrors.length > 0 || consoleErrors.length > 0) {
    throw new Error(`Browser errors detected: ${JSON.stringify({ pageErrors, consoleErrors })}`);
  }

  console.log(JSON.stringify({
    ok: true,
    targetUrl,
    checks: {
      homeLoadedMs,
      quickStartVisible,
      resultGeneratedMs,
      copyFeedback: '共创链接已复制',
      friendJoinedMs,
    },
    artifacts: [
      path.join(artifactDir, 'latest-home.png'),
      path.join(artifactDir, 'latest-result.png'),
      path.join(artifactDir, 'latest-join.png'),
    ],
    totalMs: Date.now() - startedAt,
  }, null, 2));
} finally {
  await browser.close();
}
