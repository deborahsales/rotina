/** Regras de receitas, planejamento e compras, independentes da interface. */
export const CATEGORIES=[
 {name:'Café da manhã',slug:'cafe',icon:'sun',className:'breakfast'},
 {name:'Almoço',slug:'almoco',icon:'plate',className:'lunch'},
 {name:'Jantar',slug:'jantar',icon:'moon',className:'dinner'},
 {name:'Lanche',slug:'lanche',icon:'snack',className:'snack'},
];
export const MEALS=[
 {key:'breakfast',name:'Café da manhã',icon:'sun'},
 {key:'lunch',name:'Almoço',icon:'plate'},
 {key:'snack',name:'Lanche',icon:'snack'},
 {key:'dinner',name:'Jantar',icon:'moon'},
];
export const STORAGE_KEY='receitas_rotina_v1';
export const SHOP_GROUPS=['Hortifruti','Proteínas','Laticínios e bebidas','Grãos, pães e massas','Despensa'];
const nf=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2});
export const number=(n)=>nf.format(Math.round((n+Number.EPSILON)*100)/100);
export const normalize=(s)=>String(s??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();
export const escapeHTML=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function category(name){return CATEGORIES.find(c=>c.name===name)||CATEGORIES[3];}
export function searchMatches(recipe,query){
 const haystack=normalize([recipe.title,recipe.subtitle,recipe.category,...recipe.ingredients.map(x=>x[0]),...(recipe.search_tags||[])].join(' '));
 return normalize(query).split(/\s+/).every(term=>haystack.includes(term));
}
export function compatible(recipe,mealKey){
 const label=MEALS.find(m=>m.key===mealKey)?.name;
 return recipe.category===label||(recipe.alternative_categories||[]).includes(label);
}
export function filterRecipes(recipes,filters={},favorites=[]){
 const favoriteSet=new Set(favorites);
 let result=recipes.filter(r=>
  (!filters.category||r.category===filters.category)&&
  (!filters.search||searchMatches(r,filters.search))&&
  (!filters.equipment||r.equipment_tags.includes(filters.equipment))&&
  (!filters.maxTime||r.active_minutes<=Number(filters.maxTime))&&
  (!filters.freezer||r.freezer_status===filters.freezer)&&
  (!filters.ingredient||(filters.ingredient==='yogurt'?r.has_yogurt:filters.ingredient==='gelatin'?r.has_gelatin:r.is_creami))&&
  (!filters.onlyFavorites||favoriteSet.has(r.id)));
 if(filters.sort==='time')result.sort((a,b)=>a.active_minutes-b.active_minutes||a.id.localeCompare(b.id));
 else if(filters.sort==='name')result.sort((a,b)=>a.title.localeCompare(b.title,'pt-BR'));
 else result.sort((a,b)=>Number(a.id)-Number(b.id));
 return result;
}
export function scaleQuantity(quantity,multiplier=1){
 if(/porção/i.test(quantity))return quantity;
 if(multiplier===1)return quantity;
 return quantity.replace(/\d+(?:[.,]\d+)?/g,token=>number(Number(token.replace(',','.'))*multiplier));
}
export function localISO(date){
 return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function parseDate(iso){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return null;
 const [y,m,d]=iso.split('-').map(Number),date=new Date(y,m-1,d,12);
 return localISO(date)===iso?date:null;
}
export function monday(date=new Date()){
 const d=new Date(date.getFullYear(),date.getMonth(),date.getDate(),12);
 d.setDate(d.getDate()-((d.getDay()+6)%7));return localISO(d);
}
export function shiftDays(iso,days){const date=parseDate(iso);if(!date)throw new Error('Data inválida');date.setDate(date.getDate()+days);return localISO(date);}
export function weekDays(iso){return Array.from({length:7},(_,i)=>parseDate(shiftDays(iso,i)));}
export function weekLabel(iso){
 const dates=weekDays(iso),fmt=new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'short'});
 return `${fmt.format(dates[0])} - ${fmt.format(dates[6])}`;
}
export function freshState(){return {version:1,favorites:[],plans:{},checks:{},extras:{},shoppingMode:'batch'};}
export function sanitizeState(input,recipes){
 const result=freshState();
 if(!input||typeof input!=='object'||Array.isArray(input))return result;
 const ids=new Set(recipes.map(r=>r.id));
 result.favorites=[...new Set(Array.isArray(input.favorites)?input.favorites.filter(id=>ids.has(id)):[])];
 const plans=input.plans&&typeof input.plans==='object'&&!Array.isArray(input.plans)?input.plans:{};
 for(const [week,slots] of Object.entries(plans).slice(0,260)){
  const date=parseDate(week);
  if(!date||date.getDay()!==1||!slots||typeof slots!=='object')continue;
  const safe={};
  for(const [key,entry] of Object.entries(slots)){
   if(!/^[0-6]:(breakfast|lunch|snack|dinner)$/.test(key)||!entry||!ids.has(entry.recipeId))continue;
   const portions=Number(entry.portions);
   safe[key]={recipeId:entry.recipeId,portions:Number.isInteger(portions)?Math.min(12,Math.max(1,portions)):1};
  }
  if(Object.keys(safe).length)result.plans[week]=safe;
 }
 for(const [week,list] of Object.entries(input.checks||{}).slice(0,260)){
  if(!parseDate(week)||!Array.isArray(list))continue;
  result.checks[week]=[...new Set(list.filter(x=>typeof x==='string'&&x.length<250))].slice(0,500);
 }
 for(const [week,list] of Object.entries(input.extras||{}).slice(0,260)){
  if(!parseDate(week)||!Array.isArray(list))continue;
  result.extras[week]=list.filter(x=>x&&typeof x.id==='string'&&typeof x.name==='string'&&x.name.trim())
   .slice(0,100).map(x=>({id:x.id.slice(0,80),name:x.name.trim().slice(0,120),quantity:String(x.quantity||'').slice(0,60)}));
 }
 result.shoppingMode=input.shoppingMode==='portions'?'portions':'batch';
 return result;
}

