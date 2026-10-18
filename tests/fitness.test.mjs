import test from 'node:test';
import assert from 'node:assert/strict';
import {activityRecords,addDays,blocksForDate,DEFAULT_SETTINGS,putDatedValue,waterGoalForDate,weekSummary} from '../src/lib/domain.js';
import {completedWaterDays,fitnessWeek,hydrationStats,medalCatalogue,movementSeries,plannedMovement,reviseFitnessPlan} from '../src/lib/fitness.js';

const activity=(date,kind='Academia',minutes=40,id=date+kind)=>({id,type:'activity',entry_date:date,created_at:date+'T20:00:00Z',data:{title:kind,kind,minutes}});
const water=(date,ml=2000,id=date)=>({id,type:'water',entry_date:date,data:{ml}});
const goals={...DEFAULT_SETTINGS,fitnessGoalHistory:[{from:'2026-10-12',gym:2,walk:1,minutes:90}]};
const values={title:'Academia',days:[1,3],start:'18:50',end:'19:30',active:true,fitness:{kind:'Academia'}};
const plan={id:'plan',type:'block',data:reviseFitnessPlan(null,values,'2026-10-19')};
const earned=(entries,settings,today,id)=>medalCatalogue(entries,settings,today).find(m=>m.id===id);

test('reservar horários não fabrica exercícios nem medalhas',()=>{
  assert.equal(plannedMovement([plan],'2026-10-19').length,1);
  assert.equal(activityRecords([plan]).length,0);
  assert.equal(earned([plan],goals,'2026-10-20','first-move').earnedOn,null);
});
test('o plano respeita a data inicial e os dias escolhidos',()=>{
  assert.equal(plannedMovement([plan],'2026-10-12').length,0);
  assert.equal(plannedMovement([plan],'2026-10-19')[0].minutes,40);
  assert.equal(plannedMovement([plan],'2026-10-20').length,0);
});
test('editar dias e horário conserva a programação anterior',()=>{
  const next={...plan,data:reviseFitnessPlan(plan.data,{...values,days:[2],start:'19:00',end:'19:45'},'2026-10-26')};
  assert.equal(plannedMovement([next],'2026-10-19')[0].start,'18:50');
  assert.equal(plannedMovement([next],'2026-10-26').length,0);
  assert.equal(plannedMovement([next],'2026-10-27')[0].minutes,45);
  assert.equal(plan.data.scheduleHistory.length,1);
});
test('pausar o plano não apaga as sessões previstas no passado',()=>{
  const paused={...plan,data:reviseFitnessPlan(plan.data,{...values,active:false},'2026-10-26')};
  assert.equal(plannedMovement([paused],'2026-10-19').length,1);
  assert.equal(plannedMovement([paused],'2026-10-26').length,0);
});
test('os exercícios ocupam os mesmos horários na agenda geral',()=>{
  const block=blocksForDate([plan],'2026-10-19',DEFAULT_SETTINGS).find(b=>b.id==='plan');
  assert.equal(block.start,18*60+50);assert.equal(block.end,19*60+30);assert.equal(block.area,'Saúde');
});
test('a conclusão planejada usa duração real e entra também na revisão semanal',()=>{
  const log={id:'log',type:'block_log',entry_date:'2026-10-19',data:{blockId:'plan',activity:{title:'Meu treino',kind:'Academia',minutes:25}}};
  assert.equal(activityRecords([plan,log])[0].data.minutes,25);
  assert.equal(activityRecords([plan,log])[0].id,'log');
  assert.equal(fitnessWeek([plan,log],goals,'2026-10-19','2026-10-19').gym,1);
  assert.equal(weekSummary([plan,log],'2026-10-19','2026-10-19',2000).movement,25);
});
test('marcações de compromissos sem registro de exercício não contam como movimento',()=>{
  const entries=[{type:'block_log',entry_date:'2026-10-19',data:{blockId:'dog'}}];
  assert.equal(activityRecords(entries).length,0);
});
test('os treinos de força já registrados continuam contando como academia',()=>{
  assert.equal(fitnessWeek([activity('2026-10-19','Treino de força')],goals,'2026-10-19','2026-10-19').gym,1);
});
test('registros futuros não antecipam metas, etapas ou medalhas',()=>{
  const entries=[activity('2026-10-20'),water('2026-10-20')];
  assert.equal(fitnessWeek(entries,goals,'2026-10-19','2026-10-19').sessions,0);
  assert.equal(completedWaterDays(entries,goals,'2026-10-19').length,0);
  assert.ok(medalCatalogue(entries,goals,'2026-10-19').every(m=>!m.earnedOn));
});
test('a meta semanal exige todos os critérios ativos e ignora os zerados',()=>{
  const entries=[activity('2026-10-12'),activity('2026-10-14'),activity('2026-10-15','Caminhada',20)];
  assert.equal(fitnessWeek(entries,goals,'2026-10-12','2026-10-18').reached,true);
  assert.equal(earned(entries,goals,'2026-10-18','fitness-week').earnedOn,'2026-10-15');
  assert.equal(fitnessWeek(entries.slice(0,2),goals,'2026-10-12','2026-10-18').reached,false);
  assert.equal(fitnessWeek(entries,{fitnessGoalHistory:[{from:'2026-10-12',gym:2,walk:0,minutes:0}]},'2026-10-12','2026-10-18').reached,true);
});
test('metas sugeridas não concedem a medalha semanal antes de serem salvas',()=>{
  assert.equal(earned([activity('2026-10-12')],DEFAULT_SETTINGS,'2026-10-18','fitness-week').earnedOn,null);
});
test('uma meta maior na semana seguinte preserva medalhas de semanas anteriores',()=>{
  const entries=[activity('2026-10-12'),activity('2026-10-14'),activity('2026-10-15','Caminhada',20),activity('2026-10-19')];
  const settings={...goals,fitnessGoalHistory:[...goals.fitnessGoalHistory,{from:'2026-10-19',gym:3,walk:2,minutes:180}]};
  const medal=earned(entries,settings,'2026-10-20','fitness-week');
  assert.equal(medal.awardCount,1);assert.equal(medal.earnedOn,'2026-10-15');assert.ok(medal.current<100);
});
test('um dia com vários copos ou volume acima da meta só conta uma vez',()=>{
  const entries=[water('2026-10-19',1000,'a'),water('2026-10-19',1500,'b'),water('2026-10-20',500)];
  assert.deepEqual(completedWaterDays(entries,goals,'2026-10-20'),['2026-10-19']);
});
test('dias incompletos e quantidades inválidas não liberam conquistas de hidratação',()=>{
  assert.equal(earned([water('2026-10-19',1999),water('2026-10-20',NaN)],goals,'2026-10-20','water-first').earnedOn,null);
});
test('o desafio semanal não mistura domingo e segunda de semanas diferentes',()=>{
  const settings={...goals,waterWeekHistory:[{from:'0001-01-01',target:2}]};
  assert.equal(earned([water('2026-10-18'),water('2026-10-19')],settings,'2026-10-19','water-week').awardCount,0);
  const medal=earned([water('2026-10-18'),water('2026-10-19'),water('2026-10-21')],settings,'2026-10-21','water-week');
  assert.equal(medal.awardCount,1);assert.equal(medal.earnedOn,'2026-10-21');
});
test('o desafio mensal usa meses de calendário, inclusive na virada do ano',()=>{
  const settings={...goals,waterMonthHistory:[{from:'0001-01-01',target:2}]};
  const entries=[water('2026-12-31'),water('2027-01-01')];
  assert.equal(earned(entries,settings,'2027-01-01','water-month').awardCount,0);
  assert.equal(earned([...entries,water('2027-01-03')],settings,'2027-01-03','water-month').earnedOn,'2027-01-03');
});
test('medalhas de semana se repetem e preservam o critério de cada período',()=>{
  const settings={...goals,waterWeekHistory:[{from:'0001-01-01',target:2},{from:'2026-10-19',target:3}]};
  const entries=['2026-10-12','2026-10-14','2026-10-19','2026-10-21','2026-10-23'].map(d=>water(d));
  const medal=earned(entries,settings,'2026-10-23','water-week');
  assert.equal(medal.awardCount,2);assert.equal(medal.target,3);assert.equal(medal.earnedOn,'2026-10-23');
});
test('mudar a meta diária preserva a contagem dos dias anteriores',()=>{
  const settings={...goals,waterGoal:2500,waterGoalHistory:putDatedValue(null,'2026-10-20',{goal:2500},{goal:2000})};
  const entries=[water('2026-10-19',2000),water('2026-10-20',2000)];
  assert.equal(waterGoalForDate(settings,'2026-10-19'),2000);assert.equal(waterGoalForDate(settings,'2026-10-20'),2500);
  assert.deepEqual(completedWaterDays(entries,settings,'2026-10-20'),['2026-10-19']);
  assert.equal(weekSummary(entries,'2026-10-19','2026-10-20',settings).waterDays,1);
});
test('a sequência permanece até ontem enquanto o dia de hoje está em andamento',()=>{
  const entries=['2026-10-17','2026-10-18','2026-10-19'].map(d=>water(d));
  assert.equal(hydrationStats(entries,goals,'2026-10-20').streak,3);
  assert.equal(hydrationStats(entries,goals,'2026-10-21').streak,0);
  assert.equal(hydrationStats(entries,goals,'2026-10-21').best,3);
});
test('as etapas registram a data real da quinta atividade e a exclusão recalcula a medalha',()=>{
  const entries=Array.from({length:5},(_,i)=>activity(addDays('2026-10-12',i),'Caminhada',20));
  assert.equal(earned(entries,goals,'2026-10-18','walk-5').earnedOn,'2026-10-16');
  assert.equal(earned(entries,goals,'2026-10-18','move-5').earnedOn,'2026-10-16');
  assert.equal(earned(entries.slice(0,4),goals,'2026-10-18','walk-5').earnedOn,null);
});
test('o gráfico de oito semanas não inventa dados onde não houve registros',()=>{
  const series=movementSeries([activity('2026-10-19')],goals,'2026-10-20');
  assert.equal(series.length,8);assert.equal(series.at(-1).minutes,40);assert.ok(series.slice(0,-1).every(w=>w.minutes===0));
});
