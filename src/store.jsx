import React,{createContext,useContext,useState,useEffect,useRef,useCallback} from 'react';
import {supabase} from './lib/supabase.js';
import {DEFAULT_SETTINGS,uid,validateEntry,dateKey,seedEntries} from './lib/domain.js';
const Context=createContext(null);
export const useRoutine=()=>useContext(Context);
function errorText(error) {
  if(error?.message==='Failed to fetch'||error?.name==='TypeError')return 'Não foi possível salvar. Confira sua conexão e tente novamente.';
  if(error?.code==='23505')return 'Esse registro já foi salvo. Atualize a página para ver a versão mais recente.';
  if(error?.code==='42501')return 'Sua sessão não tem acesso a esse registro. Entre novamente.';
  return error?.message||'Não foi possível concluir. Tente novamente.';
}
export function RoutineProvider({user,children}) {
  const [entries,setEntries]=useState([]),[profile,setProfile]=useState(null),[loading,setLoading]=useState(true);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[pending,setPending]=useState(0);
  const [online,setOnline]=useState(navigator.onLine);
  const entriesRef=useRef([]),profileRef=useRef(null),active=useRef(true),loadingRef=useRef(false),locks=useRef(new Set()),toastTimer=useRef(null),writeEpoch=useRef(0);
  const replace=useCallback(value=>{entriesRef.current=value;setEntries(value);},[]);
  const flash=useCallback(message=>{setNotice(message);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setNotice(''),5000);},[]);
  const refresh=useCallback(async(initial=false)=>{
    if(loadingRef.current||locks.current.size)return;
    loadingRef.current=true;
    const epoch=writeEpoch.current;
    if(initial)setLoading(true);
    try {
      const {data:p,error:pe}=await supabase.from('routine_profiles').select('*').eq('user_id',user.id).maybeSingle();
      if(pe)throw pe;
      const all=[];let from=0;
      while(true){
        const {data,error:e}=await supabase.from('routine_entries').select('*').eq('user_id',user.id).order('created_at',{ascending:true}).order('id',{ascending:true}).range(from,from+999);
        if(e)throw e;all.push(...data);if(data.length<1000)break;from+=1000;
      }
      if(active.current&&epoch===writeEpoch.current&&!locks.current.size){profileRef.current=p;setProfile(p);replace(all);setError('');}
    }catch(e){if(active.current)setError(errorText(e));}
    finally{loadingRef.current=false;if(active.current)setLoading(false);}
  },[user.id,replace]);
  useEffect(()=>{
    active.current=true;refresh(true);
    const focus=()=>refresh(),net=()=>{setOnline(navigator.onLine);if(navigator.onLine)refresh();};
    window.addEventListener('focus',focus);window.addEventListener('online',net);window.addEventListener('offline',net);
    const timer=setInterval(()=>{if(document.visibilityState==='visible')refresh();},60000);
    return()=>{active.current=false;window.removeEventListener('focus',focus);window.removeEventListener('online',net);window.removeEventListener('offline',net);clearInterval(timer);clearTimeout(toastTimer.current);};
  },[refresh]);
  const guard=async(key,fn)=>{
    if(locks.current.has(key))return false;
    if(!navigator.onLine){flash('Você está sem conexão. Este registro ainda não foi salvo.');return false;}
    locks.current.add(key);writeEpoch.current++;setPending(n=>n+1);
    try{return await fn();}
    catch(e){flash(errorText(e));return false;}
    finally{locks.current.delete(key);setPending(n=>Math.max(0,n-1));}
  };
  const save=async(type,data,entry_date=null,id=null,expectedRevision=null)=>{
    return guard(id||type+':'+entry_date,async()=>{
      const record=validateEntry({type,data,entry_date});
      const previous=id?entriesRef.current.find(e=>e.id===id):null;
      if(id&&!previous)throw new Error('O registro foi removido em outro aparelho. Atualize a página.');
      if(previous&&expectedRevision!==null&&previous.revision!==expectedRevision)throw new Error('Este registro mudou em outro aparelho. Feche a edição e abra a versão atual antes de salvar.');
      let query;
      if(previous)query=supabase.from('routine_entries').update({...record}).eq('id',id).eq('user_id',user.id).eq('revision',previous.revision).select().maybeSingle();
      else query=supabase.from('routine_entries').insert({...record,id:uid(),user_id:user.id}).select().single();
      const {data:result,error:e}=await query;
      if(e)throw e;
      if(!result){setTimeout(()=>refresh(),0);throw new Error('Esse registro mudou em outro aparelho. Atualize a página antes de editar novamente.');}
      replace(previous?entriesRef.current.map(x=>x.id===id?result:x):[...entriesRef.current,result]);
      return result;
    });
  };
  const remove=async(id)=>{
    return guard(id,async()=>{
      const previous=entriesRef.current.find(e=>e.id===id);if(!previous)return true;
      const {data,error:e}=await supabase.from('routine_entries').delete().eq('id',id).eq('user_id',user.id).eq('revision',previous.revision).select('id');
      if(e)throw e;
      if(!data?.length)throw new Error('O registro mudou em outro aparelho. Atualize antes de tentar novamente.');
      replace(entriesRef.current.filter(e=>e.id!==id));return true;
    });
  };
  const bulkAdd=async(items)=>{
    if(!items.length)return true;
    return guard('bulk',async()=>{
      const records=items.map(item=>({...validateEntry(item),id:item.id||uid(),user_id:user.id}));
      // One request is atomic. Keep imports small enough to preserve that guarantee.
      if(records.length>1500)throw new Error('Importe no máximo 1.500 registros por vez.');
      const {data,error:e}=await supabase.from('routine_entries').insert(records).select();
      if(e)throw e;replace([...entriesRef.current,...data]);return true;
    });
  };
  const saveProfile=async(values,expectedRevision=null)=>{
    return guard('profile',async()=>{
      const old=profileRef.current;
      if(old&&expectedRevision!==null&&old.revision!==expectedRevision)throw new Error('Suas preferências mudaram em outro aparelho. Reabra esta tela antes de salvar.');
      const next={display_name:values.display_name??old?.display_name??'',settings:{...DEFAULT_SETTINGS,...old?.settings,...values.settings},initialized:true};
      let q=old?supabase.from('routine_profiles').update(next).eq('user_id',user.id).eq('revision',old.revision).select().maybeSingle():supabase.from('routine_profiles').insert({...next,user_id:user.id}).select().single();
      const {data,error:e}=await q;if(e)throw e;
      if(!data)throw new Error('Suas preferências mudaram em outro aparelho. Atualize a página.');
      profileRef.current=data;setProfile(data);return data;
    });
  };
  const setup=async(values,withTemplates=true)=>{
    const settings={...DEFAULT_SETTINGS,...values.settings};
    if(withTemplates&&!entriesRef.current.length){
      const ok=await bulkAdd(seedEntries(dateKey(new Date(),settings.timezone),settings));
      if(!ok)return false;
    }
    const ok=await saveProfile({...values,settings});if(ok)flash('Seu espaço está pronto. Comece com o que couber hoje.');return ok;
  };
  return <Context.Provider value={{user,entries,profile,settings:{...DEFAULT_SETTINGS,...profile?.settings},loading,error,notice,pending,online,save,remove,bulkAdd,saveProfile,setup,refresh,flash}}>{children}</Context.Provider>;
}
