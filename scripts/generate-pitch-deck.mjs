import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';

const sourcePath = path.resolve('docs/internal/not-submitted/路演Deck.html');
const outputPath = path.resolve('deliverables/AI喵搭-路演Deck-评审版.pdf');
const reviewDir = path.resolve('tmp/pdfs/deck-latest');

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
  await fs.rm(reviewDir, { recursive: true, force: true });
  await fs.mkdir(reviewDir, { recursive: true });

  const pdfPage = await browser.newPage();
  await pdfPage.goto(pathToFileURL(sourcePath).href, {
    waitUntil: 'networkidle0',
    timeout: 30_000,
  });
  await waitForAssets(pdfPage);
  await pdfPage.emulateMediaType('print');
  await pdfPage.pdf({
    path: outputPath,
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: false,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  await pdfPage.close();

  const reviewPage = await browser.newPage();
  await reviewPage.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await reviewPage.goto(pathToFileURL(sourcePath).href, {
    waitUntil: 'networkidle0',
    timeout: 30_000,
  });
  await waitForAssets(reviewPage);
  await reviewPage.emulateMediaType('screen');

  const slides = await reviewPage.$$('.slide');
  if (slides.length !== 12) {
    throw new Error(`Expected 12 slides, found ${slides.length}`);
  }
  for (let index = 0; index < slides.length; index += 1) {
    const fileName = `slide-${String(index + 1).padStart(2, '0')}.png`;
    await slides[index].screenshot({ path: path.join(reviewDir, fileName) });
  }
  await reviewPage.close();

  console.log(
    JSON.stringify(
      {
        source: sourcePath,
        output: outputPath,
        slides: slides.length,
        reviewDir,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
