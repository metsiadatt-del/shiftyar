import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const luminance = hex => {
  const rgb = hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
};
const contrast = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
for (const selector of [':root']) {
  test(`${selector} text and semantic colors have readable contrast`, () => {
    const body = css.slice(css.indexOf(selector)).split('}')[0];
    const tokens = Object.fromEntries([...body.matchAll(/--([\w-]+):(#[a-f0-9]{6})(?![a-f0-9])/gi)].map(m=>[m[1],m[2].toUpperCase()]));
    for (const [fg,bg] of [['text','bg'],['text','surface'],['muted','bg'],['muted','surface'],['muted','soft'],['on-accent','accent'],['self','self-bg'],['deputy','deputy-bg'],['future','future-bg'],['red','red-bg'],['on-accent','self-bg']]) {
      assert.ok(contrast(tokens[fg],tokens[bg]) >= 4.5, `${selector} ${fg}/${bg}`);
    }
  });
}
test('Live palette, Vazirmatn font and icon are shipped offline', async () => {
  for (const rule of ['--bg:#21232e','--accent:#f17300','--line:#105bff','--self-bg:#e4c1f9','.plan-slot.unassigned{background:#450920','url(\'./assets/vazirmatn-arabic.woff2\')','url(\'./assets/vazirmatn-latin.woff2\')','Vazirmatn,Estedad,NotoArabic,Tahoma,sans-serif','font-weight:100 900','.own-holiday','.holiday-mark']) assert.ok(css.includes(rule), rule);
  for (const file of ['vazirmatn-arabic.woff2','vazirmatn-latin.woff2','vazirmatn-LICENSE.txt']) await access(new URL('../assets/'+file, import.meta.url));
  for (const file of ['icon.svg','icon-192.png','icon-512.png']) await access(new URL('../assets/'+file, import.meta.url));
});
test('Holidays carry colour only and can be defined from the month letter', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(!app.includes('holiday-title'));
  assert.ok(app.includes('holiday-form'));
  assert.ok(app.includes("button('calendar-holiday'"));
  assert.ok(app.includes("s.person?'assigned':'unassigned'"));
});

test('Only requested chromatic colors and neutral tones remain in stylesheet',()=>{
  const allowed=new Set(['21232e','fdf0d5','105bff','f17300','450920','e4c1f9','a9def9','fcf6bd']);
  for(const match of css.matchAll(/#([0-9a-f]{3,8})\b/gi)){
    let hex=match[1].toLowerCase();if(hex.length<=4)hex=[...hex].map(c=>c+c).join('');hex=hex.slice(0,6);
    assert.ok(allowed.has(hex)||hex.slice(0,2)===hex.slice(2,4)&&hex.slice(2,4)===hex.slice(4,6),hex);
  }
  assert.ok(css.includes('background-wave.svg'));
});

test('Dark header, champagne MET shine and visible wave remain enabled',async()=>{
 assert.ok(css.includes('.topbar{background:#21232e'));
 assert.ok(css.includes('animation:met-shine'));
 assert.ok(!css.includes('main::before'));assert.ok(css.includes('.card,.stat,.hero{background-image:'));
 assert.ok(css.includes('.plan-slot.unassigned{background:#450920;color:#ffffff'));
 assert.ok(contrast('#ffffff','#450920')>=4.5);
 assert.ok(!css.includes('#fb8b24'));
 const wave=await readFile(new URL('../assets/background-wave.svg',import.meta.url),'utf8');
 assert.ok(wave.includes('feGaussianBlur'));assert.ok(wave.includes('#105bff'));
});

test('Planning tabs have readable inactive, hover and active labels',()=>{
 assert.ok(css.includes('.planning-tabs button{color:#ffffff}'));
 assert.ok(css.includes('.planning-tabs button.active{background:#f17300;color:#222222}'));
 assert.ok(css.includes('.planning-tabs button.active svg{color:#222222;filter:none}'));
 assert.ok(contrast('#ffffff','#303030')>=4.5);
 assert.ok(contrast('#ffffff','#21232e')>=4.5);
 assert.ok(contrast('#222222','#f17300')>=4.5);
});

test('Tables, forms and fields share page background without changing semantic colors',()=>{
 const rule='@media screen{.card,form,fieldset,.optional-fields,dialog,input,select,textarea,table.data-table,table.data-table th,table.data-table tbody tr:nth-child(n){background:var(--bg)}}';
 assert.ok(css.includes(rule));assert.ok(css.indexOf(rule)>css.indexOf('.data-table tbody tr:nth-child(even){background:#383838}'));
 assert.ok(css.includes('--bg:#21232e'));assert.ok(css.includes('--surface:#303030'));
 for(const token of ['--accent:#f17300','--line:#105bff','--self-bg:#e4c1f9','--deputy-bg:#a9def9','--future-bg:#fcf6bd'])assert.ok(css.includes(token));
 assert.ok(contrast('#eeeeee','#21232e')>=4.5);assert.ok(contrast('#cccccc','#21232e')>=4.5);
});

test('Final mobile layout has contained time inputs and fixed planning viewport',()=>{
 for(const rule of ['main{padding-top:12px','table.calendar tbody td[class]','background-color:#21232e','input[type=time]{display:block;appearance:none','position:fixed;inset:0','height:100dvh','inset-inline-start:0','overscroll-behavior:contain','.planning-expanded{overflow:hidden}'])assert.ok(css.includes(rule),rule);
});
