# Rotina · espaço para você

Painel pessoal para organizar trabalho, alimentação, água, hábitos, casa, estudos, ateliê, lazer e descanso. Interface para celular e computador, com autenticação e sincronização entre aparelhos.

## Funcionalidades

- **Meu dia:** prioridades, água, refeições, hábitos, agenda e check-in de energia/sono. O modo “Dia leve” reduz o foco para o essencial.
- **Minha semana:** expediente, almoço, compromissos recorrentes, passeio com o cachorro, ateliê e meal prep. Mostra conflitos e janelas livres.
- **Encaixar prioridades:** propõe horários para até três tarefas, respeitando compromissos, intervalos e descanso. Só aplica depois do clique.
- **Tarefas e Casa:** área, duração, data, prioridade e conclusão; busca, pendências anteriores e pequenas sugestões para cuidar da casa.
- **Hábitos:** dias escolhidos, marcações, visão semanal e mapa das últimas 13 semanas. Dias de descanso e futuros não entram como falhas.
- **Objetivos:** passos marcáveis ou progresso numérico, prazo, área e motivação.
- **Estudos:** cronômetro, pausa, registro manual e histórico. O cronômetro usa tempo real e se recupera na mesma aba. A sessão só é salva quando solicitado.
- **Corpo e descanso:** água, movimento, sono, energia e anotações pessoais.
- **Ateliê 3D:** produções por etapa, prazo, tempo de máquina e anotações.
- **Lazer:** livros e páginas lidas, filmes, séries, hobbies e vontades para depois.
- **Minha evolução:** indicadores semanais e reflexão pessoal, sem ranking.
- **Preferências:** horários, fuso, água, pausas, lembretes dentro do site, senha e exportação dos dados.

## OKRArdapio integrado

O catálogo atual de **52 receitas**, as miniaturas e a logo foram recuperados de deborahsales/receitas. Mantém categorias, exclusões, conservação, rendimentos e compras do catálogo atual:

- Busca por ingredientes, filtros e favoritos.
- Cardápio de quatro refeições por dia, porções, anotações livres e registro do consumo.
- Sugestões semanais que preservam as escolhas existentes.
- Compras agrupadas, separando pesos crus e cozidos, por preparos inteiros ou porções.
- Meal prep por lotes, instruções de congelamento e impressão da receita aberta.
- Importação de favoritos, cardápios, extras e compras marcadas do arquivo “Salvar minhas escolhas” do OKRArdapio.

## Sugestões iniciais

O primeiro acesso permite conferir os horários. O expediente inicial é segunda a sexta, **8h às 17h**, com almoço das **12h às 13h**. O passeio começa às **17h15**, por 35 minutos.

Como ponto de partida editável, o ateliê fica terça e quinta das 19h às 21h e sábado das 14h às 17h; o meal prep fica domingo das 10h às 11h30. Hábitos pequenos de casa, estudo, movimento e leitura também são opcionais. Acordar às 7h, desacelerar às 23h e a meta de água podem ser ajustados.

As sugestões também reservam tempo para café da manhã, almoço no fim de semana, jantar e desaceleração antes do sono. O encaixe de tarefas preserva uma margem para os hábitos ainda pendentes. Todos os blocos podem ser alterados.

O sistema começa sem progresso preenchido.

## Tecnologia e desenvolvimento

React + Vite, dependências fixadas e package-lock.json, Supabase Auth e PostgreSQL com RLS. A Vercel publica o frontend a partir deste repositório.

~~~bash
npm ci
npm run dev
npm test
npm run build
~~~

O Vite usa a porta 5173 por padrão. O encaixe de horários e os cálculos são locais; não usam API de inteligência artificial.

## Publicar na Vercel

1. Na Vercel, importe o repositório existente **deborahsales/rotina**.
2. Use **Vite**, build **npm run build** e saída **dist**. O vercel.json já contém a configuração.
3. Publique e anote a URL final para os redirecionamentos do Supabase.
4. Novos commits na branch de produção poderão gerar novos deploys pela integração GitHub–Vercel.

