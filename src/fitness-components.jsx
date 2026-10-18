import React,{useRef,useState} from 'react';
import {Check,CalendarDays,Dumbbell,Droplets} from 'lucide-react';
import {useRoutine} from './store.jsx';
import {Button,DaysInput,Field,Modal} from './components.jsx';
import {addDays,blockDataForDate,blocksForDate,clock,conflicts,datedValue,dayList,fmtDate,minutes,parseDay,putDatedValue,startOfWeek,waterGoalForDate} from './lib/domain.js';
import {fitnessGoalsForWeek,hydrationStats,MOVEMENT_KINDS,reviseFitnessPlan,startOfMonth} from './lib/fitness.js';

export function WellnessGoalsForm({today,onClose}) {
  const {settings,profile,saveProfile,pending,flash}=useRoutine(),baseline=useRef(profile.revision);
  const goals=fitnessGoalsForWeek(settings,today),water=hydrationStats([],settings,today);
  const [v,setV]=useState({gym:goals.gym,walk:goals.walk,minutes:goals.minutes,waterGoal:waterGoalForDate(settings,today),waterWeek:water.weekTarget,waterMonth:water.monthTarget});
  const set=(key,value)=>setV(p=>({...p,[key]:value}));
  async function submit(e) {
    e.preventDefault();const values=Object.fromEntries(Object.entries(v).map(([k,n])=>[k,Number(n)]));
    if(!values.gym&&!values.walk&&!values.minutes){flash('Defina pelo menos uma meta de movimento. Use zero nas que não quiser acompanhar.');return;}
    const ok=await saveProfile({settings:{waterGoal:values.waterGoal,
      fitnessGoalHistory:putDatedValue(settings.fitnessGoalHistory,startOfWeek(today),{gym:values.gym,walk:values.walk,minutes:values.minutes}),
      waterWeekHistory:putDatedValue(settings.waterWeekHistory,startOfWeek(today),{target:values.waterWeek},{target:5}),
      waterMonthHistory:putDatedValue(settings.waterMonthHistory,startOfMonth(today),{target:values.waterMonth},{target:20})}},baseline.current);
    if(ok){flash('Metas salvas. Cada registro agora mostra o seu próximo passo.');onClose();}
  }
  return <Modal title="Metas que cabem na sua semana" onClose={onClose}><form onSubmit={submit}>
    <div className="fitness-form-label"><Dumbbell size={19}/><h3>Meu movimento</h3></div>
    <p className="muted">Escolha seu ponto de partida. Estes números são editáveis; zero deixa uma meta de fora.</p>
    <div className="form-grid"><Field label="Treinos de academia por semana"><input autoFocus type="number" min="0" max="14" required value={v.gym} onChange={e=>set('gym',e.target.value)}/></Field><Field label="Caminhadas por semana"><input type="number" min="0" max="14" required value={v.walk} onChange={e=>set('walk',e.target.value)}/></Field></div>
    <Field label="Minutos de movimento por semana" hint="Somam academia, caminhada e outras atividades registradas."><input type="number" min="0" max="3000" required value={v.minutes} onChange={e=>set('minutes',e.target.value)}/></Field>
    <div className="fitness-form-label"><Droplets size={19}/><h3>Meu cuidado com a água</h3></div>
    <Field label="Minha meta diária de água (ml)" hint="Use a meta adequada para você. Ela também será atualizada em Preferências."><input type="number" required min="250" max="8000" step="50" value={v.waterGoal} onChange={e=>set('waterGoal',e.target.value)}/></Field>
    <div className="form-grid"><Field label="Dias com a meta na semana"><input type="number" required min="1" max="7" value={v.waterWeek} onChange={e=>set('waterWeek',e.target.value)}/></Field><Field label="Dias com a meta no mês"><input type="number" required min="1" max="31" value={v.waterMonth} onChange={e=>set('waterMonth',e.target.value)}/></Field></div>
    <p className="muted">As metas semanais valem nesta semana; a mensal, neste mês. Períodos anteriores mantêm seus critérios. A meta diária de água muda a partir de hoje.</p>
    <div className="form-actions"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={!!pending}>Salvar minhas metas</Button></div>
  </form></Modal>;
}

