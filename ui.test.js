import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {webcrypto} from 'node:crypto';
import * as C from '../core.js';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const {window,document}=parseHTML(html);
const storage=new Map();
Object.assign(globalThis,{window,document,location:{hash:''},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},matchMedia:()=>({matches:false}),confirm:()=>true});
Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});
window.scrollTo=()=>{};
const modal=document.querySelector('#modal');modal.showModal=()=>modal.setAttribute('open','');modal.close=()=>modal.removeAttribute('open');
class FormDataShim{constructor(form){this.values=new Map();for(const el of form.querySelectorAll('input,select,textarea')){if(!el.name||el.disabled||el.type==='checkbox'&&!el.checked)continue;this.values.set(el.name,el.value??'');}}get(k){return this.values.get(k)??null;}has(k){return this.values.has(k);}}
globalThis.FormData=FormDataShim;
await import('../app.js');
const click=selector=>{const el=document.querySelector(selector);assert.ok(el,selector);el.dispatchEvent(new window.Event('click',{bubbles:true}));};
const change=el=>el.dispatchEvent(new window.Event('change',{bubbles:true}));
const fields=form=>Object.fromEntries([...form.querySelectorAll('input,select,textarea')].map(e=>[e.name,e]));
function value(el,v){if(el.tagName==='SELECT'){for(const o of el.options)o.selected=false;[...el.options].find(o=>o.value===v).selected=true;}else el.value=v;}
async function submit(selector,values){const form=document.querySelector(selector),els=fields(form);Object.defineProperty(form,'elements',{value:els,configurable:true});for(const [k,v]of Object.entries(values))value(els[k],v);form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setTimeout(resolve,0));}
const saved=()=>JSON.parse(storage.get('shiftyar-v1'));

