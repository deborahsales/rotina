import React,{useState,useEffect,useRef,Component} from 'react';
import {LayoutDashboard,CalendarDays,Utensils,CheckSquare,Repeat2,Target,BookOpen,HeartPulse,House,Printer,Armchair,ChartNoAxesCombined,Settings,Menu,LogOut,ArrowRight,Leaf,Sun,Mail,LockKeyhole,LoaderCircle,CloudCheck,CloudOff,RefreshCw,Plus,X} from 'lucide-react';
import {supabase,SUPABASE_URL,SUPABASE_KEY} from './lib/supabase.js';
import {RoutineProvider,useRoutine} from './store.jsx';
import {Brand,Button,IconButton,Onboarding,TaskForm} from './components.jsx';
import {dateKey,fmtDate,waterTotal,DEFAULT_SETTINGS,minutes} from './lib/domain.js';
import {TodayPage,WeekPage,TasksPage,HabitsPage,GoalsPage,StudyPage,WellbeingPage,AtelierPage,LeisurePage,ReviewPage,SettingsPage} from './pages.jsx';
import FoodPage from './food.jsx';
const NAV=[
 {group:'SEU DIA',items:[['today','Meu dia',LayoutDashboard],['week','Minha semana',CalendarDays],['tasks','Tarefas',CheckSquare]]},
 {group:'CUIDAR DE VOCÊ',items:[['food','Alimentação',Utensils],['habits','Hábitos',Repeat2],['wellbeing','Corpo e descanso',HeartPulse]]},
 {group:'O QUE IMPORTA',items:[['goals','Objetivos',Target],['study','Estudos e foco',BookOpen],['home','Casa',House],['atelier','Ateliê 3D',Printer],['leisure','Lazer e hobbies',Armchair]]},
 {group:'OLHAR COM CALMA',items:[['review','Minha evolução',ChartNoAxesCombined],['settings','Preferências',Settings]]}
];
const validPages=NAV.flatMap(g=>g.items.map(i=>i[0]));
function translateError(error) {
 const message=error?.message||'';
 if(/invalid login credentials/i.test(message))return 'E-mail ou senha incorretos. Confira e tente novamente.';
 if(/email not confirmed/i.test(message))return 'Confirme seu e-mail antes de entrar. Confira também a caixa de spam.';
 if(/rate limit|too many/i.test(message))return 'Aguarde alguns minutos antes de tentar novamente.';
 if(/same password/i.test(message))return 'Escolha uma senha diferente da anterior.';
 if(/signup.*disabled/i.test(message))return 'O cadastro está temporariamente desativado.';
 if(/fetch|network/i.test(message))return 'Não foi possível conectar. Confira sua conexão.';
 return message||'Não foi possível concluir. Tente novamente.';
}
function AuthPage({recovery=false,onRecovered}) {
 const [mode,setMode]=useState(recovery?'recovery':'login'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[google,setGoogle]=useState(false);
 useEffect(()=>{if(recovery)setMode('recovery');},[recovery]);
 useEffect(()=>{const c=new AbortController();fetch(SUPABASE_URL+'/auth/v1/settings',{headers:{apikey:SUPABASE_KEY},signal:c.signal}).then(r=>r.json()).then(data=>setGoogle(!!data.external?.google)).catch(()=>{});return()=>c.abort();},[]);
 const changeMode=m=>{setMode(m);setError('');setMessage('');};
 async function submit(e) {
  e.preventDefault();setBusy(true);setError('');setMessage('');
  try {
   let result;
   if(mode==='login')result=await supabase.auth.signInWithPassword({email:email.trim(),password});
   if(mode==='signup')result=await supabase.auth.signUp({email:email.trim(),password,options:{data:{full_name:name.trim()},emailRedirectTo:window.location.origin}});
   if(mode==='forgot')result=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin+'/?recovery=1'});
   if(mode==='recovery')result=await supabase.auth.updateUser({password});
   if(result?.error)throw result.error;
   if(mode==='signup'&&!result.data.session)setMessage('Se o endereço puder ser cadastrado, você receberá um e-mail de confirmação. Abra o link para continuar.');
   if(mode==='forgot')setMessage('Se houver uma conta para esse endereço, você receberá as instruções de recuperação.');
   if(mode==='recovery'){setMessage('Senha atualizada.');window.history.replaceState({},'',window.location.pathname);onRecovered?.();}
  }catch(err){setError(translateError(err));}
  finally{setBusy(false);}
 }
 const titles={login:'Bom te ter por aqui.',signup:'Seu espaço começa aqui.',forgot:'Vamos recuperar seu acesso.',recovery:'Escolha uma nova senha.'};
 return <div className="auth-page"><section className="auth-story"><Brand/><div className="auth-copy"><span className="auth-kicker">MAIS PRESENÇA. MENOS CORRERIA.</span><h1>Seu dia,<br/>com espaço<br/>para <em>você.</em></h1><p>Um lugar para cuidar do corpo, organizar os planos e abrir espaço para o que faz a vida acontecer.</p></div><div className="auth-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="art-card art-water"><span>um copo de cada vez</span><div>Água <span>✓</span></div></div><div className="art-sun"><Sun size={68} strokeWidth={1.2}/></div><div className="art-card art-life"><Leaf size={22}/><span>Cabe um pouco<br/><b>de vida no seu dia.</b></span></div><div className="art-leaf leaf-one"/><div className="art-leaf leaf-two"/><div className="art-dot"/></div><p className="auth-bottom">Trabalho · autocuidado · casa · sonhos · descanso</p></section><section className="auth-panel"><div className="mobile-auth-brand"><Brand/></div><div className="auth-form"><span className="eyebrow">SEU CANTINHO DE ORGANIZAÇÃO</span><h2>{titles[mode]}</h2><p>{mode==='login'?'Entre para continuar cuidando da sua rotina.':mode==='signup'?'Crie sua conta. Seus registros ficam no seu espaço pessoal.':mode==='forgot'?'Informe o e-mail usado no cadastro.':'Use pelo menos 8 caracteres.'}</p>
 <form onSubmit={submit}>{mode==='signup'&&<label className="field"><span>Seu nome</span><input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" maxLength="80" required placeholder="Como você prefere ser chamada(o)?"/></label>}{mode!=='recovery'&&<label className="field"><span>E-mail</span><div className="input-icon"><Mail size={17}/><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="voce@exemplo.com"/></div></label>}{mode!=='forgot'&&<label className="field"><span>Senha</span><div className="input-icon"><LockKeyhole size={17}/><input type="password" required minLength={mode==='login'?undefined:8} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==='login'?'current-password':'new-password'} placeholder={mode==='login'?'Sua senha':'Pelo menos 8 caracteres'}/></div></label>}{mode==='login'&&<button type="button" className="text-btn forgot" onClick={()=>changeMode('forgot')}>Esqueci minha senha</button>}{error&&<div className="form-error" role="alert">{error}</div>}{message&&<div className="form-success" role="status">{message}</div>}<Button className="full" disabled={busy}>{busy?<LoaderCircle size={17} className="spin"/>:null}{({login:'Entrar no meu espaço',signup:'Criar minha conta',forgot:'Enviar instruções',recovery:'Salvar nova senha'})[mode]}<ArrowRight size={17}/></Button></form>
 {google&&['login','signup'].includes(mode)&&<><div className="auth-divider"><span>ou</span></div><Button variant="secondary" className="full" onClick={async()=>{const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin}});if(error)setError(translateError(error));}}>Continuar com Google</Button></>}
 {mode==='login'?<p className="auth-switch">Primeira vez? <button className="text-btn" onClick={()=>changeMode('signup')}>Criar minha conta</button></p>:mode!=='recovery'?<p className="auth-switch"><button className="text-btn" onClick={()=>changeMode('login')}>Voltar para entrar</button></p>:null}<div className="auth-note"><Leaf size={15}/>Você não precisa dar conta de tudo hoje.</div></div></section></div>;
}
function Shell(){
 const {user,profile,entries,settings,loading,error,notice,pending,online,refresh}=useRoutine();
 const [page,setPage]=useState(()=>{const p=new URLSearchParams(window.location.search).get('p');return validPages.includes(p)?p:'today';});
 const [date,setDate]=useState(()=>dateKey(new Date(),settings.timezone)),[drawer,setDrawer]=useState(false),[task,setTask]=useState(false),[reminderDismissed,setReminderDismissed]=useState(false),[now,setNow]=useState(Date.now());
 const today=dateKey(new Date(now),settings.timezone);
 const previousToday=useRef(today),openedAt=useRef(Date.now());
 useEffect(()=>{const old=previousToday.current;setDate(d=>d===old?today:d);previousToday.current=today;},[today]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{const onPop=()=>{const p=new URLSearchParams(window.location.search).get('p');setPage(validPages.includes(p)?p:'today');};window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop);},[]);
 function go(key){setPage(key);setDrawer(false);const url=new URL(window.location.href);url.searchParams.set('p',key);window.history.pushState({},'',url);window.scrollTo({top:0,behavior:'instant'});}
 const water=waterTotal(entries,today),last=entries.filter(e=>e.type==='water'&&e.entry_date===today).at(-1);
 const localTime=new Intl.DateTimeFormat('en-GB',{timeZone:settings.timezone,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(now));
 const lastWaterTime=last?new Date(last.created_at).getTime():openedAt.current;
 const remind=profile?.settings?.reminders&&!reminderDismissed&&water<settings.waterGoal&&minutes(localTime)>=minutes(settings.wakeTime)&&minutes(localTime)<minutes(settings.bedTime)&&(now-lastWaterTime)/60000>Number(settings.waterInterval);
 useEffect(()=>{setReminderDismissed(false);},[last?.id,today]);
 if(loading)return <div className="loading-page"><Brand/><LoaderCircle className="spin"/><p>Preparando seu espaço…</p></div>;
 if(error)return <div className="loading-page"><Brand/><h2>Seu espaço está guardado.</h2><p>{error}</p><Button onClick={()=>refresh(true)}><RefreshCw size={16}/>Tentar novamente</Button></div>;
 if(!profile?.initialized)return <Onboarding/>;
 const selected=NAV.flatMap(x=>x.items).find(x=>x[0]===page);
 const pages={today:TodayPage,week:WeekPage,tasks:TasksPage,home:TasksPage,habits:HabitsPage,goals:GoalsPage,study:StudyPage,wellbeing:WellbeingPage,atelier:AtelierPage,leisure:LeisurePage,review:ReviewPage,settings:SettingsPage,food:FoodPage};
 const Page=pages[page]||TodayPage;
 return <div className="app-shell"><a href="#main" className="skip-link">Ir para o conteúdo</a>{drawer&&<button className="drawer-backdrop" onClick={()=>setDrawer(false)} aria-label="Fechar menu"/>}<aside className={'sidebar '+(drawer?'open':'')}><div className="sidebar-brand"><Brand/><IconButton label="Fechar menu" onClick={()=>setDrawer(false)}><X size={19}/></IconButton></div><nav aria-label="Navegação principal">{NAV.map(g=><div className="nav-group" key={g.group}><span className="nav-label">{g.group}</span>{g.items.map(([key,label,Icon])=><button key={key} className={'nav-item '+(page===key?'active':'')} onClick={()=>go(key)} aria-current={page===key?'page':undefined}><Icon size={18}/><span>{label}</span>{page===key&&<i/>}</button>)}</div>)}</nav><div className="sidebar-bottom"><div className="sidebar-quote"><Leaf size={18}/><p>Pequenos passos.<br/><strong>Uma vida mais sua.</strong></p></div><button className="profile-button" onClick={()=>go('settings')}><span className="avatar">{(profile.display_name||'V').slice(0,1).toUpperCase()}</span><span><strong>{profile.display_name}</strong><small>Meu espaço pessoal</small></span><Settings size={16}/></button></div></aside>
 <div className="workspace"><header className="topbar"><div className="topbar-left"><IconButton label="Abrir menu" onClick={()=>setDrawer(true)}><Menu size={21}/></IconButton><span className="breadcrumb">Meu espaço <span>/</span> <strong>{selected?.[1]}</strong></span></div><div className="topbar-right"><span className={'sync-status '+(!online?'offline':'')}>{online?<CloudCheck size={15}/>:<CloudOff size={15}/>}<span>{!online?'Sem conexão':pending?'Salvando…':'Sincronizado'}</span></span><IconButton label="Atualizar registros" disabled={!!pending} onClick={()=>refresh()}><RefreshCw size={16}/></IconButton><span className="today-badge">{fmtDate(today,{day:'numeric',month:'short'})}</span></div></header>
 {!online&&<div className="connection-banner">Você está sem conexão. Reconecte para salvar seus registros.</div>}
 {remind&&<div className="water-banner"><span>Uma pausa para beber água? Você registrou {water} ml hoje.</span><button className="text-btn" onClick={()=>{go('wellbeing');setReminderDismissed(true);}}>Registrar água</button><IconButton label="Dispensar lembrete" onClick={()=>setReminderDismissed(true)}><X size={16}/></IconButton></div>}
 <main id="main" tabIndex="-1" className="main-content"><Page key={page} date={date} setDate={setDate} today={today} go={go} area={page==='home'?'Casa':undefined}/></main><footer className="app-footer"><span>Feito para uma vida possível.</span><button className="text-btn" onClick={()=>go('settings')}>Seu tempo, suas escolhas.</button></footer></div>
 <nav className="mobile-nav" aria-label="Navegação rápida">{[['today','Meu dia',LayoutDashboard],['week','Semana',CalendarDays],['food','Alimentação',Utensils],['habits','Hábitos',Repeat2]].map(([k,l,I])=><button key={k} className={page===k?'active':''} onClick={()=>go(k)}><I size={20}/><span>{l}</span></button>)}<button className={drawer?'active':''} onClick={()=>setDrawer(!drawer)}><Menu size={20}/><span>Mais</span></button></nav>
 {notice&&<div className="toast" role="status">{notice}<span aria-hidden="true">✓</span></div>}{task&&<TaskForm date={date} onClose={()=>setTask(false)}/>}</div>;
}
class ErrorBoundary extends Component {
 constructor(p){super(p);this.state={error:false};}
 static getDerivedStateFromError(){return {error:true};}
 render(){return this.state.error?<div className="loading-page"><Brand/><h2>Vamos retomar daqui.</h2><p>Houve um problema ao abrir esta tela. Seus registros salvos continuam na sua conta.</p><Button onClick={()=>window.location.reload()}>Reabrir o Rotina</Button></div>:this.props.children;}
}
export default function App(){
 const [session,setSession]=useState(null),[loading,setLoading]=useState(true),[recovery,setRecovery]=useState(new URLSearchParams(window.location.search).has('recovery'));
 useEffect(()=>{
  let active=true;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,s)=>{if(!active)return;setSession(s);setLoading(false);if(event==='PASSWORD_RECOVERY')setRecovery(true);});
  supabase.auth.getSession().then(({data,error})=>{if(active){setSession(data.session);setLoading(false);}}).catch(()=>{if(active)setLoading(false);});
  return()=>{active=false;subscription.unsubscribe();};
 },[]);
 if(loading)return <div className="loading-page"><Brand/><LoaderCircle className="spin"/><p>Abrindo o Rotina…</p></div>;
 return <ErrorBoundary>{!session||recovery?<AuthPage recovery={!!session&&recovery} onRecovered={()=>setRecovery(false)}/>:<RoutineProvider key={session.user.id} user={session.user}><Shell/></RoutineProvider>}</ErrorBoundary>;
}