export function ExercisePlanForm({plan=null,preset=null,date,today,onClose}) {
  const {entries,settings,save,pending,flash}=useRoutine(),firstDate=date&&date>today?date:today;
  const effectiveDate=plan?.data.startDate>today?plan.data.startDate:today;
  const current=plan?{...plan.data,...datedValue(plan.data.scheduleHistory,effectiveDate)}:null;
  const baseline=useRef({id:plan?.id,revision:plan?.revision,data:plan?.data});
  const [v,setV]=useState({title:'',kind:'Academia',days:[parseDay(firstDate).getDay()],start:'18:50',minutes:40,from:firstDate,notes:'',active:true,
    ...(preset||{}),...(current?{title:current.title,kind:current.fitness.kind,days:current.days,start:current.start,minutes:minutes(current.end)-minutes(current.start),from:effectiveDate,notes:current.fitness.notes||'',active:current.active!==false}:{})});
  const set=(key,value)=>setV(p=>({...p,[key]:value}));
  const duration=Number(v.minutes),end=minutes(v.start)+duration;
  const candidate={id:plan?.id||'new-fitness',type:'block',data:{title:v.title||v.kind,area:'Saúde',start:v.start,end:clock(end),days:v.days,active:v.active,startDate:v.from,fitness:{kind:v.kind}}};
  const clashes=dayList(startOfWeek(v.from),14).filter(d=>d>=v.from).flatMap(d=>{
    const own=blockDataForDate(candidate,d);if(!own||end>=1440)return [];
    const planned={id:candidate.id,title:own.title,start:minutes(v.start),end};
    return conflicts([...blocksForDate(entries.filter(e=>e.id!==plan?.id),d,settings),planned]).filter(pair=>pair.some(b=>b.id===candidate.id)).map(pair=>({date:d,title:pair.find(b=>b.id!==candidate.id).title}));
  });
  async function submit(e) {
    e.preventDefault();if(!v.days.length||end>=1440||duration<1){flash('Escolha os dias e um horário que termine antes da meia-noite.');return;}
    const values={title:v.title.trim()||v.kind,start:v.start,end:clock(end),days:v.days,active:v.active,fitness:{kind:v.kind,notes:v.notes.trim()}};
    const data=reviseFitnessPlan(baseline.current.data,values,v.from);
    if(await save('block',data,null,baseline.current.id,baseline.current.revision)){flash('Atividade reservada também em Minha semana.');onClose();}
  }
  return <Modal title={plan?'Ajustar meu plano de exercício':'Reservar tempo para me movimentar'} onClose={onClose}><form onSubmit={submit}>
    <Field label="Nome da atividade"><input autoFocus required maxLength="180" value={v.title} placeholder="Ex.: academia depois do expediente" onChange={e=>set('title',e.target.value)}/></Field>
    <div className="form-grid"><Field label="Modalidade"><select value={v.kind} onChange={e=>set('kind',e.target.value)}>{MOVEMENT_KINDS.map(k=><option key={k}>{k}</option>)}</select></Field><Field label={plan?'Mudança a partir de':'Começar a partir de'}><input type="date" required min={plan?effectiveDate:today} value={v.from} onChange={e=>e.target.value&&set('from',e.target.value)}/></Field></div>
    <Field label="Dias da semana"><DaysInput value={v.days} onChange={days=>set('days',days)}/></Field>
    <div className="form-grid"><Field label="Horário de início"><input type="time" required value={v.start} onChange={e=>set('start',e.target.value)}/></Field><Field label="Tempo reservado (min)"><input type="number" required min="1" max="480" value={v.minutes} onChange={e=>set('minutes',e.target.value)}/></Field></div>
    <Field label="Lembrete para mim (opcional)"><textarea rows="2" maxLength="1500" placeholder="Ex.: separar tênis e roupa na noite anterior" value={v.notes} onChange={e=>set('notes',e.target.value)}/></Field>
    {plan&&<label className="checkbox-field"><input type="checkbox" checked={v.active} onChange={e=>set('active',e.target.checked)}/>Manter este horário ativo</label>}
    {clashes.length>0&&<div className="callout warning" role="status"><strong>Este horário encontra outros compromissos.</strong><p>{clashes.slice(0,3).map(c=>fmtDate(c.date)+': '+c.title).join(' · ')}{clashes.length>3?'…':''}. Você pode ajustar o horário antes de salvar.</p></div>}
    <p className="muted">O horário se repete toda semana a partir da data escolhida. Editar ou pausar preserva os registros anteriores. Planejar ainda não conta como exercício realizado.</p>
    <div className="form-actions"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={!!pending||!v.days.length||end>=1440}><CalendarDays size={16}/>Salvar meu plano</Button></div>
  </form></Modal>;
}

