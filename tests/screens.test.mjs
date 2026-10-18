import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {build} from 'vite';
import {activityRecords,DEFAULT_SETTINGS} from '../src/lib/domain.js';
import {reviseFitnessPlan} from '../src/lib/fitness.js';

test('as telas e os formulários renderizam contas novas e registros de exercício já salvos',async()=>{
  const root=fileURLToPath(new URL('..',import.meta.url)),temporary=await mkdtemp(join(root,'.render-check-'));
  try {
    const result=await build({root,configFile:false,logLevel:'silent',plugins:[{
      name:'routine-render-fixture',enforce:'pre',
      resolveId(id){if(id==='virtual:render-entry')return '\0render-entry';if(id==='virtual:routine-fixture'||/(^|\/)store\.jsx$/.test(id))return '\0routine-fixture';},
      load(id){
        if(id==='\0routine-fixture')return 'let state; export function setFixture(next){state=next} export const useRoutine=()=>state;';
        if(id==='\0render-entry')return `
          import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
          import {setFixture} from 'virtual:routine-fixture';
          import {MovementPage,MovementToday} from ${JSON.stringify(join(root,'src/pages/movement.jsx'))};
          import {MedalsPage} from ${JSON.stringify(join(root,'src/pages/medals.jsx'))};
          import {TodayPage,WeekPage} from ${JSON.stringify(join(root,'src/pages/day.jsx'))};
          import {WellbeingPage} from ${JSON.stringify(join(root,'src/pages/tracking.jsx'))};
          import {ActivityForm,ExercisePlanForm,WellnessGoalsForm} from ${JSON.stringify(join(root,'src/fitness-components.jsx'))};
          export function renderScreens(state,extra={}){
            setFixture(state); const props={date:'2026-10-19',today:'2026-10-19',setDate(){},go(){},onClose(){},...extra};
            return Object.fromEntries(Object.entries({MovementPage,MovementToday,MedalsPage,TodayPage,WeekPage,WellbeingPage,ActivityForm,ExercisePlanForm,WellnessGoalsForm}).map(([name,Component])=>[name,renderToStaticMarkup(React.createElement(Component,props))]));
          }`;
      }
    }],build:{ssr:true,write:false,rollupOptions:{input:'virtual:render-entry',external:['react','react-dom/server','lucide-react']}}});
    const bundle=result.output.find(x=>x.type==='chunk'&&x.isEntry),file=join(temporary,'render.mjs');
    await writeFile(file,bundle.code);const {renderScreens}=await import(pathToFileURL(file));
    const state={entries:[],settings:DEFAULT_SETTINGS,profile:{display_name:'Déborah',revision:1},user:{id:'render-fixture'},pending:0,save(){},remove(){},saveProfile(){},flash(){}};
    const empty=renderScreens(state);
    assert.match(empty.MovementPage,/Planejar atividade/);assert.match(empty.MedalsPage,/A primeira medalha/);
    assert.match(empty.WeekPage,/Uma semana com respiro/);assert.match(empty.WellbeingPage,/Meu plano de exercícios/);
    const plan={id:'p',type:'block',data:reviseFitnessPlan(null,{title:'Academia com calma',days:[1],start:'18:50',end:'19:30',active:true,fitness:{kind:'Academia'}},'2026-10-19')};
    const log={id:'l',type:'block_log',entry_date:'2026-10-19',revision:1,data:{blockId:'p',activity:{title:'Meu treino de hoje',kind:'Academia',minutes:32,notes:'Consegui ir.'}}};
    state.entries=[plan,log];
    const saved=renderScreens(state,{plan,record:activityRecords(state.entries)[0]});
    assert.match(saved.MovementPage,/Academia com calma/);assert.match(saved.MovementToday,/Rever registro/);
    assert.match(saved.MedalsPage,/Conquistada/);assert.match(saved.WellbeingPage,/Meu treino de hoje/);
    assert.match(saved.ActivityForm,/value="32"/);assert.match(saved.ActivityForm,/Consegui ir\./);
    assert.match(saved.ExercisePlanForm,/value="Academia com calma"/);
  } finally {await rm(temporary,{recursive:true,force:true});}
});
