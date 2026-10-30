(function(root){
'use strict';
const months=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const pad=n=>String(n).padStart(2,'0');
const digits=s=>String(s??'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const fmt=new Intl.DateTimeFormat('en-US-u-ca-persian',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Tehran'});
function jalali(date=new Date()){const p=Object.fromEntries(fmt.formatToParts(date).map(x=>[x.type,x.value]));return `${p.year}/${p.month}/${p.day}`}
const cache=new Map();
function yearDates(year){if(cache.has(+year))return cache.get(+year);const result=[];const start=Date.UTC(+year+621,2,18,12);for(let i=0;i<375;i++){const date=new Date(start+i*86400000),j=jalali(date);if(+j.slice(0,4)===+year)result.push({j,iso:date.toISOString().slice(0,10),weekday:(date.getUTCDay()+1)%7})}cache.set(+year,result);return result}
function entry(j){j=digits(j);return yearDates(+j.slice(0,4)).find(x=>x.j===j)}
function monthDays(y,m){return yearDates(y).filter(x=>+x.j.slice(5,7)===+m)}
function addDay(j,n=1){const e=entry(j);if(!e)throw Error('تاریخ نامعتبر');return jalali(new Date(Date.parse(e.iso+'T12:00:00Z')+n*86400000))}
function today(){return jalali()}
function nowTime(){return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date())}
function minutes(t){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(t))throw Error('ساعت نامعتبر');const [h,m]=t.split(':').map(Number);return h*60+m}
function duration(a,b){let d=minutes(b)-minutes(a);return (d<=0?d+1440:d)/60}
function endAfter(start,h){const m=(minutes(start)+h*60)%1440;return `${pad(Math.floor(m/60))}:${pad(m%60)}`}
function holiday(j,custom={}){const e=entry(j);return [...(root.IRAN_HOLIDAYS?.[j]||[]),...(e?.weekday===6?['جمعه']:[]),...(custom[j]?[custom[j]]:[])]}
function future(s,now=Date.now()){const e=entry(s.date);return !!e&&Date.parse(`${e.iso}T${s.start}:00+03:30`)>now}
function amount(s){return Math.round(duration(s.start,s.end)*Number(s.rate||0)*100)/100}
function classify(date,start,end,custom={}){const from=minutes(start),length=Math.round(duration(start,end)*60);const r={normal:0,night:0,holiday:0,total:length/60};for(let i=0;i<length;i++){const n=from+i,d=n>=1440?addDay(date):date,t=n%1440;if(holiday(d,custom).length)r.holiday++;else if(t<360||t>=1320)r.night++;else r.normal++}for(const k of ['normal','night','holiday'])r[k]/=60;return r}
function repeatDates(date,mode){const [y,m]=date.split('/').map(Number),e=entry(date);return monthDays(y,m).filter(x=>x.weekday===e.weekday&&(mode==='all'||mode==='previous'&&x.j<=date||mode==='next'&&x.j>=date||x.j===date)).map(x=>x.j)}
function empty(){return {pharmacies:[],proxies:[],shifts:[],profile:{name:'',photo:''},planner:{staff:[],templates:[],assignments:{},holidays:{}}}}
function migrate(data){const r=empty();for(const k of ['pharmacies','proxies','shifts'])r[k]=Array.isArray(data?.[k])?data[k]:[];r.profile={...r.profile,...data?.profile};r.planner={...r.planner,...data?.planner};r.shifts=r.shifts.map(s=>({...s,date:digits(s.date),hours:duration(s.start,s.end),proxyId:s.worker==='proxy'?s.proxyId:''}));return r}
function validBackup(data){if(!data||!['pharmacies','proxies','shifts'].every(k=>Array.isArray(data[k])))return false;const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);if(!data.pharmacies.every(p=>id(p.id)&&typeof p.name==='string'&&(p.rate==null||Number.isFinite(p.rate)&&p.rate>=0)))return false;if(!data.proxies.every(p=>id(p.id)&&typeof p.name==='string'))return false;try{if(!data.shifts.every(s=>id(s.id)&&entry(digits(s.date))&&['me','proxy'].includes(s.worker)&&data.pharmacies.some(p=>p.id===s.pharmacyId)&&Number.isFinite(s.rate)&&s.rate>=0&&(s.worker==='me'||data.proxies.some(p=>p.id===s.proxyId))&&duration(s.start,s.end)>0))return false;if(data.profile&&(typeof data.profile.name!=='string'||typeof data.profile.photo!=='string'||data.profile.photo&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(data.profile.photo)))return false;if(data.planner){const p=data.planner;if(!Array.isArray(p.staff)||!Array.isArray(p.templates)||!p.assignments||!p.holidays)return false;if(!p.staff.every(s=>id(s.id)&&typeof s.name==='string')||!p.templates.every(t=>id(t.id)&&typeof t.name==='string'&&duration(t.start,t.end)>0))return false;for(const [key,a] of Object.entries(p.assignments)){const [d,t]=key.split('|');if(!entry(d)||!p.templates.some(x=>x.id===t)||!p.staff.some(x=>x.id===a.staffId)||!duration(a.start,a.end))return false}for(const [d,t] of Object.entries(p.holidays))if(!entry(d)||typeof t!=='string')return false}return true}catch{return false}}
const api={months,pad,digits,jalali,yearDates,entry,monthDays,addDay,today,nowTime,minutes,duration,endAfter,holiday,future,amount,classify,repeatDates,empty,migrate,validBackup};root.ShiftCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
