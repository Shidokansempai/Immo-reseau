const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
(async()=>{let h=fs.readFileSync(path.join(__dirname,'bonne-journee.html'),'utf8');
const logo=['logo.png','logo.jpg','logo.svg'].map(f=>path.join(__dirname,f)).find(fs.existsSync);
const slot=logo?`<img src="data:image/${path.extname(logo).slice(1).replace('svg','svg+xml').replace('jpg','jpeg')};base64,${fs.readFileSync(logo).toString('base64')}">`
 :'<div class="wm">IMMO<span>RÉSEAU</span></div><div class="wm-sub">CONSEIL IMMOBILIER</div>';
h=h.replace('LOGO_SLOT',slot);
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
await p.setContent(h,{waitUntil:'networkidle'}).catch(()=>{});await p.waitForTimeout(800);
await p.screenshot({path:path.join(__dirname,'story-bonne-journee.png')});await b.close();})();