test('Initial RTL calendar has Saturday-first whole weeks and no fabricated data',()=>{assert.equal(document.documentElement.dir,'rtl');assert.equal(document.querySelector('.calendar th').textContent,'شنبه');for(const row of document.querySelectorAll('.calendar tbody tr'))assert.equal(row.children.length,7);assert.equal(document.querySelectorAll('.shift-chip').length,0);assert.match(document.querySelector('#main').textContent,/ماه نامه/);});
test('Directory forms create pharmacy and deputy, reject negative rates',async()=>{
  click('[data-action="navigate"][data-page="directory"]');
  await submit('[data-directory="pharmacies"]',{name:'داروخانه تست',rate:'-1'});assert.match(document.querySelector('[data-directory="pharmacies"] .error-text').textContent,/نرخ/);
  await submit('[data-directory="pharmacies"]',{name:'داروخانه تست',rate:'۳۰۰٬۰۰۰'});
  assert.equal(saved().pharmacies[0].rate,300000);
  const extras=document.querySelectorAll('[data-directory="deputies"] details.optional-fields');assert.equal(extras.length,2);for(const detail of extras)assert.equal(detail.hasAttribute('open'),false);
  await submit('[data-directory="deputies"]',{name:'همکار آزمایشی',contact:'09120000000',medical:'12345',payment:'پرداخت آزمایشی'});assert.equal(saved().deputies[0].medical,'12345');assert.equal(saved().deputies[0].payment,'پرداخت آزمایشی');assert.equal(saved().deputies.length,1);assert.ok(document.querySelector('[data-directory="deputies"] [name="medical"]'));
});
test('Shift creation persists rate and catches overlap',async()=>{
  click('[data-action="navigate"][data-page="shift"]');
  const p=saved().pharmacies[0].id,date=C.dateNumeric(C.nowParts().date);
  await submit('#shift-form',{date,pharmacy:p,owner:'self',start:'10:00',end:'15:00',note:'یادداشت تست'});
  assert.equal(saved().shifts.length,1,document.querySelector('#shift-form .error-text')?.textContent);assert.equal(saved().shifts[0].rate,300000);
  await submit('#shift-form',{date,pharmacy:p,owner:'self',start:'14:00',end:'18:00',note:''});
  assert.match(document.querySelector('#shift-form .error-text').textContent,/هم‌زمان/);assert.equal(saved().shifts.length,1);
});
test('Edit modal updates note safely and retains the original rate',async()=>{
  click('[data-action="edit-shift"]');assert.ok(modal.hasAttribute('open'));
  await submit('#edit-shift-form',{note:'<img src=x onerror=alert(1)>',owner:'self'});
  assert.equal(saved().shifts[0].note,'<img src=x onerror=alert(1)>');assert.equal(saved().shifts[0].rate,300000);assert.equal(document.querySelector('img[src="x"]'),null);
});
test('Report person filters and comparison charts render',()=>{
  click('[data-action="navigate"][data-page="reports"]');assert.equal(document.querySelector('[data-action="filter"][data-value="all"]').getAttribute('aria-pressed'),'true');assert.equal(document.querySelectorAll('.stat').length,4);assert.equal(document.querySelectorAll('[data-month="compareMonth"]').length,1);
  click('[data-action="filter"][data-value="deputy"]');assert.ok(document.querySelector('.stat strong').textContent.includes('۰'));
  click('[data-action="filter"][data-value="all"]');assert.match(document.querySelector('#main').textContent,/داروخانه تست/);
});
test('Independent staff and templates can be created and assigned',async()=>{
  click('[data-action="navigate"][data-page="planning"]');click('[data-action="plan-tab"][data-value="staff"]');
  await submit('#staff-form',{name:'پرسنل تست',medical:'123',national:'0012345678',payment:'بانک',contact:'09120000000'});assert.equal(saved().staff.length,1);
  click('[data-action="plan-tab"][data-value="templates"]');await submit('#template-form',{name:'صبح',start:'08:00',end:'14:00'});assert.equal(saved().templates.length,1);
  click('[data-action="plan-tab"][data-value="calendar"]');assert.ok(document.querySelector('.plan-slot.unassigned'));click('[data-action="assign"]');
  await submit('#assignment-form',{person:saved().staff[0].id});assert.equal(Object.keys(saved().assignments).length,1);assert.ok(document.querySelector('.plan-slot.assigned'));assert.equal(saved().shifts.length,1);
  click('[data-action="plan-tab"][data-value="report"]');assert.match(document.querySelector('#main').textContent,/پرسنل تست/);assert.equal(document.querySelectorAll('.data-table tbody tr').length,1);
});
test('Weekly assignment repeats in the month and collision rolls back',async()=>{
  click('[data-action="plan-tab"][data-value="calendar"]');click('[data-action="assign"]');
  const form=document.querySelector('#assignment-form'),els=fields(form);Object.defineProperty(form,'elements',{value:els,configurable:true});els.repeat.checked=true;change(els.repeat);els.previous.checked=true;
  await submit('#assignment-form',{person:saved().staff[0].id});const count=Object.keys(saved().assignments).length;assert.ok(count>=4&&count<=5);
  click('[data-action="plan-tab"][data-value="templates"]');await submit('#template-form',{name:'هم‌زمان',start:'10:00',end:'15:00'});
  click('[data-action="plan-tab"][data-value="calendar"]');const t=saved().templates[1].id;click(`[data-action="assign"][data-key$="|${t}"]`);
  await submit('#assignment-form',{person:saved().staff[0].id});assert.match(document.querySelector('#assignment-form .error-text').textContent,/تداخل/);assert.equal(Object.keys(saved().assignments).length,count);click('[data-action="close"]');
});
test('Shift form supports dropdown dates, inline additions and retained draft',async()=>{
  click('[data-action="navigate"][data-page="shift"]');
  const form=document.querySelector('#shift-form'),els=fields(form);Object.defineProperty(form,'elements',{value:els,configurable:true});
  assert.equal(form.querySelectorAll('[data-shift-date]').length,3);
  assert.equal(form.querySelector('[name="date"]').type,'hidden');
  assert.deepEqual([...form.querySelectorAll('[data-action="add-hours"]')].map(b=>b.dataset.hours),['4','5','8','12']);
  value(els.start,'20:30');
  for(const [hours,end] of [[4,'00:30'],[5,'01:30'],[8,'04:30'],[12,'08:30']]){click(`#shift-form [data-hours="${hours}"]`);assert.equal(els.end.value,end);}
  value(els.end,'00:00');
  value(els.year,'1405');value(els.month,'6');change(els.month);value(els.day,'31');change(els.day);
  value(els.month,'7');change(els.month);assert.equal(els.day.options.length,30);assert.equal(els.date.value,'1405/07/30');
  value(els.note,'پیش‌نویس حفظ شود');value(els.start,'09:15');
  click('[data-action="quick-directory"][data-type="pharmacies"]');
  await submit('[data-quick]',{name:'داروخانه جدید',rate:'-5'});assert.match(modal.textContent,/نرخ ساعتی/);
  await submit('[data-quick]',{name:'داروخانه جدید',rate:'250000'});
  assert.equal(document.querySelector('#shift-form'),form);assert.equal(els.note.value,'پیش‌نویس حفظ شود');assert.equal(els.start.value,'09:15');assert.equal(els.pharmacy.value,saved().pharmacies.at(-1).id);
  value(els.owner,'deputy');change(els.owner);assert.equal(form.querySelector('[data-deputy-field]').hidden,false);
  click('[data-action="quick-directory"][data-type="deputies"]');await submit('[data-quick]',{firstName:'آوا',lastName:'تست'});
  assert.equal(els.deputy.value,saved().deputies.at(-1).id);assert.equal(els.note.value,'پیش‌نویس حفظ شود');
  await submit('#shift-form',{});assert.equal(saved().shifts.at(-1).person,saved().deputies.at(-1).id);
  click('[data-action="navigate"][data-page="reports"]');assert.equal(document.querySelectorAll('.total-box').length,0);assert.equal(document.querySelector('.topbar-center').textContent,'MET');assert.match(document.querySelector('.breadcrumb').textContent,/فضای کاری/);assert.equal(document.querySelector('.topbar-art'),null);assert.ok(document.querySelector('.footer').textContent.includes('FINAL MET SHIFTYAR'));
});
test('Month letter marks holidays by colour and lets the user define them',async()=>{
  click('[data-action="navigate"][data-page="calendar"]');
  const cells=[...document.querySelectorAll('td[data-date]')],holiday=cells.find(td=>td.classList.contains('holiday-cell'));
  assert.ok(holiday);assert.equal(holiday.textContent.trim(),C.fa(C.toJ(holiday.dataset.date).jd));assert.equal(holiday.querySelector('.holiday-title'),null);
  const workday=cells.find(td=>!td.classList.contains('holiday-cell')&&!td.classList.contains('empty'));
  click(`td[data-date="${workday.dataset.date}"]`);
  click('[data-action="calendar-holiday"]');
  assert.ok(modal.hasAttribute('open'));assert.match(modal.textContent,/تعطیلی این روز/);
  await submit('#holiday-form',{mode:'holiday'});
  assert.equal(saved().holidays[workday.dataset.date],true);
  assert.ok(document.querySelector(`td[data-date="${workday.dataset.date}"]`).classList.contains('own-holiday'));
  click('[data-action="calendar-holiday"]');await submit('#holiday-form',{mode:'default'});
  assert.equal(saved().holidays[workday.dataset.date],undefined);
  const date=holiday.dataset.date;click(`td[data-date="${date}"]`);click('[data-action="calendar-holiday"]');await submit('#holiday-form',{mode:'work'});
  assert.equal(saved().holidays[date],false);assert.ok(!document.querySelector(`td[data-date="${date}"]`).classList.contains('holiday-cell'));
});
test('Unified navy palette stays active without a theme switcher',()=>{assert.equal(document.documentElement.dataset.theme,'unified');assert.equal(document.querySelector('[data-action="theme"]'),null);});
test('All export choices exist including XLSX, Word and PDF print',()=>{click('[data-action="navigate"][data-page="calendar"]');for(const format of ['xlsx','csv','html','json','docx','pdf'])assert.ok(document.querySelector(`[data-format="${format}"]`));});
test('Profile name updates across navigation and shift owner labels',async()=>{click('[data-action="navigate"][data-page="profile"]');await submit('#profile-form',{name:'سارا'});assert.equal(saved().profile.name,'سارا');click('[data-action="navigate"][data-page="shift"]');assert.match(document.querySelector('select[name="owner"]').textContent,/سارا/);});

