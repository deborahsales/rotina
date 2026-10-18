import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, stat } from 'node:fs/promises';
import { CATEGORIES, MEALS, TEMPLATES, normalize, escapeHTML, filterRecipes, compatible, parseQuantity, canonicalIngredient, preparationGroups, shoppingList, formatShoppingQuantity, freshState, sanitizeState, localISO, parseDate, monday, shiftDays, weekDays, applyTemplate } from '../src/lib/recipes.js';

const recipes = JSON.parse(await readFile(new URL('../src/data/recipes.json', import.meta.url), 'utf8'));
const byId = new Map(recipes.map(r => [r.id, r]));
const entry = (recipeId, portions = 1) => ({ recipeId, portions });
const itemFor = (result, prefix) => result.items.find(i => i.label.startsWith(prefix));

test('catálogo completo: 52 IDs únicos e contagens por categoria', () => {
  assert.equal(recipes.length, 52); assert.equal(byId.size, 52);
  assert.deepEqual(recipes.map(r => r.id), Array.from({ length: 55 }, (_, i) => String(i + 1).padStart(2, '0')).filter(id => !['29', '48', '54'].includes(id)));
  assert.deepEqual(CATEGORIES.map(c => recipes.filter(r => r.category === c.name).length), [6, 18, 15, 13]);
  assert.equal(recipes.filter(r => r.is_creami).length, 3);
  assert.equal(recipes.filter(r => r.has_gelatin).length, 2);
});
test('cada receita tem ingredientes, instruções, porção, alérgenos e conservação', () => {
  for (const recipe of recipes) {
    for (const field of ['title', 'subtitle', 'time', 'yield_text', 'serving', 'storage', 'freeze', 'thaw', 'allergens', 'equipment']) assert.ok(recipe[field]?.length, `${recipe.id}: ${field}`);
    assert.ok(recipe.ingredients.length >= 4); assert.ok(recipe.steps.length >= 3); assert.ok(recipe.methods.length >= 2);
    assert.ok(recipe.equipment_tags.length >= 1); assert.ok(recipe.base_portions >= 1);
    for (const pair of [...recipe.ingredients, ...recipe.steps, ...recipe.methods]) assert.ok(pair.length === 2 && pair.every(x => typeof x === 'string' && x.length));
  }
});
test('busca ignora acentos e encontra ingredientes', () => {
  assert.equal(normalize('  CAFÉ da manhã '), 'cafe da manha');
  assert.ok(filterRecipes(recipes, { search: 'grao de bico' }).some(r => r.id === '18'));
  assert.ok(filterRecipes(recipes, { search: 'iogurte morango' }).some(r => r.id === '38'));
  assert.equal(filterRecipes(recipes, { search: 'ingrediente-inexistente' }).length, 0);
});
test('filtros combinam categoria, ingrediente, equipamento e favoritos', () => {
  assert.deepEqual(filterRecipes(recipes, { ingredient: 'gelatin' }).map(r => r.id), ['36', '37']);
  assert.deepEqual(filterRecipes(recipes, { ingredient: 'creami', equipment: 'Ninja Creami' }).map(r => r.id), ['38', '39', '40']);
  assert.deepEqual(filterRecipes(recipes, { category: 'Lanche', onlyFavorites: true }, ['01', '19']).map(r => r.id), ['19']);
  assert.equal(filterRecipes(recipes, { equipment: 'Airfryer', search: 'smoothie' }).length, 0);
  assert.equal(filterRecipes(recipes, { freezer: 'none', ingredient: 'gelatin' }).length, 2);
});
test('preparos que dependem de espera preservam o tempo completo no card', () => {
  const quick = filterRecipes(recipes, { maxTime: 10, ingredient: 'creami' });
  assert.equal(quick.length, 3); assert.ok(quick.every(r => r.time.includes('24 h')));
});
test('compatibilidade respeita a reclassificação de almoço e jantar e alternativas de café', () => {
  assert.equal(compatible(byId.get('07'), 'dinner'), false); assert.ok(compatible(byId.get('20'), 'breakfast'));
  assert.ok(compatible(byId.get('04'), 'dinner')); assert.equal(compatible(byId.get('04'), 'breakfast'), false);
  assert.ok(compatible(byId.get('13'), 'lunch')); assert.equal(compatible(byId.get('13'), 'dinner'), false);
  assert.ok(compatible(byId.get('33'), 'dinner')); assert.ok(compatible(byId.get('55'), 'dinner'));
  assert.ok(compatible(byId.get('24'), 'snack')); assert.equal(compatible(byId.get('38'), 'lunch'), false);
});
test('catálogo ativo e sugestões excluem receitas removidas', () => {
  assert.equal(JSON.stringify(recipes).toLowerCase().includes('lentilh'), false);
  assert.equal(recipes.some(r => r.id === '54'), false);
  const safe = sanitizeState({ favorites: ['29', '48', '54', '55'], plans: { '2026-10-12': { '0:dinner': entry('54'), '1:dinner': entry('55') } } }, recipes);
  assert.deepEqual(safe.favorites, ['55']); assert.equal(safe.plans['2026-10-12']['0:dinner'], undefined);
});
test('duas porções do caldo de camarão usam um preparo completo', () => {
  const result = shoppingList({ '0:dinner': entry('55'), '1:dinner': entry('55') }, recipes);
  assert.equal(result.groups.length, 1); assert.equal(result.groups[0].multiplier, 1);
  const shrimp = itemFor(result, 'Camarão'); assert.equal(shrimp.value, 320); assert.equal(shrimp.group, 'Proteínas');
});
test('novos jantares separam pesos crus e cozidos na compra', () => {
  const result = shoppingList({ '0:dinner': entry('50'), '1:dinner': entry('53'), '2:dinner': entry('41') }, recipes);
  assert.equal(itemFor(result, 'Carne bovina magra cozida').value, 180);
  assert.equal(itemFor(result, 'Carne bovina magra crua').value, 300);
  assert.equal(itemFor(result, 'Macaxeira cozida').value, 300);
  assert.equal(itemFor(result, 'Frango cozido').value, 200);
});
test('datas locais: segunda-feira, domingo e virada de ano', () => {
  assert.equal(monday(parseDate('2027-01-01')), '2026-12-28');
  assert.equal(monday(parseDate('2026-10-18')), '2026-10-12');
  assert.equal(shiftDays('2026-12-28', 7), '2027-01-04');
  assert.equal(localISO(weekDays('2026-12-28')[6]), '2027-01-03');
  assert.equal(parseDate('2026-02-30'), null); assert.equal(parseDate('x'), null);
});
test('leitura de quantidades preserva unidades e usa limite superior de faixas', () => {
  assert.deepEqual(parseQuantity('15-30 ml'), { value: 30, unit: 'ml', upper: true });
  assert.deepEqual(parseQuantity('0,5 kg'), { value: 500, unit: 'g', upper: false });
  assert.deepEqual(parseQuantity('50 g / 1 un.'), { value: 50, unit: 'g', upper: false });
  assert.equal(parseQuantity('a gosto').text, 'a gosto');
});
test('pesos de frango cru e cozido são mantidos separados', () => {
  assert.notEqual(canonicalIngredient('Peito de frango cru').label, canonicalIngredient('Frango já cozido e desfiado').label);
  const result = shoppingList({ '0:lunch': entry('07'), '0:dinner': entry('30') }, recipes);
  assert.ok(itemFor(result, 'Peito de frango cru')); assert.ok(itemFor(result, 'Frango cozido'));
});
test('uma fornada de brownie atende três lanches', () => {
  const plan = { '0:snack': entry('19'), '1:snack': entry('19'), '2:snack': entry('19') };
  const result = shoppingList(plan, recipes);
  assert.equal(result.groups.length, 1); assert.equal(result.groups[0].multiplier, 1);
  assert.equal(itemFor(result, 'Banana').value, 200);
  const fourth = shoppingList({ ...plan, '3:snack': entry('19') }, recipes);
  assert.equal(fourth.groups[0].multiplier, 2); assert.equal(itemFor(fourth, 'Banana').value, 400);
});
test('modo por porções permite uma fração do preparo', () => {
  const result = shoppingList({ '0:snack': entry('19') }, recipes, 'portions');
  assert.equal(result.groups[0].multiplier, 1 / 3);
  assert.ok(Math.abs(itemFor(result, 'Banana').value - 200 / 3) < 1e-8);
});
test('iogurte complementar do muffin só entra no café da manhã', () => {
  const snack = shoppingList({ '0:snack': entry('20') }, recipes);
  assert.equal(itemFor(snack, 'Iogurte'), undefined);
  const mixed = shoppingList({ '0:breakfast': entry('20', 2), '1:snack': entry('20') }, recipes);
  assert.equal(mixed.groups[0].multiplier, 1); assert.equal(itemFor(mixed, 'Iogurte').value, 320);
});
test('quadradinhos têm rendimentos diferentes no café e no lanche', () => {
  const result = shoppingList({ '0:breakfast': entry('25'), '1:snack': entry('25') }, recipes);
  assert.equal(result.groups[0].fraction, 0.5); assert.equal(result.groups[0].multiplier, 1);
  assert.equal(itemFor(result, 'Iogurte').value, 160); assert.equal(itemFor(result, 'Aveia').value, 120);
});
test('aveia de geladeira: um café equivale a dois lanches', () => {
  assert.equal(preparationGroups({ '0:breakfast': entry('24') }, recipes)[0].multiplier, 1);
  assert.equal(preparationGroups({ '0:snack': entry('24'), '1:snack': entry('24') }, recipes)[0].multiplier, 1);
});
test('gelatina em dias distantes gera novos preparos dentro dos prazos frios', () => {
  const adjacent = preparationGroups({ '0:snack': entry('36'), '1:snack': entry('36') }, recipes);
  assert.equal(adjacent.length, 1); assert.equal(adjacent[0].multiplier, 1);
  const distant = preparationGroups({ '0:snack': entry('36'), '3:snack': entry('36') }, recipes);
  assert.equal(distant.length, 2); assert.ok(distant.every(p => p.multiplier === 1));
});
test('reserva opcional para Re-Spin entra pelo limite superior', () => {
  const result = shoppingList({ '0:snack': entry('38'), '1:snack': entry('38') }, recipes);
  const milk = itemFor(result, 'Leite integral');
  assert.equal(milk.value, 60); assert.equal(milk.upper, true); assert.equal(milk.optional, true);
  assert.equal(formatShoppingQuantity(milk), 'até 60 ml');
});
test('água não é comprada e unidades grandes ficam legíveis', () => {
  const result = shoppingList({ '0:lunch': entry('11') }, recipes);
  assert.equal(result.items.some(i => i.label === 'Água'), false);
  assert.equal(formatShoppingQuantity({ value: 1200, unit: 'g' }), '1,2 kg');
  assert.equal(formatShoppingQuantity({ value: 1500, unit: 'ml' }), '1,5 L');
});
test('sugestões preenchem 28 refeições e respeitam escolhas existentes', () => {
  for (const key of Object.keys(TEMPLATES)) {
    const plan = applyTemplate({}, key); assert.equal(Object.keys(plan).length, 28);
    for (const [slot, item] of Object.entries(plan)) { assert.ok(byId.has(item.recipeId)); assert.ok(compatible(byId.get(item.recipeId), slot.split(':')[1]), `${key} ${slot} ${item.recipeId}`); }
  }
  assert.deepEqual(applyTemplate({ '0:lunch': entry('09', 3) }, 'pratica')['0:lunch'], entry('09', 3));
});
test('importação valida IDs, datas, quantidades e limites', () => {
  const input = { version: 1, favorites: ['01', '99', '01'], plans: { '2026-10-12': { '0:lunch': entry('07', 999), '1:dinner': entry('99'), '9:lunch': entry('08'), '1:breakfast': entry('01', 1.5) }, '2026-10-13': { '0:lunch': entry('07') }, nope: {} }, extras: { '2026-10-12': [{ id: 'x', name: 'A'.repeat(300), quantity: 'B'.repeat(300) }] }, checks: { '2026-10-12': ['abc', 'abc', 8, 'x'.repeat(300)] }, shoppingMode: 'unexpected' };
  const safe = sanitizeState(input, recipes);
  assert.deepEqual(safe.favorites, ['01']); assert.equal(safe.plans['2026-10-12']['0:lunch'].portions, 12);
  assert.equal(safe.plans['2026-10-12']['1:breakfast'].portions, 1);
  assert.equal(safe.plans['2026-10-13'], undefined); assert.equal(Object.keys(safe.plans['2026-10-12']).length, 2);
  assert.deepEqual(safe.checks['2026-10-12'], ['abc']); assert.equal(safe.extras['2026-10-12'][0].name.length, 120);
  assert.equal(safe.shoppingMode, 'batch'); assert.deepEqual(sanitizeState(null, recipes), freshState());
});
test('texto digitado é escapado antes de entrar na interface', () => {
  assert.equal(escapeHTML('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});

test('as 52 miniaturas e a identidade do OKRArdapio foram integradas', async () => {
 for(const r of recipes)assert.ok((await stat(new URL('../public/assets/recipes/'+r.id+'-small.webp',import.meta.url))).size>1000);
 assert.ok((await stat(new URL('../public/assets/okrardapio-horizontal.webp',import.meta.url))).size>1000);
});

