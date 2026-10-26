export const collections = ['accounts','sources','transactions','allocations','vault','assets','debts','businesses','notes','funds'];
export const initialState = () => ({version:1, rates:{usd:0,gold:0,coin:0,updatedAt:null,source:'',url:''}, accounts:[],sources:[],transactions:[],allocations:[],vault:[],assets:[],debts:[],businesses:[],notes:[],funds:[{id:'invest',title:'سرمایه‌گذاری'},{id:'debt',title:'تأدیه دیون و طلب‌ها'},{id:'save',title:'پس‌انداز'},{id:'daily',title:'روزمره'}]});
export const digits = v => String(v).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[,٬\s]/g,'').replace('٫','.');
export function number(v) { const n=Number(digits(v)); if(!Number.isFinite(n)||n<0) throw Error('عدد معتبر و غیرمنفی وارد کنید.'); return n; }
export function toman(value,unit,rates) { const n=number(value); if(!n)return 0; const rate=unit==='toman'?1:unit==='rial'?0.1:rates[unit]; if(!Number.isFinite(rate)||rate<=0)throw Error('ابتدا نرخ معتبر این واحد را در تنظیمات ثبت کنید.'); const result=Math.round(n*rate); if(!Number.isSafeInteger(result))throw Error('مبلغ از محدوده مجاز بزرگ‌تر است.'); return result; }
export const sum = (rows,key='amount') => rows.reduce((s,r)=>s+(Number(r[key])||0),0);
export function balance(s,id) { return (s.accounts.find(a=>a.id===id)?.opening||0)+s.transactions.reduce((n,t)=>n+(t.account===id?(t.kind==='income'?t.amount:-t.amount):0)+(t.kind==='transfer'&&t.destination===id?t.amount:0),0)-sum(s.allocations.filter(a=>a.account===id&&a.target==='vault')); }
export function allocated(s,id) { return sum(s.allocations.filter(a=>a.income===id)); }
export function fundBalance(s,id) {return sum(s.allocations.filter(a=>a.target===id))-sum(s.transactions.filter(t=>t.kind==='expense'&&t.fund===id));}
export function validateTransaction(s,t,exclude='') {
 if(!t.title?.trim())throw Error('عنوان لازم است.');
 if(!s.accounts.some(a=>a.id===t.account))throw Error('حساب را انتخاب کنید.');
 if(!(t.amount>0))throw Error('مبلغ باید بیشتر از صفر باشد.');
 if(!['income','expense','transfer'].includes(t.kind))throw Error('نوع تراکنش نامعتبر است.');
 if(t.kind==='transfer'&&(!s.accounts.some(a=>a.id===t.destination)||t.destination===t.account))throw Error('حساب مقصد باید با مبدأ متفاوت باشد.');
 const base={...s,transactions:s.transactions.filter(x=>x.id!==exclude)};
 if(t.kind!=='income'&&balance(base,t.account)<t.amount)throw Error('موجودی حساب کافی نیست.');
 if(t.kind==='expense'&&t.fund&&fundBalance(base,t.fund)<t.amount)throw Error('بودجه صندوق کافی نیست.');
 if(exclude&&allocated(s,exclude)>t.amount)throw Error('این درآمد قبلاً بیش از مبلغ جدید بودجه‌بندی شده است.');
}
export function allocate(s,a) {
 const income=s.transactions.find(t=>t.id===a.income&&t.kind==='income');
 if(!income)throw Error('درآمد را انتخاب کنید.');
 const amount=a.mode==='percent'?Math.round(income.amount*number(a.value)/100):toman(a.value,a.unit,s.rates);
 if(!(amount>0)||amount>income.amount-allocated(s,income.id))throw Error('مبلغ تخصیص از مانده درآمد بیشتر است یا صفر است.');
 if(!s.accounts.some(x=>x.id===a.account))throw Error('حساب مرتبط را انتخاب کنید.');
 if(a.account!==income.account)throw Error('حساب تخصیص باید همان حساب دریافت درآمد باشد.');
 if(a.target==='vault') {
  if(balance(s,a.account)<amount)throw Error('موجودی حساب برای انتقال به خزانه کافی نیست.');
  if(!['gold','usd'].includes(a.asset))throw Error('نوع خزانه نامعتبر است.');
  const rate=s.rates[a.asset]; if(!(rate>0))throw Error('نرخ خزانه را ابتدا ثبت کنید.');
  const record={...a,amount,quantity:amount/rate,rate};
  return {...s,allocations:[...s.allocations,record],vault:[...s.vault,{id:a.id,title:'انتقال از '+income.title,kind:a.asset,quantity:amount/rate,account:a.account,allocation:a.id,date:a.date}]};
 }
 if(!s.funds.some(f=>f.id===a.target))throw Error('صندوق مقصد معتبر نیست.');
 return {...s,allocations:[...s.allocations,{...a,amount}]};
}
export function removeRecord(s,type,id) {
 const item=s[type]?.find(x=>x.id===id); if(!item)throw Error('رکورد پیدا نشد.');
 if(type==='accounts'&&(s.transactions.some(t=>t.account===id||t.destination===id)||s.allocations.some(a=>a.account===id)||s.vault.some(v=>v.account===id)))throw Error('حساب دارای سابقه مالی قابل حذف نیست.');
 if(type==='funds'&&(s.allocations.some(a=>a.target===id)||s.transactions.some(t=>t.fund===id)))throw Error('صندوق استفاده‌شده قابل حذف نیست.');
 if(type==='sources'&&s.transactions.some(t=>t.source===id))throw Error('منبع استفاده‌شده قابل حذف نیست.');
 if(type==='transactions'&&s.allocations.some(a=>a.income===id))throw Error('ابتدا تخصیص‌های این درآمد را حذف کنید.');
 if(type==='vault'&&item.allocation)throw Error('این مورد را از بخش تخصیص بودجه حذف کنید تا حساب هم اصلاح شود.');
 let next={...s,[type]:s[type].filter(x=>x.id!==id)};
 if(type==='allocations')next.vault=s.vault.filter(v=>v.allocation!==id);
 if(next.accounts.some(a=>balance(next,a.id)<0))throw Error('حذف، موجودی یک حساب را منفی می‌کند.');
 if(next.funds.some(f=>fundBalance(next,f.id)<0))throw Error('این بودجه مصرف شده؛ ابتدا هزینه مرتبط را اصلاح کنید.');
 return next;
}
export function validateState(s) {
 if(!s||s.version!==1||!s.rates||collections.some(k=>!Array.isArray(s[k])))throw Error('ساختار فایل پشتیبان معتبر نیست.');
 const ids=new Set();
 for(const key of collections)for(const r of s[key]){
  if(!r||typeof r.id!=='string'||ids.has(key+':'+r.id))throw Error('شناسه رکورد نامعتبر یا تکراری است.'); ids.add(key+':'+r.id);
  for(const [k,v]of Object.entries(r)){if(['__proto__','constructor','prototype'].includes(k))throw Error('فایل نامعتبر است.');if(typeof v==='number'&&(!Number.isFinite(v)||v<0))throw Error('مقدار عددی نامعتبر است.');if(v!==null&&typeof v==='object')throw Error('رکورد نامعتبر است.');}
 }
 for(const key of ['usd','gold','coin'])if(typeof s.rates[key]!=='number'||!Number.isFinite(s.rates[key])||s.rates[key]<0)throw Error('نرخ نامعتبر است.');
 for(const t of s.transactions){if(!['income','expense','transfer'].includes(t.kind)||typeof t.amount!=='number'||t.amount<=0||!s.accounts.some(a=>a.id===t.account)||!Number.isFinite(Date.parse(t.date)))throw Error('تراکنش پشتیبان معتبر نیست.');if(t.kind==='transfer'&&(!s.accounts.some(a=>a.id===t.destination)||t.account===t.destination))throw Error('انتقال نامعتبر است.');}
 for(const a of s.allocations){const t=s.transactions.find(t=>t.id===a.income&&t.kind==='income');if(!t||a.account!==t.account||!(a.amount>0)||allocated(s,t.id)>t.amount||(a.target!=='vault'&&!s.funds.some(f=>f.id===a.target)))throw Error('تخصیص نامعتبر است.');}
 if(s.accounts.some(a=>balance(s,a.id)<0)||s.funds.some(f=>fundBalance(s,f.id)<0))throw Error('موجودی پشتیبان ناسازگار است.');
 return s;
}
export function filteredTransactions(s,from,to,kind='all') {return s.transactions.filter(t=>(kind==='all'?t.kind!=='transfer':t.kind===kind)&&(!from||t.date>=from)&&(!to||t.date<=to)).sort((a,b)=>b.date.localeCompare(a.date));}