test('Planning fullscreen fits every slot and exits without changing data',()=>{
  click('[data-action="navigate"][data-page="planning"]');click('[data-action="plan-tab"][data-value="calendar"]');
  const before=storage.get('shiftyar-v1'),count=document.querySelectorAll('[data-action="assign"]').length;
  click('[data-action="plan-fullscreen"]');
  assert.ok(document.body.classList.contains('planning-expanded'));
  assert.ok(document.querySelector('.planning-board.is-fullscreen.is-fit'));
  assert.equal(document.querySelectorAll('.plan-matrix [data-action="assign"]').length,count);
  assert.equal(document.querySelectorAll('.plan-matrix tbody tr').length,count/saved().templates.length);
  click('[data-action="plan-fit"]');assert.ok(!document.querySelector('.planning-board.is-fit'));
  click('[data-action="plan-bulk"]');
  const escape=new window.Event('keydown');Object.defineProperty(escape,'key',{value:'Escape'});document.dispatchEvent(escape);
  assert.ok(document.body.classList.contains('planning-expanded'));
  click('[data-action="close"]');document.dispatchEvent(escape);
  assert.ok(!document.body.classList.contains('planning-expanded'));
  assert.equal(storage.get('shiftyar-v1'),before);
});
test('Bulk assignment preserves filled slots, rejects collisions atomically and handles overnight shifts',async()=>{
  const person=saved().staff[0].id,template=saved().templates[0].id;
  const dates=[...document.querySelectorAll('.plan-matrix tbody tr')].map(row=>row.querySelector('[data-key]').dataset.key.split('|')[0]);
  const existing=structuredClone(saved().assignments);
  click('[data-action="plan-bulk"]');document.querySelector('[name="onlyEmpty"]').checked=true;
  await submit('#bulk-assignment-form',{from:dates[0],to:dates.at(-1),template,person});
  assert.equal(modal.hasAttribute('open'),false);
  assert.equal(Object.keys(saved().assignments).length,dates.length);
  for(const [key,assignment] of Object.entries(existing))assert.deepEqual(saved().assignments[key],assignment);
  const before=storage.get('shiftyar-v1');
  click('[data-action="plan-bulk"]');document.querySelector('[name="onlyEmpty"]').checked=true;
  await submit('#bulk-assignment-form',{from:dates[0],to:dates.at(-1),template:saved().templates[1].id,person});
  assert.match(document.querySelector('.error-text').textContent,/تداخل/);assert.equal(storage.get('shiftyar-v1'),before);
  await submit('#bulk-assignment-form',{from:dates.at(-1),to:dates[0],template,person});
  assert.match(document.querySelector('.error-text').textContent,/بازه/);assert.equal(storage.get('shiftyar-v1'),before);
  document.querySelector('[name="onlyEmpty"]').checked=false;
  globalThis.confirm=()=>false;
  await submit('#bulk-assignment-form',{from:dates[0],to:dates[0],template,person});
  assert.equal(storage.get('shiftyar-v1'),before);globalThis.confirm=()=>true;
  const form=document.querySelector('#bulk-assignment-form'),els=fields(form);els.custom.checked=true;change(els.custom);
  await submit('#bulk-assignment-form',{from:dates.at(-1),to:dates.at(-1),template:saved().templates[1].id,person,start:'20:00',end:'00:00'});
  assert.equal(modal.hasAttribute('open'),false);
  assert.deepEqual(saved().assignments[`${dates.at(-1)}|${saved().templates[1].id}`],{person,custom:true,start:'20:00',end:'00:00'});
});

test('Detailed report shows actual end date and historical wages safely',()=>{
  click('[data-action="navigate"][data-page="reports"]');click('[data-action="filter"][data-value="all"]');
  const table=document.querySelector('.report-details');assert.ok(table);
  for(const label of ['تاریخ شروع','تاریخ پایان','داروخانه / محل کار','نرخ تاریخی','دستمزد کل','دستمزد این ماه','یادداشت'])assert.ok(table.textContent.includes(label));
  assert.ok(document.querySelector('#main').textContent.includes('جزئیات شیفت ها'));
  assert.equal(table.querySelector('img'),null);
  const shift=saved().shifts[0];assert.ok(table.textContent.includes(C.fa(shift.rate)));assert.ok(table.textContent.includes(C.fa(C.duration(shift.start,shift.end)*shift.rate)));
});
