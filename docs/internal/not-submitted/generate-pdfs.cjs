const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
let puppeteer;
let chromium;
try {
  puppeteer = require('puppeteer');
} catch {
  ({ chromium } = require('playwright'));
}

const ROOT = path.resolve(__dirname, '..');
const DELIVERABLES = path.join(ROOT, 'deliverables');
const BUILD_DIR = path.join(ROOT, 'tmp', 'pitch-build');
const SLIDE_DIR = path.join(BUILD_DIR, 'deck-slides');

async function openLocal(page, htmlPath) {
  await page.goto(pathToFileURL(htmlPath).href, {
    waitUntil: 'networkidle0',
    timeout: 30000,
  });
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
}

async function createRenderer() {
  if (puppeteer) {
    const browser = await puppeteer.launch({ headless: true });
    return {
      engine: 'puppeteer',
      newPage: () => browser.newPage(),
      close: () => browser.close(),
    };
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  return {
    engine: 'playwright',
    newPage: () => context.newPage(),
    close: async () => {
      await context.close();
      await browser.close();
    },
  };
}

async function setMedia(page, engine, media) {
  if (engine === 'puppeteer') {
    await page.emulateMediaType(media);
  } else {
    await page.emulateMedia({ media });
  }
}

async function setViewport(page, engine, viewport) {
  if (engine === 'puppeteer') {
    await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
  } else {
    await page.setViewportSize(viewport);
  }
}

async function exportPdf(renderer, htmlName, pdfName) {
  const page = await renderer.newPage();
  await openLocal(page, path.join(DELIVERABLES, htmlName));
  await setMedia(page, renderer.engine, 'print');
  await page.pdf({
    path: path.join(DELIVERABLES, pdfName),
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: false,
    margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
  });
  await page.close();
  console.log(`PDF generated: deliverables/${pdfName}`);
}

async function exportReviewImages(renderer) {
  await fs.rm(BUILD_DIR, { recursive: true, force: true });
  await fs.mkdir(SLIDE_DIR, { recursive: true });

  const deckPage = await renderer.newPage();
  await setViewport(deckPage, renderer.engine, { width: 1920, height: 1080 });
  await openLocal(deckPage, path.join(DELIVERABLES, '路演Deck.html'));
  await setMedia(deckPage, renderer.engine, 'screen');
  const slides = await deckPage.$$('.slide');
  for (let i = 0; i < slides.length; i += 1) {
    const output = path.join(SLIDE_DIR, `slide-${String(i + 1).padStart(2, '0')}.png`);
    await slides[i].screenshot({ path: output });
  }
  await deckPage.close();

  const onePagerPage = await renderer.newPage();
  await setViewport(onePagerPage, renderer.engine, { width: 1240, height: 1754 });
  await openLocal(onePagerPage, path.join(DELIVERABLES, 'OnePager.html'));
  await setMedia(onePagerPage, renderer.engine, 'screen');
  await onePagerPage.screenshot({
    path: path.join(BUILD_DIR, 'onepager.png'),
    clip: { x: 0, y: 0, width: 794, height: 1123 },
  });
  await onePagerPage.close();

  console.log(`Review images generated: ${path.relative(ROOT, BUILD_DIR)}`);
}

async function main() {
  const renderer = await createRenderer();
  try {
    await exportPdf(renderer, 'OnePager.html', 'AI喵搭-OnePager-评审版.pdf');
    await exportPdf(renderer, '路演Deck.html', 'AI喵搭-路演Deck-评审版.pdf');
    await exportPdf(renderer, 'AIGC技术可行性.html', 'AI喵搭-AIGC技术可行性.pdf');
    await exportReviewImages(renderer);
  } finally {
    await renderer.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
