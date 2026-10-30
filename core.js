import jalaali from './vendor/jalaali.js';
import { holidaysOn, holidayName } from './vendor/holidays.js';
export const months = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
export const weekdays = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
export const fa = n => new Intl.NumberFormat('fa-IR', {maximumFractionDigits:2}).format(n);
export const en = s => String(s).replace(/[۰-۹]/g, d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
export const digits = n => String(n).replace(/[0-9]/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
export const pad = n => String(n).padStart(2,'0');
export const escape = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function nowParts(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
  return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};
}
export function toJ(iso) { const [y,m,d]=iso.split('-').map(Number); return jalaali.toJalaali(y,m,d); }
export function toISO(y,m,d) {
  if (!jalaali.isValidJalaaliDate(y,m,d)) throw new Error('تاریخ شمسی معتبر نیست.');
  const g=jalaali.toGregorian(y,m,d);return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
}
export function dateLabel(iso) {const j=toJ(iso);return `${fa(j.jd)} ${months[j.jm-1]} ${digits(j.jy)}`;}
export function dateNumeric(iso) {const j=toJ(iso);return `${j.jy}/${pad(j.jm)}/${pad(j.jd)}`;}
export function parseJ(text) {const normalized=en(text).trim();if(!/^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(normalized))throw new Error('تاریخ را به صورت سال/ماه/روز وارد کنید.');const [y,m,d]=normalized.split(/[/-]/).map(Number);return toISO(y,m,d);}
export const monthLength = (y,m) => jalaali.jalaaliMonthLength(y,m);
export function addDays(iso,n) {return new Date(Date.parse(iso+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);}
export const weekday = iso => (new Date(iso+'T12:00:00Z').getUTCDay()+1)%7;
export function monthDays(y,m) {return Array.from({length:monthLength(y,m)},(_,i)=>toISO(y,m,i+1));}
export function monthRange(y,m) {const start=toISO(y,m,1);return {start,end:addDays(start,monthLength(y,m))};}
export function holiday(iso,overrides={}) {
  if(Object.hasOwn(overrides,iso)) return overrides[iso] ? 'تعطیل تعریف‌شده' : '';
  const j=toJ(iso); const names=holidaysOn({year:j.jy,month:j.jm,day:j.jd}).map(h=>holidayName(h.id,'fa'));
  if(weekday(iso)===6) names.unshift('جمعه');
  return [...new Set(names)].filter(Boolean).join('، ');
}
export function duration(start,end) {const a=minutes(start),b=minutes(end);return ((b-a+1440)%1440 || 1440)/60;}
export function minutes(t) {if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) throw new Error('ساعت معتبر نیست.');const [h,m]=t.split(':').map(Number);return h*60+m;}
export function addHours(t,h) {const n=(minutes(t)+h*60)%1440;return `${pad(Math.floor(n/60))}:${pad(n%60)}`;}
export function interval(s) {const a=Date.parse(s.date+'T00:00:00Z')+minutes(s.start)*60000;return [a,a+duration(s.start,s.end)*3600000];}
export function overlap(a,b) {const [a0,a1]=interval(a),[b0,b1]=interval(b);return a0<b1 && b0<a1;}
export function future(s,now=new Date()) {return Date.parse(`${s.date}T${s.start}:00+03:30`)>now.getTime();}
export function hoursInMonth(s,y,m) {const [a,b]=interval(s),r=monthRange(y,m);return Math.max(0,Math.min(b,Date.parse(r.end+'T00:00Z'))-Math.max(a,Date.parse(r.start+'T00:00Z')))/3600000;}
export function shiftsInMonth(shifts,y,m) {return shifts.filter(s=>hoursInMonth(s,y,m)>0).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));}
export function totals(shifts,y,m) {return shifts.reduce((t,s)=>{const hours=hoursInMonth(s,y,m);t.hours+=hours;t.amount+=hours*s.rate;return t;},{hours:0,amount:0});}
export function byPharmacy(shifts,pharmacies,y,m) {return pharmacies.map(p=>({...p,...totals(shifts.filter(s=>s.pharmacy===p.id),y,m)})).filter(p=>p.hours>0).sort((a,b)=>b.hours-a.hours);}
export function classify(s,overrides={},range=null) {
  let [a,b]=interval(s);if(range){a=Math.max(a,Date.parse(range.start+'T00:00Z'));b=Math.min(b,Date.parse(range.end+'T00:00Z'));}
  const t={normal:0,night:0,holiday:0,total:0};
  while(a<b) {
    const d=new Date(a),iso=d.toISOString().slice(0,10),minute=d.getUTCHours()*60+d.getUTCMinutes();
    const midnight=Date.parse(iso+'T00:00Z');const next=midnight+(minute<360?360:minute<1320?1320:1440)*60000;
    const end=Math.min(next,b),hours=(end-a)/3600000;
    const kind=holiday(iso,overrides)?'holiday':minute<360||minute>=1320?'night':'normal';
    t[kind]+=hours;t.total+=hours;a=end;
  }return t;
}
export function templateSlots(db,y,m) {
  return monthDays(y,m).flatMap(date=>db.templates.map(t=>{
    const key=`${date}|${t.id}`,a=db.assignments[key];
    return {key,date,template:t.id,title:t.name,start:a?.custom?a.start:t.start,end:a?.custom?a.end:t.end,person:a?.person||'',custom:!!a?.custom};
  }));
}
export function planningReport(db,y,m) {
  const prev=m===1?{y:y-1,m:12}:{y,m:m-1};
  const slots=[...templateSlots(db,prev.y,prev.m),...templateSlots(db,y,m)];
  return db.staff.map(p=>{
    const t={...p,normal:0,night:0,holiday:0,total:0};
    slots.filter(s=>s.person===p.id).forEach(s=>{const c=classify(s,db.holidays,monthRange(y,m));for(const k of ['normal','night','holiday','total'])t[k]+=c[k];});return t;
  }).sort((a,b)=>b.total-a.total);
}
export function repeatDates(date,y,m,repeat,previous) {return monthDays(y,m).filter(d=>d===date || repeat&&weekday(d)===weekday(date)&&(previous||d>date));}
export function emptyDB() {return {version:1,profile:{name:'',photo:''},pharmacies:[],deputies:[],shifts:[],staff:[],templates:[],assignments:{},holidays:{}};}
export function csv(headers,rows) {
  const cell=v=>'"'+String(typeof v==='number'?v:/^[\s]*[=+@-]/.test(String(v))?'\''+v:v??'').replace(/"/g,'""')+'"';
  return '\ufeff'+[headers,...rows].map(r=>r.map(cell).join(',')).join('\r\n');
}
export function validateDB(d) {
  const fail=()=>{throw new Error('ساختار فایل پشتیبان معتبر نیست.');};
  const text=(v,n=2000)=>typeof v==='string'&&v.length<=n;
  const id=v=>text(v,100)&&/^[a-zA-Z0-9_-]+$/.test(v);
  const iso=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v+'T00:00Z').toISOString().slice(0,10)===v;
  const time=v=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  if(!d||d.version!==1||!d.profile||!text(d.profile.name,100)||!text(d.profile.photo,1500000)||d.profile.photo&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(d.profile.photo))fail();
  for(const k of ['pharmacies','deputies','shifts','staff','templates']) {
    if(!Array.isArray(d[k])||d[k].length>50000)fail();
    const ids=new Set();for(const v of d[k]){if(!v||!id(v.id)||ids.has(v.id))fail();ids.add(v.id);}
  }
  for(const k of ['pharmacies','deputies','staff','templates'])for(const v of d[k])if(!text(v.name,150)||!v.name.trim())fail();
  for(const p of d.pharmacies)if(!Number.isFinite(p.rate)||p.rate<0||p.rate>1e9)fail();
  for(const p of d.staff)for(const k of ['medical','national','payment','contact'])if(!text(p[k],300))fail();
  for(const p of d.deputies)if(!text(p.contact,300))fail();
  for(const t of d.templates)if(!time(t.start)||!time(t.end))fail();
  for(const s of d.shifts)if(!iso(s.date)||!time(s.start)||!time(s.end)||!Number.isFinite(s.rate)||s.rate<0||s.rate>1e9||!text(s.note)||!d.pharmacies.some(p=>p.id===s.pharmacy)||!(s.person==='self'||d.deputies.some(p=>p.id===s.person)))fail();
  for(const k of ['holidays','assignments'])if(!d[k]||typeof d[k]!=='object'||Array.isArray(d[k])||Object.keys(d[k]).length>100000)fail();
  for(const [date,v]of Object.entries(d.holidays))if(!iso(date)||typeof v!=='boolean')fail();
  for(const [key,a]of Object.entries(d.assignments)){const [date,tid]=key.split('|');if(!iso(date)||key!==`${date}|${tid}`||!d.templates.some(t=>t.id===tid)||!a||!d.staff.some(p=>p.id===a.person)||typeof a.custom!=='boolean'||!time(a.start)||!time(a.end))fail();}
  return d;
}