export function parseQuantity(quantity){
 const q=normalize(quantity),decimal=s=>Number(s.replace(',','.'));
 const range=q.match(/(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)\s*(ml|g|litros?|kg)\b/);
 if(range){let value=decimal(range[2]),unit=range[3];if(unit.startsWith('litro')){value*=1000;unit='ml';}if(unit==='kg'){value*=1000;unit='g';}return {value,unit,upper:true};}
 const match=q.match(/(\d+(?:[.,]\d+)?)\s*(ml|g|litros?|kg)\b/);
 if(!match)return {value:0,unit:null,text:quantity};
 let value=decimal(match[1]),unit=match[2];
 if(unit.startsWith('litro')){value*=1000;unit='ml';}
 if(unit==='kg'){value*=1000;unit='g';}
 return {value,unit,upper:q.startsWith('ate ')};
}

export function canonicalIngredient(name){
 const n=normalize(name);
 if(n.startsWith('agua'))return {label:'Água',group:'Despensa',skip:true};
 const choices=[
  [/^iogurte/,'Iogurte natural integral','Laticínios e bebidas'],
  [/^leite de coco/,'Leite de coco culinário integral','Laticínios e bebidas'],
  [/^leite/,'Leite integral pasteurizado','Laticínios e bebidas'],
  [/^bebida de aveia/,'Bebida de aveia sem açúcar','Laticínios e bebidas'],
  [/^ricota/,'Ricota pasteurizada','Laticínios e bebidas'],
  [/^mucarela/,'Muçarela','Laticínios e bebidas'],
  [/^whey/,'Whey de baunilha ou chocolate','Despensa'],
  [/^ovos? sem/,'Ovos (peso sem casca)','Proteínas'],
  [/^peito de frango/,'Peito de frango cru','Proteínas'],
  [/^frango(?: ja)? cozido/,'Frango cozido e desfiado','Proteínas'],
  [/^carne bovina.*cozida/,'Carne bovina magra cozida e desfiada','Proteínas'],
  [/^carne.*moida/,'Carne bovina moída magra crua','Proteínas'],
  [/^carne bovina/,'Carne bovina magra crua, em tiras','Proteínas'],
  [/^patinho moido/,'Carne bovina moída magra crua','Proteínas'],
  [/^patinho/,'Patinho cru em cubos','Proteínas'],
  [/^camarao/,'Camarão cru, limpo e sem casca','Proteínas'],
  [/^file de pescada/,'Filé de pescada ou tilápia cru','Proteínas'],
  [/^file de tilapia/,'Filé de tilápia cru','Proteínas'],
  [/^atum/,'Atum em água, escorrido','Proteínas'],
  [/^banana/,'Banana sem casca','Hortifruti'],[/^manga/,'Manga sem casca e caroço','Hortifruti'],
  [/^morango/,'Morango limpo','Hortifruti'],[/^mamao/,'Mamão limpo','Hortifruti'],
  [/^maca(?: |$)/,'Maçã sem miolo, com casca','Hortifruti'],
  [/^macaxeira.*cozida/,'Macaxeira cozida e escorrida','Hortifruti'],
  [/^(macaxeira|mandioca)/,'Macaxeira crua, limpa','Hortifruti'],
  [/^batata-doce.*cozida/,'Batata-doce cozida','Hortifruti'],
  [/^batata-doce/,'Batata-doce crua','Hortifruti'],[/^batata/,'Batata crua','Hortifruti'],
  [/^couve crua/,'Couve crua','Hortifruti'],
  [/^abobora cabotia/,'Abóbora cabotiá limpa, crua','Hortifruti'],[/^abobora/,'Abóbora limpa, crua','Hortifruti'],
  [/^abobrinha/,'Abobrinha crua','Hortifruti'],[/^cenoura/,'Cenoura crua','Hortifruti'],
  [/^cebola/,'Cebola','Hortifruti'],[/^pepino/,'Pepino','Hortifruti'],
  [/^raspas de limao/,'Limão para raspas','Hortifruti'],[/^suco de limao/,'Limão para suco','Hortifruti'],
  [/^brocolis/,'Brócolis cru','Hortifruti'],[/^couve-flor/,'Couve-flor crua','Hortifruti'],
  [/^repolho/,'Repolho cru','Hortifruti'],[/^espinafre/,'Espinafre cru','Hortifruti'],
  [/^pimentao/,'Pimentão cru','Hortifruti'],[/^tomate$/,'Tomate','Hortifruti'],
  [/^vagem/,'Vagem limpa','Hortifruti'],[/^alho$/,'Alho','Hortifruti'],
  [/^gengibre/,'Gengibre','Hortifruti'],
  [/^(salsinha|cebolinha|cheiro-verde|coentro|hortela|manjericao)/,name,'Hortifruti'],
  [/^arroz/,'Arroz branco cru','Grãos, pães e massas'],
  [/^grao-de-bico/,'Grão-de-bico cozido e escorrido','Grãos, pães e massas'],
  [/^feijao cozido e escorrido/,'Feijão cozido e escorrido','Grãos, pães e massas'],
  [/^feijao-preto/,'Feijão-preto cozido e escorrido','Grãos, pães e massas'],
  [/^feijao /,'Feijão cozido, com pouco caldo','Grãos, pães e massas'],
  [/^aveia em/,'Aveia em flocos','Grãos, pães e massas'],
  [/^farinha de aveia/,'Farinha de aveia','Grãos, pães e massas'],
  [/^farinha de trigo/,'Farinha de trigo','Grãos, pães e massas'],
  [/^pao/,'Pão integral','Grãos, pães e massas'],
  [/^(macarrao|espaguete|cuscuz|flocao|goma de tapioca)/,name,'Grãos, pães e massas'],
  [/^azeite/,'Azeite','Despensa'],[/^oleo/,'Óleo vegetal','Despensa'],
  [/^sal(?: |$)/,'Sal','Despensa'],[/^chocolate 60-70/,'Chocolate 60-70%','Despensa'],
  [/^gelatina de morango/,'Gelatina de morango em pó (dose para 500 ml)','Despensa'],
  [/^gelatina de limao/,'Gelatina de limão em pó (dose para 500 ml)','Despensa'],
 ];
 for(const [pattern,label,group] of choices)if(pattern.test(n))return {label,group,skip:false};
 return {label:name.replace(/\*$/,''),group:'Despensa',skip:false};
}

