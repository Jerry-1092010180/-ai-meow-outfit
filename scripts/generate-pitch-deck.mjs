import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';

const sourcePath = path.resolve('docs/internal/not-submitted/路演Deck.html');
const deckConfigs = [
  {
    mode: null,
    outputPath: path.resolve('deliverables/AI喵搭-路演Deck-评审版.pdf'),
    reviewDir: path.resolve('tmp/pdfs/deck-latest'),
    expectedSlides: 12,
  },
  {
    mode: 'live',
    outputPath: path.resolve('deliverables/AI喵搭-路演Deck-5分钟现场版.pdf'),
    reviewDir: path.resolve('tmp/pdfs/deck-live'),
    expectedSlides: 9,
  },
];

function sourceUrl(mode) {
  const url = new URL(pathToFileURL(sourcePath));
  if (mode) url.searchParams.set('mode', mode);
  return url.href;
}

async function waitForAssets(page) {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    await Promise.all(
      Array.from(document.images).map((image) => {
        if (image.complete) return undefined;
        return new Promise((resolve) => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        });
      }),
    );
  });

  const brokenImages = await page.evaluate(() =>
    Array.from(document.images)
      .filter((image) => image.naturalWidth === 0 || image.naturalHeight === 0)
      .map((image) => image.getAttribute('src')),
  );
  if (brokenImages.length > 0) {
    throw new Error(`Deck contains broken images: ${brokenImages.join(', ')}`);
  }
}

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const outputs = [];
  for (const config of deckConfigs) {
    await fs.rm(config.reviewDir, { recursive: true, force: true });
    await fs.mkdir(config.reviewDir, { recursive: true });

    const pdfPage = await browser.newPage();
    await pdfPage.goto(sourceUrl(config.mode), {
      waitUntil: 'networkidle0',
      timeout: 30_000,
    });
    await waitForAssets(pdfPage);
    await pdfPage.emulateMediaType('print');
    await pdfPage.pdf({
      path: config.outputPath,
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    await pdfPage.close();

    const reviewPage = await browser.newPage();
    await reviewPage.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await reviewPage.goto(sourceUrl(config.mode), {
      waitUntil: 'networkidle0',
      timeout: 30_000,
    });
    await waitForAssets(reviewPage);
    await reviewPage.emulateMediaType('screen');

    const slides = await reviewPage.$$('.slide');
    if (slides.length !== config.expectedSlides) {
      throw new Error(`Expected ${config.expectedSlides} slides, found ${slides.length}`);
    }
    for (let index = 0; index < slides.length; index += 1) {
      const fileName = `slide-${String(index + 1).padStart(2, '0')}.png`;
      await slides[index].screenshot({ path: path.join(config.reviewDir, fileName) });
    }
    await reviewPage.close();

    outputs.push({
      mode: config.mode ?? 'full',
      output: config.outputPath,
      slides: slides.length,
      reviewDir: config.reviewDir,
    });
  }

  console.log(JSON.stringify({ source: sourcePath, outputs }, null, 2));
} finally {
  await browser.close();
}
