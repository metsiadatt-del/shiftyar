import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../core.js';
import { spreadsheet, wordDocument } from '../spreadsheet.js';
import { unzipSync,strFromU8 } from '../vendor/fflate.js';

const shift=(date,start='08:00',end='16:00')=>({date,start,end,rate:250000,person:'self'});
test('Known Persian new years and leap-year Esfand',()=>{
  assert.equal(C.toISO(1403,1,1),'2024-03-20');
  assert.equal(C.toISO(1404,1,1),'2025-03-21');
  assert.equal(C.toISO(1405,1,1),'2026-03-21');
  assert.equal(C.toISO(1403,12,30),'2025-03-20');
  assert.equal(C.monthLength(1403,12),30);
  assert.equal(C.monthLength(1404,12),29);
  assert.throws(()=>C.toISO(1404,12,30));
});
test('Every day 1403–1407 agrees with native Persian Intl calendar',()=>{
  const format=new Intl.DateTimeFormat('en-u-ca-persian',{timeZone:'UTC',year:'numeric',month:'numeric',day:'numeric'});
  let count=0;
  for(let y=1403;y<=1407;y++)for(let m=1;m<=12;m++)for(const date of C.monthDays(y,m)){
    const j=C.toJ(date),parts=Object.fromEntries(format.formatToParts(new Date(date+'T12:00Z')).map(p=>[p.type,p.value]));
    assert.equal(j.jy,Number(parts.year));assert.equal(j.jm,Number(parts.month));assert.equal(j.jd,Number(parts.day));assert.equal(C.toISO(j.jy,j.jm,j.jd),date);count++;
  }
  assert.ok(count>=1826);
});
test('Saturday-first calendar and Friday holiday',()=>{assert.equal(C.weekday('2026-10-31'),0);assert.equal(C.weekday('2026-10-30'),6);assert.match(C.holiday('2026-10-30'),/جمعه/);});
test('Fixed official holidays, lunar data and overrides',()=>{
  for(let y=1403;y<=1407;y++){assert.match(C.holiday(C.toISO(y,1,1)),/نوروز/);assert.ok(C.holiday(C.toISO(y,11,22)));}
  assert.match(C.holiday(C.toISO(1405,1,1)),/فطر/);
  assert.equal(C.holiday('2026-10-30',{'2026-10-30':false}),'');
  assert.equal(C.holiday('2026-10-31',{'2026-10-31':true}),'تعطیل تعریف‌شده');
});
test('Persian and Arabic input digits normalize',()=>{assert.equal(C.parseJ('۱۴۰۵/۰۸/۰۸'),'2026-10-30');assert.equal(C.parseJ('١٤٠٥/٠٨/٠٨'),'2026-10-30');assert.throws(()=>C.parseJ('1405/13/01'));});
test('Tehran local today is independent of machine timezone',()=>{assert.deepEqual(C.nowParts(new Date('2026-10-29T21:00Z')),{date:'2026-10-30',time:'00:30'});});
test('Durations: regular, midnight, 24h, minute precision',()=>{
  assert.equal(C.duration('08:00','16:00'),8);assert.equal(C.duration('22:00','06:00'),8);assert.equal(C.duration('08:00','08:00'),24);assert.equal(C.duration('23:45','00:15'),.5);assert.equal(C.addHours('22:30',5),'03:30');assert.throws(()=>C.duration('25:00','12:00'));
});
test('Future color depends on start instant in Tehran',()=>{const s=shift('2026-10-30','10:00','16:00');assert.equal(C.future(s,new Date('2026-10-30T06:29Z')),true);assert.equal(C.future(s,new Date('2026-10-30T06:30Z')),false);});
test('Overlap detects overnight and allows adjacent shifts',()=>{assert.ok(C.overlap(shift('2026-10-30','22:00','06:00'),shift('2026-10-31','05:00','12:00')));assert.equal(C.overlap(shift('2026-10-30','22:00','06:00'),shift('2026-10-31','06:00','12:00')),false);});
test('Monthly totals split crossing shifts without double counting',()=>{
  const date=C.toISO(1405,7,30),s=shift(date,'22:00','06:00');assert.equal(C.hoursInMonth(s,1405,7),2);assert.equal(C.hoursInMonth(s,1405,8),6);assert.equal(C.totals([s],1405,8).amount,1500000);assert.equal(C.shiftsInMonth([s],1405,8).length,1);
});
test('Normal/night classification at boundaries',()=>{
  const date='2026-10-31',overrides={[date]:false,'2026-11-01':false};
  assert.deepEqual(C.classify(shift(date,'05:00','07:00'),overrides),{normal:1,night:1,holiday:0,total:2});
  assert.deepEqual(C.classify(shift(date,'21:00','23:00'),overrides),{normal:1,night:1,holiday:0,total:2});
  assert.deepEqual(C.classify(shift(date,'06:00','06:00'),overrides),{normal:16,night:8,holiday:0,total:24});
});
test('Holiday has precedence over night and splits at midnight',()=>{
  assert.deepEqual(C.classify(shift('2026-10-30','22:00','06:00'),{'2026-10-30':true,'2026-10-31':false}),{normal:0,night:6,holiday:2,total:8});
  assert.deepEqual(C.classify(shift('2026-10-29','21:00','07:00'),{'2026-10-29':false,'2026-10-30':true}),{normal:1,night:2,holiday:7,total:10});
});
test('Repeat is same weekday, bounded to month, with optional preceding weeks',()=>{
  const date=C.toISO(1405,8,15),future=C.repeatDates(date,1405,8,true,false),all=C.repeatDates(date,1405,8,true,true);
  assert.ok(future.every(d=>d>=date&&C.toJ(d).jm===8&&C.weekday(d)===C.weekday(date)));
  assert.ok(all.length>future.length);assert.deepEqual(C.repeatDates(date,1405,8,false,true),[date]);
});
test('Planning templates, custom time and independent totals',()=>{
  const db=C.emptyDB();db.templates=[{id:'t',name:'شب',start:'22:00',end:'06:00'}];db.staff=[{id:'p',name:'پرسنل'}];
  const last=C.toISO(1405,7,30),first=C.toISO(1405,8,1);db.assignments[`${last}|t`]={person:'p',custom:false,start:'22:00',end:'06:00'};db.assignments[`${first}|t`]={person:'p',custom:true,start:'20:00',end:'23:00'};
  assert.equal(C.templateSlots(db,1405,8).length,30);assert.equal(C.templateSlots(db,1405,8)[0].start,'20:00');assert.equal(C.planningReport(db,1405,8)[0].total,9);assert.equal(db.shifts.length,0);
});
test('CSV escapes quotes, newlines and spreadsheet formulas',()=>{const s=C.csv(['نام','مبلغ'],[['=1+1',15],['a"b\nc',-2],[' @SUM(A1)',0]]);assert.ok(s.startsWith('\ufeff'));assert.ok(s.includes("\"'=1+1\""));assert.ok(s.includes('a""b\nc'));assert.ok(s.includes('"-2"'));});
test('HTML escape protects notes and names',()=>{assert.equal(C.escape('<img src=x onerror="x">'),'&lt;img src=x onerror=&quot;x&quot;&gt;');});
test('Backup validates shape and blocks unsafe photos/references/dates',()=>{
  assert.equal(C.validateDB(C.emptyDB()).version,1);
  assert.throws(()=>C.validateDB({version:1}));
  const db=C.emptyDB();db.profile.photo='javascript:alert(1)';assert.throws(()=>C.validateDB(db));db.profile.photo='';db.pharmacies=[{id:'p',name:'داروخانه',rate:100}];db.shifts=[{id:'s',pharmacy:'missing',person:'self',date:'2026-10-30',start:'08:00',end:'10:00',rate:10,note:''}];assert.throws(()=>C.validateDB(db));db.shifts[0].pharmacy='p';assert.equal(C.validateDB(db).shifts.length,1);db.shifts[0].date='2026-02-30';assert.throws(()=>C.validateDB(db));
});
test('DOCX export is a valid Word package with RTL document content',()=>{const files=unzipSync(wordDocument('گزارش ماهانه',['نام','ساعت'],[['همکار',4]]));assert.ok(files['word/document.xml']);assert.match(strFromU8(files['word/document.xml']),/گزارش ماهانه/);assert.match(strFromU8(files['word/document.xml']),/bidiVisual/);});
test('XLSX is a valid ZIP with numeric cells, RTL and safe inline text',()=>{
  const bytes=spreadsheet([{name:'جزئیات',headers:['نام','مبلغ'],rows:[['=SUM(A1)',123],['متن & <نمونه>',0]]}]);
  const files=unzipSync(bytes),sheet=strFromU8(files['xl/worksheets/sheet1.xml']);
  assert.ok(files['[Content_Types].xml']);assert.ok(sheet.includes('rightToLeft="1"'));assert.ok(sheet.includes('<v>123</v>'));assert.ok(sheet.includes('=SUM(A1)'));assert.ok(!sheet.includes('<f>'));assert.ok(sheet.includes('&amp; &lt;'));
});