/** Lotes frios distantes respeitam o prazo de preparo, em vez de compartilhar um pote por toda a semana. */
export function preparationGroups(plan,recipes,mode='batch'){
 const map=new Map(recipes.map(r=>[r.id,r])),byRecipe=new Map();
 for(const [slot,entry] of Object.entries(plan||{})){
  const recipe=map.get(entry.recipeId);if(!recipe)continue;
  const [day,meal]=slot.split(':');
  if(!byRecipe.has(recipe.id))byRecipe.set(recipe.id,[]);
  byRecipe.get(recipe.id).push({day:Number(day),meal,portions:entry.portions});
 }
 const groups=[];
 const coldDays={'23':2,'24':2,'34':2,'35':2,'36':3,'37':3};
 for(const [id,entries] of byRecipe){
  entries.sort((a,b)=>a.day-b.day);
  const clusters=[];
  for(const entry of entries){
   let cluster=clusters.at(-1);
   if(!cluster||(mode==='batch'&&coldDays[id]&&entry.day-cluster[0].day>=coldDays[id])){cluster=[];clusters.push(cluster);}
   cluster.push(entry);
  }
  for(const cluster of clusters){
   const recipe=map.get(id);
   let fraction=0,planned=0,breakfast=0;
   for(const entry of cluster){
    const mealName=MEALS.find(m=>m.key===entry.meal)?.name;
    const yieldPortions=recipe.portions_by_meal?.[mealName]||recipe.base_portions;
    fraction+=entry.portions/yieldPortions;planned+=entry.portions;
    if(entry.meal==='breakfast')breakfast+=entry.portions;
   }
   const multiplier=mode==='batch'?Math.ceil(fraction-1e-9):fraction;
   groups.push({recipe,multiplier,planned,breakfast,fraction,days:cluster.map(e=>e.day)});
  }
 }
 return groups.sort((a,b)=>a.recipe.id.localeCompare(b.recipe.id)||a.days[0]-b.days[0]);
}
export function shoppingList(plan,recipes,mode='batch'){
 const groups=preparationGroups(plan,recipes,mode),items=new Map();
 for(const prep of groups){
  for(const [name,qty] of prep.recipe.ingredients){
   const canonical=canonicalIngredient(name);if(canonical.skip)continue;
   const perServing=/porção/i.test(qty);
   const multiplier=perServing?prep.breakfast:prep.multiplier;
   if(!multiplier)continue;
   const parsed=parseQuantity(qty),key=normalize(canonical.label)+'|'+(parsed.unit||'text');
   if(!items.has(key))items.set(key,{key,label:canonical.label,group:canonical.group,value:0,unit:parsed.unit,texts:[],upper:false,recipes:[],optional:false});
   const item=items.get(key);
   item.value+=parsed.value*multiplier;
   item.upper||=Boolean(parsed.upper);
   item.optional||=/re-spin/i.test(name);
   if(parsed.text&&!item.texts.includes(parsed.text))item.texts.push(parsed.text);
   if(!item.recipes.includes(prep.recipe.id))item.recipes.push(prep.recipe.id);
  }
 }
 return {groups,items:[...items.values()].sort((a,b)=>SHOP_GROUPS.indexOf(a.group)-SHOP_GROUPS.indexOf(b.group)||a.label.localeCompare(b.label,'pt-BR'))};
}
export function formatShoppingQuantity(item){
 if(!item.unit)return item.texts.join(' / ')||'a gosto';
 let value=item.value,unit=item.unit;
 if(unit==='g'&&value>=1000){value/=1000;unit='kg';}
 if(unit==='ml'&&value>=1000){value/=1000;unit='L';}
 return `${item.upper?'até ':''}${number(value)} ${unit}`;
}
export const TEMPLATES={
 pratica:{name:'Semana prática',subtitle:'Pratos do dia a dia e lanches fáceis.',
  breakfast:['01','05','02','06','03','24','05'],lunch:['07','11','26','28','18','27','10'],
  snack:['19','19','34','34','36','38','38'],dinner:['41','04','46','33','43','51','42']},
 mealprep:{name:'Preparo em lote',subtitle:'Repete alguns preparos para facilitar a semana.',
  breakfast:['24','24','01','20','20','05','06'],lunch:['28','28','18','18','11','11','27'],
  snack:['19','19','19','21','21','39','39'],dinner:['41','41','46','46','44','44','33']},
 variedade:{name:'Um pouco de tudo',subtitle:'Mais sabores para sair da rotina.',
  breakfast:['05','03','25','06','02','01','24'],lunch:['09','12','26','10','27','08','30'],
  snack:['35','35','37','37','22','40','40'],dinner:['55','45','33','52','47','53','50']},
};
export function applyTemplate(plan,key){
 const template=TEMPLATES[key];if(!template)throw new Error('Sugestão inválida');
 const result={...plan};
 for(let day=0;day<7;day++)for(const meal of MEALS){const slot=`${day}:${meal.key}`;if(!result[slot])result[slot]={recipeId:template[meal.key][day],portions:1};}
 return result;
}