O cliente já aponta para o projeto fornecido. Contém somente URL e uma publishable key, adequada para navegador. Permissões são impostas no banco. Valores podem ser substituídos pelas variáveis:

| Variável | Conteúdo |
| --- | --- |
| VITE_SUPABASE_URL | URL do projeto Supabase |
| VITE_SUPABASE_PUBLISHABLE_KEY | Publishable key do mesmo projeto |

O .env.example mostra os nomes. Nenhuma chave secreta ou service_role é necessária para o frontend.

### Configurar autenticação após o deploy

No Supabase do projeto Rotina, abra **Authentication → URL Configuration**:

1. Defina Site URL com a URL de produção retornada pela Vercel.
2. Em Redirect URLs, inclua a URL de produção e a mesma URL seguida de **/?recovery=1**.
3. Para desenvolvimento, inclua **http://localhost:5173** e **http://localhost:5173/?recovery=1**.

Crie a conta pelo site e confirme o e-mail. O botão Google só aparece se esse provedor estiver habilitado. Confira a configuração e os limites de envio de e-mail do Supabase para o uso em produção.

## Banco

A migração **supabase/migrations/20261018141220_rotina_initial.sql** já foi aplicada ao projeto **tsgnpyxkuruphyadehyi**.

- routine_profiles: identificação de exibição e preferências.
- routine_entries: um registro por tarefa, hábito, copo d'água, refeição, estudo, produção ou outro item.
- Todas as linhas pertencem a um usuário autenticado, com políticas de leitura, inclusão, atualização e exclusão.
- Atualizações verificam também o proprietário resultante. Acesso anônimo às tabelas foi revogado.
- Índices únicos evitam refeições no mesmo horário, marcações de hábito e favoritos duplicados.
- revision avança no servidor. O cliente verifica versões ao salvar e informa conflitos.
- Leituras em segundo plano não substituem gravações recém-realizadas.
- A conta é consultada ao abrir, ao voltar à aba e periodicamente enquanto ela está visível.

Em outro projeto vazio, aplique a migração antes de usar o cliente. Não reaplique a migração inicial ao projeto que já a recebeu.

## Verificação

- **39 testes automatizados**: catálogo, exclusões, rendimentos, compras, importação, fuso, calendário, hábitos e encaixe de tarefas.
- Build de produção concluído.
- Duas tabelas com RLS e quatro políticas por tabela; leitura anônima revogada.
- Teste SQL de isolamento de leitura entre dois usuários simulados, com dados de teste revertidos.
- Verificador de segurança do Supabase sem alertas no momento da verificação.

Cadastro, confirmação de e-mail, recuperação e uso em navegador precisam ser conferidos na URL final após a configuração da Vercel e dos redirecionamentos.

## Limites desta versão

- Lembretes aparecem dentro do site enquanto ele está aberto; não há push com o site fechado.
- Novos registros exigem conexão e só são confirmados após o salvamento no Supabase.
- Acordar e desacelerar são modelados dentro do mesmo dia.
- O ateliê usa planejamento manual, sem integração direta com a impressora.
- Exportação completa em JSON; a importação disponível é a das escolhas do OKRArdapio.
- Receitas são sugestões culinárias, sem cálculo de dieta ou necessidades individuais.

## Organização do código

~~~text
src/App.jsx            autenticação e navegação
src/store.jsx          sincronização e gravações
src/components.jsx     componentes e formulários comuns
src/widgets.jsx        água, tarefas e check-in
src/food.jsx           OKRArdapio integrado
src/pages/             telas do aplicativo
src/lib/domain.js      datas, agenda e indicadores
src/lib/recipes.js     regras do OKRArdapio
src/data/recipes.json  catálogo atual
public/assets/         miniaturas e identidade do OKRArdapio
supabase/migrations/   esquema e políticas
tests/                 verificações automatizadas
~~~
