import test from 'node:test';
import assert from 'node:assert/strict';
import {dateKey,addDays,startOfWeek,DEFAULT_SETTINGS,minutes,clock,blocksForDate,freeWindows,conflicts,suggestSchedule,seedEntries,habitDue,habitStats,waterTotal,mealPlan,validateEntry,safeURL,sleepHours,weekSummary} from '../src/lib/domain.js';
const task=(id,minutesValue=25,priority='normal',date='2026-10-19',extra={})=>({id,type:'task',entry_date:date,created_at:'2026-10-18T13:00:00Z',data:{title:id,minutes:minutesValue,priority,...extra}});
const block=(id,start,end,days=[1])=>({id,type:'block',entry_date:null,data:{title:id,area:'Pessoal',start,end,days}});
test('dias usam o fuso da conta em vez de UTC',()=>{
 assert.equal(dateKey(new Date('2026-10-19T01:30:00Z'),'America/Fortaleza'),'2026-10-18');
 assert.equal(dateKey(new Date('2026-10-19T01:30:00Z'),'Europe/Lisbon'),'2026-10-19');
});
test('semana, virada de ano e ano bissexto mantêm datas locais',()=>{
 assert.equal(startOfWeek('2026-10-18'),'2026-10-12');
 assert.equal(addDays('2026-12-31',1),'2027-01-01');
 assert.equal(addDays('2024-02-28',1),'2024-02-29');
 assert.equal(addDays('2026-03-01',-1),'2026-02-28');
});
test('trabalho não perde a pausa de almoço e não ocupa o domingo',()=>{
 const s=DEFAULT_SETTINGS;
 const monday=blocksForDate([],'2026-10-19',s);
 assert.deepEqual(monday.map(b=>[b.start,b.end]),[[480,720],[720,780],[780,1020]]);
 assert.equal(blocksForDate([],'2026-10-18',s).length,0);
});
test('janelas livres unem sobreposições e incluem o intervalo de respiro',()=>{
 const busy=[{start:480,end:720},{start:710,end:800},{start:800,end:900}];
 assert.deepEqual(freeWindows(busy,420,1080,10),[[420,470],[910,1080]]);
 assert.deepEqual(conflicts([{id:'a',start:0,end:10},{id:'b',start:10,end:20}]),[]);
});
test('encaixe respeita trabalho, cachorro, ateliê e hora de descanso',()=>{
 const entries=[block('dog','17:15','17:50'),block('atelier','19:00','21:00'),task('prioridade',45,'high'),task('normal',20)];
 const proposal=suggestSchedule(entries,'2026-10-19',DEFAULT_SETTINGS,17*60);
 assert.equal(proposal.scheduled[0].time,'18:00');
 assert.equal(proposal.scheduled[1].time,'21:10');
 for(const {task:t,time} of proposal.scheduled){
  const start=minutes(time),end=start+t.data.minutes;
  assert.ok(end<=minutes(DEFAULT_SETTINGS.bedTime));
  assert.ok(blocksForDate(entries,'2026-10-19',DEFAULT_SETTINGS).every(b=>end<=b.start||start>=b.end));
 }
});
test('encaixe preserva tarefas já agendadas e limita novas prioridades',()=>{
 const entries=[task('fixa',60,'normal','2026-10-19',{time:'18:00'}),...['a','b','c','d'].map(x=>task(x,15))];
 const p=suggestSchedule(entries,'2026-10-19',DEFAULT_SETTINGS,17*60,3);
 assert.equal(p.scheduled.length,3);assert.equal(p.unplaced.length,1);
 assert.ok(p.scheduled.every(x=>x.task.id!=='fixa'));
});
test('não inventa espaço quando a tarefa é maior que a janela',()=>{
 const p=suggestSchedule([task('grande',90)],'2026-10-19',{...DEFAULT_SETTINGS,bedTime:'18:00'},17*60+20);
 assert.equal(p.scheduled.length,0);assert.equal(p.unplaced.length,1);
});
test('o encaixe deixa tempo disponível para os hábitos ainda pendentes',()=>{
 const entries=[{id:'h',type:'habit',data:{title:'Meu cuidado',minutes:30,days:[0]}},task('a',25,'high','2026-10-18'),task('b',25,'normal','2026-10-18')];
 const settings={...DEFAULT_SETTINGS,wakeTime:'09:00',bedTime:'10:00',bufferMinutes:0};
 const result=suggestSchedule(entries,'2026-10-18',settings);
 assert.equal(result.scheduled.length,1);assert.equal(result.unplaced.length,1);
});
test('sugestões iniciais reservam o cachorro diariamente e não fabricam progresso',()=>{
 const entries=seedEntries('2026-10-18',DEFAULT_SETTINGS);
 assert.equal(entries.filter(e=>e.type==='habit_log'||e.type==='water'||e.type==='study').length,0);
 assert.equal(entries.find(e=>e.data.title.includes('cachorro')).data.days.length,7);
});
test('hábitos não cobram dias de descanso nem dias anteriores ao começo',()=>{
 const h={id:'h',type:'habit',data:{days:[1,3],startDate:'2026-10-19'}};
 assert.equal(habitDue(h,'2026-10-18'),false);
 assert.equal(habitDue(h,'2026-10-19'),true);
 assert.equal(habitDue(h,'2026-10-20'),false);
 const e=[h,{type:'habit_log',entry_date:'2026-10-19',data:{habitId:'h'}}];
 assert.deepEqual(habitStats(e,'2026-10-19',3),{due:2,done:1,percent:50});
});
test('editar os dias de um hábito preserva a programação anterior',()=>{
 const h={data:{days:[2],startDate:'2026-10-12',scheduleHistory:[{from:'2026-10-12',days:[1]},{from:'2026-10-20',days:[2]}]}};
 assert.equal(habitDue(h,'2026-10-19'),true);
 assert.equal(habitDue(h,'2026-10-26'),false);
 assert.equal(habitDue(h,'2026-10-27'),true);
});
test('água é somada por dia e a revisão não inclui dias futuros',()=>{
 const entries=[{type:'water',entry_date:'2026-10-19',data:{ml:500}},{type:'water',entry_date:'2026-10-19',data:{ml:1500}},{type:'water',entry_date:'2026-10-20',data:{ml:3000}}];
 assert.equal(waterTotal(entries,'2026-10-19'),2000);
 const s=weekSummary(entries,'2026-10-19','2026-10-19',2000);
 assert.equal(s.observedDays,1);assert.equal(s.waterDays,1);
});
test('cardápios mantêm slots e porções ao atravessar semanas',()=>{
 const entries=[{type:'meal',entry_date:'2026-10-18',data:{slot:'lunch',recipeId:'07',portions:2}},{type:'meal',entry_date:'2026-10-19',data:{slot:'dinner',recipeId:'41',portions:1}}];
 assert.deepEqual(mealPlan(entries,'2026-10-12'),{'6:lunch':{recipeId:'07',portions:2}});
});
test('URLs de recursos não aceitam javascript e registros rejeitam datas inexistentes',()=>{
 assert.equal(safeURL('javascript:alert(1)'),'');assert.equal(safeURL('https://example.com'),'https://example.com/');
 assert.throws(()=>validateEntry({type:'water',entry_date:'2026-02-30',data:{ml:250}}),/Data inválida/);
 assert.throws(()=>validateEntry({type:'water',entry_date:'2026-10-18',data:{ml:-2}}),/quantidade/);
 assert.throws(()=>validateEntry({type:'admin',entry_date:null,data:{}}),/Tipo/);
});
test('sono atravessa meia-noite e permanece ausente quando não foi registrado',()=>{
 assert.equal(sleepHours('23:00','07:00'),8);
 assert.equal(sleepHours('00:30','06:45'),6.3);
 assert.equal(sleepHours('','07:00'),null);
});
