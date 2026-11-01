import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
const css=await readFile(new URL('../styles.css',import.meta.url),'utf8');
const luminance=hex=>{const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
for(const selector of [':root{',':root[data-theme=dark]{']){
 test(`${selector} semantic text and essential controls meet contrast thresholds`,()=>{
  const body=css.slice(css.indexOf(selector)).split('}')[0];
  const tokens=Object.fromEntries([...body.matchAll(/--([\w-]+):(#[a-f0-9]{6})(?![a-f0-9])/gi)].map(m=>[m[1],m[2]]));
  for(const bg of ['background','surface','surface-muted'])for(const fg of ['text-primary','text-secondary'])assert.ok(contrast(tokens[fg],tokens[bg])>=4.5,`${fg}/${bg}`);
  for(const [fg,bg]of [['on-accent','accent'],['success','success-bg'],['warning','warning-bg'],['danger','danger-bg'],['self','self-bg'],['deputy','deputy-bg'],['future','future-bg']])assert.ok(contrast(tokens[fg],tokens[bg])>=4.5,`${fg}/${bg}`);
  for(const bg of ['background','surface','surface-muted'])for(const fg of ['control-border','focus-ring'])assert.ok(contrast(tokens[fg],tokens[bg])>=3,`${fg}/${bg}`);
 });
}
test('Offline font and accessible touch and focus rules are shipped',async()=>{
 for(const file of ['vazirmatn-arabic.woff2','vazirmatn-latin.woff2','vazirmatn-LICENSE.txt','icon.svg','icon-192.png','icon-512.png'])await access(new URL('../assets/'+file,import.meta.url));
 for(const rule of ['font-display:swap','font:15px/1.7 Vazirmatn,Tahoma,sans-serif','font-size:16px','min-height:44px',':focus-visible','prefers-reduced-motion','font-variant-numeric:tabular-nums','safe-area-inset-bottom'])assert.ok(css.includes(rule),rule);
 assert.ok(!/backdrop-filter|background-wave/.test(css));
 assert.ok(css.includes('@keyframes met-shine'));assert.ok(css.includes('animation:met-shine 5s'));assert.ok(!css.includes('.topbar-center{display:none}'));
});
test('Compact calendar, keyboard-safe three-tab navigation and daily scrolling exist',()=>{
 for(const rule of ['max-width:767px','repeat(3,minmax(0,1fr))','.calendar:not(.zoom) .shift-chip{display:none}','.calendar-summary{display:block','body:has(input:focus) .sidebar','max-height:65dvh','touch-action:pan-x pan-y','height:100dvh','.is-fullscreen .plan-board-scroll{flex:1;min-height:0;max-height:none}'])assert.ok(css.includes(rule),rule);
 assert.ok(!css.includes('plan-matrix'));
});
test('Responsive rules are structurally present for each requested width',()=>{
 for(const width of [320,375,390,430,768,1024,1440]){
  assert.ok(css.includes('minmax(0,1fr)'));
  if(width<768)assert.ok(css.includes('@media(max-width:767px)'));
  if(width<375)assert.ok(css.includes('@media(max-width:374px)'));
 }
});
test('Planning uses a separate local font without changing the application font',async()=>{
 for(const file of ['noto-arabic.woff2','noto-latin.woff2','noto-LICENSE.txt'])await access(new URL('../assets/'+file,import.meta.url));
 assert.ok(css.includes('.planning-page #main,.planning-page dialog,.planning-page #print-area{font-family:PlanningNoto,Tahoma,sans-serif}'));
 assert.ok(css.includes('font:15px/1.7 Vazirmatn,Tahoma,sans-serif'));
});
test('Printing keeps full shift details independently of mobile display',()=>{
 const print=css.slice(css.indexOf('@media print'));
 assert.ok(print.includes('#print-area .calendar .shift-chip{display:block}'));
 assert.ok(print.includes('#print-area .calendar-summary{display:none}'));
});
