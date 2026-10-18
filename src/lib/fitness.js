import {activityRecords,addDays,blockDataForDate,datedValue,dayList,daysBetween,minutes,percent,recordsOf,startOfWeek,waterGoalForDate} from './domain.js';

export const MOVEMENT_KINDS=['Academia','Caminhada','Corrida','Mobilidade','Pedalada','Dança','Outro movimento'];
export const DEFAULT_FITNESS_GOALS={gym:2,walk:2,minutes:120};
export const startOfMonth=date=>date.slice(0,7)+'-01';
export function movementKind(kind) {
  if(['Academia','Treino de força'].includes(kind))return 'gym';
  return kind==='Caminhada'?'walk':'other';
}
export function fitnessGoalsForWeek(settings,date) {
  const value=datedValue(settings.fitnessGoalHistory,startOfWeek(date),null);
  return {...DEFAULT_FITNESS_GOALS,...value,configured:!!value};
}
export function fitnessWeek(entries,settings,date,today) {
  const start=startOfWeek(date),end=addDays(start,6),goals=fitnessGoalsForWeek(settings,date);
  const logs=activityRecords(entries).filter(e=>e.entry_date>=start&&e.entry_date<=end&&e.entry_date<=today);
  const gym=logs.filter(e=>movementKind(e.data.kind)==='gym').length,walk=logs.filter(e=>movementKind(e.data.kind)==='walk').length;
  const totalMinutes=logs.reduce((s,e)=>s+Number(e.data.minutes),0);
  const values={gym,walk,minutes:totalMinutes},required=Object.keys(values).filter(k=>Number(goals[k])>0);
  const progress=goals.configured&&required.length?Math.min(...required.map(k=>percent(values[k],goals[k]))):0;
  return {start,end,logs,goals,gym,walk,minutes:totalMinutes,sessions:logs.length,progress,reached:goals.configured&&required.length>0&&required.every(k=>values[k]>=goals[k])};
}
export function fitnessPlans(entries) {return recordsOf(entries,'block').filter(e=>e.data.fitness);}
export function plannedMovement(entries,date) {
  return fitnessPlans(entries).map(record=>({record,data:blockDataForDate(record,date)})).filter(x=>x.data)
    .map(({record,data})=>({id:record.id,record,...data,minutes:minutes(data.end)-minutes(data.start),log:entries.find(e=>e.type==='block_log'&&e.entry_date===date&&e.data.blockId===record.id)}))
    .sort((a,b)=>a.start.localeCompare(b.start));
}
function scheduleSnapshot(data) {
  return {title:data.title,start:data.start,end:data.end,days:[...data.days],active:data.active!==false,fitness:{...data.fitness}};
}
export function reviseFitnessPlan(previous,values,from) {
  const first=previous?.startDate||from;
  const history=previous?.scheduleHistory?.length?previous.scheduleHistory:previous?[{from:first,...scheduleSnapshot(previous)}]:[];
  const next={...previous,...values,area:'Saúde',startDate:first};
  return {...next,scheduleHistory:[...history.filter(x=>x.from!==from),{from,...scheduleSnapshot(next)}].sort((a,b)=>a.from.localeCompare(b.from))};
}
export function completedWaterDays(entries,settings,today) {
  const totals=new Map();
  for(const e of recordsOf(entries,'water'))if(e.entry_date&&e.entry_date<=today){const ml=Number(e.data.ml);if(Number.isFinite(ml)&&ml>0)totals.set(e.entry_date,(totals.get(e.entry_date)||0)+ml);}
  return [...totals.entries()].filter(([date,total])=>total>=waterGoalForDate(settings,date)).map(([date])=>date).sort();
}
export function hydrationStats(entries,settings,today) {
  const days=completedWaterDays(entries,settings,today),success=new Set(days),week=startOfWeek(today),month=startOfMonth(today);
  let streak=0,cursor=success.has(today)?today:addDays(today,-1),best=0,run=0,previous=null;
  while(success.has(cursor)){streak++;cursor=addDays(cursor,-1);}
  for(const date of days){run=previous&&daysBetween(previous,date)===1?run+1:1;best=Math.max(best,run);previous=date;}
  return {days,success,week:days.filter(d=>d>=week).length,month:days.filter(d=>d>=month).length,streak,best,
    weekTarget:Number(datedValue(settings.waterWeekHistory,week,{target:5}).target),
    monthTarget:Number(datedValue(settings.waterMonthHistory,month,{target:20}).target)};
}
function groupBy(items,key) {
  const result=new Map();for(const item of items){const k=key(item);result.set(k,[...(result.get(k)||[]),item]);}return result;
}
function milestone(id,title,category,items,target,detail,level='bronze') {
  const reached=items.length>=target;
  return {id,title,category,current:items.length,target,unit:category==='water'?'dias':'sessões',detail,level,earnedOn:reached?items[target-1].entry_date:null,awardCount:reached?1:0};
}
function recurringWaterMedal(id,title,days,settings,today,period) {
  const key=period==='week'?startOfWeek:startOfMonth,history=period==='week'?settings.waterWeekHistory:settings.waterMonthHistory,fallback=period==='week'?5:20;
  const groups=groupBy(days,key),currentKey=key(today),targetFor=k=>Number(datedValue(history,k,{target:fallback}).target);
  const awards=[...groups.entries()].filter(([k,v])=>v.length>=targetFor(k)).map(([k,v])=>({period:k,date:v[targetFor(k)-1]})).sort((a,b)=>a.date.localeCompare(b.date));
  return {id,title,category:'water',period,current:(groups.get(currentKey)||[]).length,target:targetFor(currentKey),unit:'dias',detail:period==='week'?'Atinja sua meta diária em X dias da mesma semana.':'Atinja sua meta diária em X dias do mesmo mês.',level:period==='week'?'silver':'gold',earnedOn:awards.at(-1)?.date||null,awardCount:awards.length,awards};
}
export function medalCatalogue(entries,settings,today) {
  const logs=activityRecords(entries).filter(e=>e.entry_date<=today),gym=logs.filter(e=>movementKind(e.data.kind)==='gym'),walk=logs.filter(e=>movementKind(e.data.kind)==='walk');
  const water=completedWaterDays(entries,settings,today),waterItems=water.map(entry_date=>({entry_date}));
  const medals=[milestone('first-move','O primeiro passo','exercise',logs,1,'Registre sua primeira atividade.')];
  for(const [kind,label,items] of [['gym','Na academia',gym],['walk','Pelo caminho',walk]]) {
    for(const [i,target] of [5,10,25].entries())medals.push(milestone(kind+'-'+target,label+' · '+target,'exercise',items,target,target+' '+(kind==='gym'?'treinos de academia':'caminhadas')+' registrados.',['bronze','silver','gold'][i]));
  }
  for(const [i,[target,title]] of [[5,'Criando ritmo'],[10,'Passo a passo'],[25,'Caminho firme'],[50,'Minha história continua']].entries())medals.push(milestone('move-'+target,title,'exercise',logs,target,target+' atividades registradas, no seu ritmo.',['bronze','silver','gold','gold'][i]));
  const current=fitnessWeek(entries,settings,today,today),weekGroups=groupBy(logs,e=>startOfWeek(e.entry_date)),awards=[];
  for(const [week,items] of weekGroups){
    if(!fitnessWeek(entries,settings,week,today).reached)continue;
    const dates=[...new Set(items.map(e=>e.entry_date))].sort();
    const reached=dates.find(date=>fitnessWeek(entries,settings,week,date).reached);
    if(reached)awards.push({period:week,date:reached});
  }
  awards.sort((a,b)=>a.date.localeCompare(b.date));
  medals.push({id:'fitness-week',title:'Sua semana de movimento',category:'exercise',period:'week',current:current.progress,target:100,unit:'%',detail:'Cumpra as metas semanais de academia, caminhada e minutos que você definiu.',level:'gold',earnedOn:awards.at(-1)?.date||null,awardCount:awards.length,awards,needsSetup:!current.goals.configured});
  medals.push(milestone('water-first','Um dia de cuidado','water',waterItems,1,'Atinja sua meta diária de água pela primeira vez.'));
  medals.push(recurringWaterMedal('water-week','Uma semana bem cuidada',water,settings,today,'week'));
  medals.push(recurringWaterMedal('water-month','Um mês de cuidado',water,settings,today,'month'));
  for(const [i,target] of [7,30,100].entries())medals.push(milestone('water-'+target,'Cada dia conta · '+target,'water',waterItems,target,target+' dias com a meta de água, sem precisar ser consecutivos.',['bronze','silver','gold'][i]));
  return medals;
}
export function movementSeries(entries,settings,today,count=8) {
  return Array.from({length:count},(_,i)=>fitnessWeek(entries,settings,addDays(startOfWeek(today),(i-count+1)*7),today));
}
