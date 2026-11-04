// Builds the Tuareg 660 manual from ../src/manual.src.html:
// 2 editions (travel, home) x 3 layouts (A5 booklet, phone, A4 sheets), each as standalone HTML + PDF.
// Elements with data-ed="home" appear only in the home edition, data-ed="travel" only in the travel edition.
const fs = require('fs'), path = require('path'), puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src/manual.src.html'), 'utf8');

const browsers = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'];
const exe = process.env.CHROME || browsers.find(p => fs.existsSync(p));
if (!exe) throw new Error('No Chromium-based browser found; set CHROME=/path/to/browser');

const editions = [{ id: 'travel', name: 'Travel' }, { id: 'home', name: 'Home' }];
const layouts = [
  { id: 'A5-booklet', cls: 't-a', name: 'A5 booklet', page: '@page{size:A5;margin:9mm 8.5mm 11mm 8.5mm}', pad: '8.5mm', fs: '6.5pt' },
  { id: 'phone', cls: 't-b', name: 'phone', page: '@page{size:90mm 160mm;margin:5.5mm 5mm 8mm 5mm}', pad: '5mm', fs: '5.5pt' },
  { id: 'A4-sheets', cls: 't-c', name: 'A4 sheets', page: '@page{size:A4;margin:10mm 10mm 12mm 10mm}', pad: '10mm', fs: '7pt' },
];

(async () => {
  const browser = await puppeteer.launch({ executablePath: exe, headless: true });
  for (const ed of editions) {
    const outDir = path.join(root, 'out', ed.id); fs.mkdirSync(outDir, { recursive: true });
    for (const v of layouts) {
      const label = `${ed.name} edition · ${v.name}`;
      const tmp = path.join(outDir, `.tmp-${v.id}.html`);
      fs.writeFileSync(tmp, src.replace('<html lang="en" class="t-a">', `<html lang="en" class="${v.cls}">`).replace('/*@PAGE@*/', v.page));
      const page = await browser.newPage();
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
      await page.goto('file://' + tmp, { waitUntil: 'load' });
      await page.evaluate((edition, label) => {
        document.querySelectorAll('[data-ed]').forEach(el => { if (el.dataset.ed !== edition) el.remove(); else el.removeAttribute('data-ed'); });
        document.title = 'Tuareg 660 · ' + label;
        document.querySelector('.edition-name').textContent = label;
        const toc = document.getElementById('toc');
        document.querySelectorAll('section.chap').forEach(ch => {
          const li = document.createElement('li'), a = document.createElement('a');
          a.href = '#' + ch.id; a.textContent = ch.querySelector('h2').textContent; li.appendChild(a); toc.appendChild(li);
        });
      }, ed.id, label);
      const base = path.join(outDir, `tuareg660-${ed.id}-${v.id}`);
      fs.writeFileSync(base + '.html', '<!doctype html>\n' + await page.evaluate(() => document.documentElement.outerHTML));
      await page.pdf({
        path: base + '.pdf', printBackground: true, preferCSSPageSize: true, tagged: true, outline: true,
        displayHeaderFooter: true, headerTemplate: '<span></span>',
        footerTemplate: `<div style="width:100%;font:${v.fs} -apple-system,Helvetica,Arial;color:#666;padding:0 ${v.pad};display:flex;justify-content:space-between"><span>Tuareg 660 · ${ed.name}</span><span><span class="pageNumber"></span>/<span class="totalPages"></span></span></div>`,
      });
      await page.close(); fs.unlinkSync(tmp);
      console.log('built', ed.id, v.id);
    }
  }
  await browser.close();
})();
