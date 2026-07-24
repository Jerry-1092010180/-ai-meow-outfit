const puppeteer = require('puppeteer');

async function generatePDF(htmlPath, pdfPath, options = {}) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const htmlFile = require('path').resolve(htmlPath);
  await page.goto('file://' + htmlFile, { waitUntil: 'networkidle0', timeout: 30000 });

  await page.pdf({
    path: pdfPath,
    format: options.format || 'A4',
    landscape: options.landscape || false,
    printBackground: true,
    margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
    preferCSSPageSize: true,
  });

  await browser.close();
  console.log('PDF generated: ' + pdfPath);
}

async function main() {
  const base = '/Users/jerry/PycharmProjects/ai-meow-outfit/deliverables';

  // OnePager - A4 portrait
  await generatePDF(`${base}/OnePager.html`, `${base}/OnePager.pdf`);

  // Deck - landscape (custom page size for 16:9 slides)
  await generatePDF(`${base}/路演Deck.html`, `${base}/路演Deck.pdf`, {
    format: 'A4',
    landscape: true,
  });
}

main().catch(console.error);
