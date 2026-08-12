import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';

const sourcePath = path.resolve('deliverables/OnePager.html');
const outputPath = path.resolve('deliverables/AI喵搭-OnePager-半决赛版.pdf');
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(sourcePath).href, {
    waitUntil: 'networkidle0',
    timeout: 30_000,
  });
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.emulateMediaType('print');
  await page.pdf({
    path: outputPath,
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: false,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  console.log(outputPath);
} finally {
  await browser.close();
}
