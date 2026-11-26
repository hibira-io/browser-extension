// Renders the Web Store's small promo tile (440×280) in each store language
// to store/promo/<lang>.png.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const TAG = {
  en: 'Web chores, done with your approval',
  'zh-TW': '網頁雜事交給我，你點頭才送出',
  'zh-CN': '网页杂事交给我，你点头才提交',
  ja: '面倒なWeb作業、承認してから実行',
  ko: '귀찮은 웹 작업, 승인하면 처리해요',
  th: 'งานเว็บซ้ำๆ ให้ Hibi ทำ คุณแค่อนุมัติ',
  vi: 'Việc web lặp lại, xong khi bạn duyệt',
};
const out = path.resolve(__dirname, '../store/promo');
const art = 'data:image/webp;base64,' + fs.readFileSync(path.resolve(__dirname, '../public/hibi.webp')).toString('base64');

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 440, height: 280 } });
  for (const [lang, tag] of Object.entries(TAG)) {
    await page.setContent(`<html lang="${lang}"><body style="margin:0;width:440px;height:280px;background:#c8102e;display:flex;align-items:center;font-family:Inter,'Noto Sans',system-ui,sans-serif;color:#fff">
<div style="margin-left:28px;width:160px;height:160px;border-radius:50%;background:#fff;overflow:hidden;flex:none"><img src="${art}" style="width:100%;height:100%;object-fit:cover"></div>
<div style="margin:0 24px 0 28px"><div style="font-size:52px;font-weight:700;line-height:1">Hibi</div><div style="font-size:19px;line-height:1.4;margin-top:14px">${tag}</div></div></body></html>`);
    await page.screenshot({ path: path.join(out, `${lang}.png`) });
    console.log(lang);
  }
  await browser.close();
})();