export function ActivityForm({date,today,plan=null,record=null,onClose}) {
  const {entries,save,pending,flash}=useRoutine();
  const existing=record?(entries.find(e=>e.id===record.id)||record):(plan?entries.find(e=>e.type==='block_log'&&e.entry_date===date&&e.data.blockId===plan.id):null);
  const activity=existing?.type==='block_log'?existing.data.activity:existing?.data;
  const baseline=useRef(existing);
  const [v,setV]=useState({date:existing?.entry_date||date,title:plan?.title||'',kind:plan?.fitness?.kind||'Caminhada',minutes:plan?.minutes||30,distance:'',notes:plan?.fitness?.notes||'',...activity});
  const set=(key,value)=>setV(p=>({...p,[key]:value}));
  async function submit(e) {
    e.preventDefault();if(v.date>today){flash('Registre a atividade depois que ela acontecer.');return;}
    const data={title:v.title.trim()||v.kind,kind:v.kind,minutes:Number(v.minutes),distance:v.distance===''?null:Number(v.distance),notes:v.notes.trim()};
    const isPlanned=!!plan||existing?.type==='block_log',old=baseline.current;
    const result=await save(isPlanned?'block_log':'activity',isPlanned?{...old?.data,blockId:plan?.id||old.data.blockId,activity:data}:data,v.date,old?.id,old?.revision);
    if(result){flash('Movimento registrado. Seu progresso e suas medalhas foram atualizados.');onClose();}
  }
  return <Modal title={existing?'Rever meu movimento':'Mais um passo para guardar'} onClose={onClose}><form onSubmit={submit}>
    {plan&&<p className="callout">Seu plano reservou {plan.minutes} min. Registre o tempo que você realmente fez.</p>}
    <Field label="O que você fez?"><input autoFocus required maxLength="180" value={v.title} onChange={e=>set('title',e.target.value)} placeholder="Ex.: caminhada no bairro"/></Field>
    <div className="form-grid"><Field label="Dia da atividade"><input type="date" required max={today} disabled={!!plan||existing?.type==='block_log'} value={v.date} onChange={e=>set('date',e.target.value)}/></Field><Field label="Modalidade"><select value={v.kind} onChange={e=>set('kind',e.target.value)}>{[...new Set([...MOVEMENT_KINDS,v.kind])].map(k=><option key={k}>{k}</option>)}</select></Field><Field label="Tempo realizado (min)"><input type="number" min="1" max="720" required value={v.minutes} onChange={e=>set('minutes',e.target.value)}/></Field><Field label="Distância (km, opcional)"><input type="number" min="0" max="500" step="0.01" value={v.distance??''} onChange={e=>set('distance',e.target.value)}/></Field></div>
    <Field label="Como foi? (opcional)"><textarea rows="2" maxLength="2000" value={v.notes} onChange={e=>set('notes',e.target.value)} placeholder="O que foi bom? O que gostaria de ajustar?"/></Field>
    <div className="form-actions"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={!!pending||v.date>today}><Check size={16}/>Salvar atividade realizada</Button></div>
  </form></Modal>;
}
