export const AREAS = ['Pessoal','Trabalho','Ateliê','Casa','Estudos','Saúde','Lazer'];
export const DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
export const DEFAULT_SETTINGS = {
  timezone:'America/Fortaleza', waterGoal:2000, glassSize:250, waterInterval:90,
  wakeTime:'07:00', bedTime:'23:00', workStart:'08:00', workEnd:'17:00',
  lunchStart:'12:00', lunchMinutes:60, workDays:[1,2,3,4,5],
  dogTime:'17:15', dogMinutes:35, bufferMinutes:10,
};
export const TYPES = ['task','habit','habit_log','water','meal','goal','study','activity','checkin','resource','shopping','atelier','block','block_log','favorite'];
export const uid = () => crypto.randomUUID();
export function dateKey(date = new Date(), timezone = 'America/Fortaleza') {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(x=>[x.type,x.value]));
  return p.year+'-'+p.month+'-'+p.day;
}
export const parseDay = key => new Date(key+'T12:00:00');
export function addDays(key, count) {
  const d = parseDay(key); d.setDate(d.getDate()+count);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
export const startOfWeek = key => addDays(key,-((parseDay(key).getDay()+6)%7));
export const dayList = (key,count=7) => Array.from({length:count},(_,i)=>addDays(key,i));
export const fmtDate = (key,opts={day:'numeric',month:'short'}) => parseDay(key).toLocaleDateString('pt-BR',opts);
export const minutes = time => { const [h,m]=String(time||'00:00').split(':').map(Number); return h*60+m; };
export const clock = value => String(Math.floor(Math.max(0,value)/60)%24).padStart(2,'0')+':'+String(Math.round(value)%60).padStart(2,'0');
export const durationLabel = n => n>=60 ? Math.floor(n/60)+'h'+(n%60 ? ' '+n%60+'min' : '') : n+'min';
export const percent = (n,total) => total ? Math.min(100,Math.round(n/total*100)) : 0;
export const num = (n,max=1) => Math.min(max,Math.max(0,Number(n)||0));
export const safeURL = value => { try { const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:''; } catch {return '';} };
export const recordsOf = (entries,type,date) => entries.filter(e=>e.type===type&&(date===undefined||e.entry_date===date));
export const waterTotal = (entries,date) => recordsOf(entries,'water',date).reduce((s,e)=>s+Number(e.data.ml||0),0);
export function habitDue(habit, date) {
  const history=habit.data.scheduleHistory?.filter(s=>s.from<=date).sort((a,b)=>a.from.localeCompare(b.from));
  const days=history?.at(-1)?.days||habit.data.days||[0,1,2,3,4,5,6];
  return !habit.data.archived && (!habit.data.startDate||habit.data.startDate<=date) && days.includes(parseDay(date).getDay());
}
export const isHabitDone = (entries,id,date) => entries.some(e=>e.type==='habit_log'&&e.entry_date===date&&e.data.habitId===id);
export function habitStats(entries,start,count=7) {
  let due=0,done=0;
  for(const d of dayList(start,count)) for(const h of recordsOf(entries,'habit')) if(habitDue(h,d)){due++;if(isHabitDone(entries,h.id,d))done++;}
  return {due,done,percent:percent(done,due)};
}
export function sleepHours(bed,wake) {
  if(!bed||!wake) return null;
  let n=minutes(wake)-minutes(bed); if(n<=0)n+=1440;
  return Math.round(n/60*10)/10;
}
export function blocksForDate(entries, date, settings) {
  const s={...DEFAULT_SETTINGS,...settings}, day=parseDay(date).getDay(), blocks=[];
  if(s.workDays.includes(day)) {
    const lunch=minutes(s.lunchStart), endLunch=lunch+Number(s.lunchMinutes);
    blocks.push({id:'work-am',title:'Trabalho · home office',area:'Trabalho',start:minutes(s.workStart),end:Math.min(lunch,minutes(s.workEnd)),fixed:true});
    blocks.push({id:'lunch',title:'Almoço e pausa',area:'Saúde',start:lunch,end:endLunch,fixed:true});
    if(endLunch<minutes(s.workEnd))blocks.push({id:'work-pm',title:'Trabalho · home office',area:'Trabalho',start:endLunch,end:minutes(s.workEnd),fixed:true});
  }
  for(const e of recordsOf(entries,'block')) {
    if(e.data.active===false||!(e.data.days||[]).includes(day))continue;
    blocks.push({...e.data,id:e.id,start:minutes(e.data.start),end:minutes(e.data.end),record:e});
  }
  for(const e of recordsOf(entries,'task',date)) if(!e.data.done&&e.data.time) {
    const start=minutes(e.data.time);
    blocks.push({id:e.id,title:e.data.title,area:e.data.area,start,end:start+Number(e.data.minutes||25),task:e,record:e});
  }
  return blocks.filter(b=>b.end>b.start).sort((a,b)=>a.start-b.start);
}
export function mergedIntervals(blocks, from, to, buffer=0) {
  const sorted=blocks.map(b=>[Math.max(from,b.start-buffer),Math.min(to,b.end+buffer)]).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]);
  const merged=[];
  for(const current of sorted){const prev=merged.at(-1);if(prev&&current[0]<=prev[1])prev[1]=Math.max(prev[1],current[1]);else merged.push([...current]);}
  return merged;
}
export function freeWindows(blocks, from, to, buffer=0) {
  const busy=mergedIntervals(blocks,from,to,buffer),windows=[];let cursor=from;
  for(const [a,b] of busy){if(a>cursor)windows.push([cursor,a]);cursor=Math.max(cursor,b);}
  if(cursor<to)windows.push([cursor,to]);return windows;
}
export function conflicts(blocks) {
  const pairs=[];
  for(let i=0;i<blocks.length;i++)for(let j=i+1;j<blocks.length;j++)if(blocks[i].start<blocks[j].end&&blocks[j].start<blocks[i].end)pairs.push([blocks[i],blocks[j]]);
  return pairs;
}
export function suggestSchedule(entries,date,settings,nowMinute=null,limit=3) {
  const s={...DEFAULT_SETTINGS,...settings};
  const windows=freeWindows(blocksForDate(entries,date,s),Math.max(minutes(s.wakeTime),nowMinute||0),minutes(s.bedTime),Number(s.bufferMinutes));
  const candidates=recordsOf(entries,'task',date).filter(e=>!e.data.done&&!e.data.time).sort((a,b)=>Number(b.data.priority==='high')-Number(a.data.priority==='high')||a.created_at?.localeCompare(b.created_at||'')||0);
  const scheduled=[],unplaced=[];
  const habitReserve=recordsOf(entries,'habit').filter(h=>habitDue(h,date)&&!isHabitDone(entries,h.id,date)).reduce((sum,h)=>sum+Number(h.data.minutes||10),0);
  let remainingCapacity=windows.reduce((sum,[a,b])=>sum+b-a,0);
  for(const task of candidates) {
    if(scheduled.length>=limit){unplaced.push(task);continue;}
    const length=Number(task.data.minutes||25),win=windows.find(w=>w[1]-w[0]>=length);
    if(win&&remainingCapacity-length-Number(s.bufferMinutes)>=habitReserve){scheduled.push({task,time:clock(win[0])});win[0]+=length+Number(s.bufferMinutes);remainingCapacity-=length+Number(s.bufferMinutes);}
    else unplaced.push(task);
  }
  return {scheduled,unplaced};
}
export function seedEntries(today,settings=DEFAULT_SETTINGS) {
  const base=(type,data,entry_date=null)=>({id:uid(),type,data,entry_date});
  const daily=[0,1,2,3,4,5,6];
  const dogStart=minutes(settings.dogTime);
  return [
    base('block',{title:'Café da manhã e começo do dia',area:'Saúde',start:settings.wakeTime,end:clock(minutes(settings.wakeTime)+30),days:daily,active:true}),
    base('block',{title:'Almoço com calma',area:'Saúde',start:settings.lunchStart,end:clock(minutes(settings.lunchStart)+Number(settings.lunchMinutes)),days:[0,6],active:true}),
    base('block',{title:'Passeio com meu cachorro',area:'Pessoal',start:settings.dogTime,end:clock(dogStart+Number(settings.dogMinutes)),days:daily,active:true}),
    base('block',{title:'Jantar e uma pausa',area:'Saúde',start:'18:10',end:'18:40',days:daily,active:true}),
    base('block',{title:'Ateliê · produção com hora para terminar',area:'Ateliê',start:'19:00',end:'21:00',days:[2,4],active:true}),
    base('block',{title:'Ateliê · produção do fim de semana',area:'Ateliê',start:'14:00',end:'17:00',days:[6],active:true}),
    base('block',{title:'Meal prep · preparar a semana',area:'Saúde',start:'10:00',end:'11:30',days:[0],active:true}),
    base('block',{title:'Desacelerar e preparar o amanhã',area:'Pessoal',start:clock(minutes(settings.bedTime)-30),end:settings.bedTime,days:daily,active:true}),
    base('habit',{title:'Organizar um cantinho da casa',area:'Casa',minutes:10,days:[1,2,3,4,5],startDate:today}),
    base('habit',{title:'Movimentar o corpo',area:'Saúde',minutes:15,days:[1,3,5],startDate:today}),
    base('habit',{title:'Ler algumas páginas',area:'Lazer',minutes:10,days:[2,4,0],startDate:today}),
    base('habit',{title:'Estudar um pouco',area:'Estudos',minutes:25,days:[1,3],startDate:today}),
  ];
}
export function mealPlan(entries,week) {
  const result={};
  for(const e of recordsOf(entries,'meal')){const day=dayList(week).indexOf(e.entry_date);if(day>=0)result[day+':'+e.data.slot]={recipeId:e.data.recipeId,portions:e.data.portions||1};}
  return result;
}
export function validateEntry(entry) {
  if(!TYPES.includes(entry.type))throw new Error('Tipo de registro inválido.');
  if(entry.entry_date!==null&&entry.entry_date!==undefined) {
    const d=parseDay(entry.entry_date);
    const normalized=Number.isNaN(d.getTime())?'':d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(entry.entry_date)||normalized!==entry.entry_date)throw new Error('Data inválida.');
  }
  if(!entry.data||Array.isArray(entry.data)||typeof entry.data!=='object')throw new Error('Registro inválido.');
  if(JSON.stringify(entry.data).length>24000)throw new Error('O registro está muito grande. Reduza as anotações.');
  if(entry.type==='water'&&(!Number.isFinite(Number(entry.data.ml))||entry.data.ml<=0||entry.data.ml>5000))throw new Error('Informe uma quantidade de água entre 1 e 5.000 ml.');
  if(['task','habit','goal','resource','atelier','block'].includes(entry.type)&&!String(entry.data.title||'').trim())throw new Error('Informe um título.');
  return entry;
}
export function daysBetween(a,b) { return Math.round((parseDay(b)-parseDay(a))/86400000); }
export function weekSummary(entries,week,today,waterGoal) {
  const dates=dayList(week).filter(d=>d<=today),dateSet=new Set(dates);
  const select=t=>recordsOf(entries,t).filter(e=>dateSet.has(e.entry_date));
  return {
    waterDays:dates.filter(d=>waterTotal(entries,d)>=waterGoal).length,
    focus:select('study').reduce((n,e)=>n+Number(e.data.minutes||0),0),
    movement:select('activity').reduce((n,e)=>n+Number(e.data.minutes||0),0),
    tasks:select('task').filter(e=>e.data.done).length,
    habits:habitStats(entries,week,dates.length),
    observedDays:dates.length,
  };
}
