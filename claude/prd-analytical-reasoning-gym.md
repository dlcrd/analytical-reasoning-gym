# PRD — Analytical Reasoning Gym (Business Analyst Companion)

> Resumo do documento `requisitos-melhora em analytics.pdf` (33 páginas), fornecido por Diego na pasta "Business Analyst Improver". Documento original é uma resposta estruturada sobre como adaptar a lógica pedagógica do "Analyst Gym" (sessões curtas, formatos variados, confiança declarada antes do feedback) para um produto próprio, focado em arquitetura analítica e implementação SQL.

> ⚠️ **Este documento é a visão original e completa, mantida como referência histórica — não foi reescrito.** O escopo real decidido para o V1, após uma sessão de grilling que ajustou vários pontos (autenticação, PWA, dicas, quantidade de exercícios, quando a geração por IA entra, domínios iniciais), está em `claude/v1-escopo-decisoes.md`. **Onde os dois divergirem, o documento de decisões vale — em especial o roadmap da seção 17 abaixo, que é a proposta original e não o que foi de fato decidido.**

## 1. Visão do produto

Aplicação web **mobile-first** (PWA) para prática deliberada de raciocínio analítico, definição de métricas, arquitetura de consultas e SQL.

**Não é** um banco simples de exercícios de SQL. Acertar a sintaxe SQL não significa acertar o exercício — o usuário pode saber a sintaxe perfeitamente e ainda construir uma análise conceitualmente errada.

Cadeia de raciocínio que o produto treina:

```
Problema de negócio → Pergunta analítica → Definição das métricas →
População e granularidade → Estrutura dos dados → Plano de transformação →
SQL → Validação → Interpretação
```

Cada etapa é avaliada separadamente.

## 2. Princípio central

**"Concept first. Query second."** Antes de liberar a implementação, o sistema deve perguntar recorrentemente:
O que você está tentando medir? Qual é a população? O que uma linha do resultado representa? Qual é o numerador/denominador? Qual período está sendo considerado? Quais dados são necessários? Qual deve ser a sequência de transformações?

## 3. Plataforma

PWA responsiva. Prioridade: **1. Celular, 2. Desktop, 3. Tablet.** Deve funcionar pelo navegador, ser instalável na home screen, permitir continuar sessão entre dispositivos, e permitir exercícios conceituais confortavelmente no celular (SQL quando necessário; teclado físico normal no desktop). Sem dependência de app nativo inicialmente.

## 4. Stack sugerida

- **Frontend**: Next.js, TypeScript, Tailwind CSS
- **Backend**: Next.js / API routes
- **Database**: PostgreSQL (banco de exercícios separado do banco operacional)
- **ORM**: Drizzle ou Prisma
- **Auth**: Auth.js (ou equivalente)
- **SQL sandbox**: DuckDB-WASM (exercícios locais) ou PostgreSQL isolado (server-side)
- **Charts**: Recharts
- **Editor SQL**: CodeMirror 6

## 5. Home

Extremamente simples. Exemplo de layout: streak (dias seguidos), saudação, sessão do dia sugerida (duração + formatos), "weakest skills" com % de acerto e botão "Practice weaknesses". Objetivo: abrir o celular e começar uma sessão em poucos segundos.

## 6. Tipos de sessão (modos do produto)

| # | Modo | Descrição resumida |
|---|------|---------------------|
| A | **Daily Drill** | 2–5 min. Julgamento analítico rápido (ex.: dado um cenário, decidir o que investigar primeiro + declarar confiança 20-100%). Feedback avalia decisão, justificativa, confiança e calibração. |
| B | **Metric Lab** | Um dos modos principais. Sem SQL inicial. Perguntas progressivas: (1) população/denominador, (2) definição do evento, (3) janela de tempo, (4) fórmula (numerador/denominador), (5) só então implementar em SQL. |
| C | **Granularity Trainer** | Treina granularidade especificamente. Usuário identifica o que representa 1 linha em cada estágio (pedido → loja × mês → região × mês) e monta visualmente o pipeline (GROUP BY, WINDOW) antes de escrever SQL. |
| D | **Query Architecture** | **O modo mais importante da aplicação.** Problema complexo, mas sem editor SQL imediato. Usuário define grain final, métricas necessárias, e monta um plano de transformação em blocos (raw → aggregate → window → calculate) antes de implementar. |
| E | **Architecture Puzzle** | Versão rápida do anterior (2–4 min). Blocos embaralhados (ex.: Apply LAG, Filter period, Aggregate, Calculate growth, Join customers) que o usuário deve ordenar corretamente. Bom para celular — não exige digitar SQL. |
| F | **Rapid Fire** | Inspirado no Analyst Gym. 12 questões curtas consecutivas, avaliadas por precisão. Cobre não só sintaxe (INNER/LEFT/CROSS JOIN, GROUP BY vs WINDOW, LAG/LEAD/RANK, causas de explosão de linhas em JOIN) mas também conceitos (ex.: diferença entre queda de 20% para 10% em % vs p.p.). |
| G | **Investigation Budget** | Adaptação do formato "Currency" do Analyst Gym. Usuário tem um orçamento de créditos (ex.: 100) e escolhe quais investigações vale a pena pagar (cada uma custa créditos e revela informação) até chegar a uma recomendação gastando o mínimo possível. Avalia correção, eficiência de investigação, priorização e "stopping judgment". |
| H | **Scenario** | Inspirado no formato sequencial do Analyst Gym. Cenário multi-dia (ex.: segunda a quarta) em que novas informações aparecem conforme decisões são tomadas por um CEO/stakeholder fictício. Cada decisão modifica confiança analítica, confiança do stakeholder, custo de investigação e qualidade da decisão. |
| I | **SQL Build** | Modo tradicional de SQL, mas contextualizado por categoria (filtering, aggregation, joins, dates, CTEs, subqueries, conditional aggregation, window functions, ranking, running totals, rolling windows, LAG/LEAD, multi-grain, complex pipelines). Nunca apresentar como "faça um exercício de LAG" — sempre como problema de negócio; o usuário deve descobrir qual função é apropriada. |
| J | **Multi-Grain Challenge** | Categoria dedicada a cálculos envolvendo múltiplas granularidades simultâneas (ex.: company×month vs month; product×store vs store; customer×week vs customer history). Ensina explicitamente que uma transformação pode precisar criar a granularidade necessária para a próxima transformação. |
| K | **Metric Debugger** | Mostra uma query que roda sem erro mas produz métrica errada (problema conceitual escondido, ex.: denominador incluindo status inelegíveis). Pergunta: "The SQL runs successfully. Is the metric correct?" — usuário precisa achar o problema conceitual, não sintático. |
| L | **Query Debugger** | O inverso: lógica correta, mas SQL quebrado. Tipos de erro cobertos: binder error, parser error, wrong alias, invalid GROUP BY, integer division, NULL behavior, wrong JOIN key, WHERE destruindo LEFT JOIN, duplicated rows, date type mismatch, window nesting. |
| M | **Grain Debugger** | Mostra explosão de linhas após JOIN (ex.: 100k → 2.4M linhas). Pergunta o que checar primeiro, depois mostra schemas. Objetivo: detectar relações 1:N/N:N. |
| N | **Metric Reverse Engineering** | Mostra só uma tabela de resultado (ex.: taxa de conversão mensal) e pergunta "What assumptions must be true for this metric to be meaningful?". Usuário deve questionar definição de user, elegibilidade, janela, cohort, evento de conversão, duplicidade. |
| O | **Explain Before You Code** | Modo de entrevista/live analysis. Cronômetro: problema mostrado, 90 segundos, **proibido escrever SQL**. Usuário preenche: grain final, população, métrica, janela temporal, tabelas, plano. Só depois o editor desbloqueia. |
| P | **Ambiguous Requirements** | Exercícios deliberadamente incompletos (ex.: "Calculate monthly retention" sem definição adicional). Objetivo é não sair codando — usuário escolhe entre perguntas de esclarecimento disponíveis (o que conta como retido? definição de cohort? janela de observação? evento de atividade?) e a qualidade das perguntas é pontuada. |
| Q | **Validation Lab** | Query aparentemente pronta. Pergunta "Before presenting this result, what would you validate?" — opções incluem row counts, NULLs, duplicates, join cardinality, min/max dates, distribution, impossible values, denominator, sample records, reconciliation com totais conhecidos. |
| R | **Confidence Calibration** | Presente em praticamente todos os exercícios: declarar confiança (escala 20-100) antes do feedback. Sistema guarda confidence + correctness e gera um "Calibration Score" (ex.: accuracy 76% vs confiança média 89% → padrão de excesso de confiança em questões de definição de métrica). |

## 7. Biblioteca de conteúdo

**Mínimo inicial: 300 exercícios**, distribuídos assim:

| Área | Quantidade |
|---|---|
| Métricas | 50 |
| Granularidade | 40 |
| Query Architecture | 50 |
| SQL | 50 |
| Debugging | 30 |
| Investigação | 25 |
| Validação | 20 |
| Ambiguidade | 15 |
| Comunicação | 10 |
| Cenários longos | 10 |

**Domínios de negócio** (evitar concentrar tudo em um único contexto): e-commerce, fintech, SaaS, telecom, marketplace, delivery, mobility, streaming, gaming, advertising, retail, logistics, healthcare operations, travel, subscription products, education, energy, insurance, B2B sales, consumer apps.

**Bancos de métricas por área**: Growth (Revenue, GMV, Orders, AOV, ARPU, Growth rate, Market share, Contribution), Product (Activation, Conversion, Retention, Churn, DAU/WAU/MAU, Stickiness, Feature adoption, Funnel conversion), Marketing (CTR, CPC, CPA, CAC, ROAS, Conversion, Incrementality), Operations (Delivery time, Cancellation rate, SLA, Failure rate, Utilization, Throughput), Finance (Approval rate, Default rate, Delinquency, Loss rate, Exposure, Recovery rate), Customer (Repeat purchase, LTV, Support rate, NPS response, Refund rate).

O sistema deve variar especialmente **denominadores e populações elegíveis** — é onde a maioria dos erros analíticos aparece.

## 8. Progressão de dificuldade

Não usar apenas Easy/Medium/Hard. Usar **níveis de arquitetura**:

L1 Single metric → L2 Aggregation → L3 Join → L4 Multiple metrics → L5 Multiple grains → L6 Sequential transformations → L7 Ambiguous business problem → L8 Investigation → L9 Complex case → L10 Open-ended analysis.

## 9. Sistemas de progresso e personalização

- **Skill Graph**: cada exercício tem tags internas (ex.: `metric_definition`, `grain`, `aggregation`, `window_function`, `denominator`, `validation`) alimentando um dashboard "Analytical Reasoning" com barras de progresso por skill.
- **Adaptive Practice**: sistema seleciona exercícios com base nos erros anteriores das últimas 20 sessões (ex.: fraqueza em "window syntax" 88%, "multi-grain architecture" 54% → próxima sessão prioriza 40% multi-grain, 30% metric definition, 15% validation, 15% mixed). Varia domínio e estrutura mantendo a habilidade subjacente — não repetir a mesma questão.
- **Error taxonomy**: todo erro classificado como SYNTAX, SEMANTIC, METRIC, GRAIN, POPULATION, DENOMINATOR, JOIN, TIME, LEAKAGE, ARCHITECTURE, VALIDATION ou INTERPRETATION.
- **Feedback**: nunca responder só "Wrong". Sempre um checklist granular (SQL syntax ✓, Population ✓, Granularity ✗, Metric ✓, Architecture ✗, Validation —) + explicação do ponto exato da falha + diagrama do pipeline esperado. Não entregar a query correta imediatamente.
- **Hint system**: 3 níveis — (1) conceito, ex. "What should one row represent before calculating this metric?"; (2) arquitetura (esqueleto do pipeline); (3) implementação (trecho parcial). Cada hint usado reduz a pontuação de autonomia.
- **Autonomy Score**: métrica própria considerando: resolvido sem hints, número de hints, tentativas erradas, revisões de arquitetura, tempo até a solução, se validação foi executada. Diferencia "conseguiu depois de três dicas" de "estruturou sozinho".

## 10. Workout Mode e Boss Fight

Sessões prontas por duração:
- **10 min**: 2 Rapid Fire, 1 Metric Lab, 1 Architecture Puzzle, 1 SQL
- **20 min**: 5 Rapid Fire, 2 Metrics, 2 Architecture, 1 SQL Case
- **45 min**: Warm-up → Metric definition → Architecture → SQL implementation → Debugging → Open case → Debrief

**Boss Fight**: uma vez por semana, case completo de 30–45 min. Cenário de negócio realista (ex.: "receita caiu nas últimas 6 semanas, determine o que está acontecendo e produza uma recomendação"), com tabelas brutas fornecidas mas **nenhuma função SQL sugerida** — usuário decide tudo: problem framing, metric definition, architecture, SQL, validation, interpretation, recommendation.

## 11. UX mobile

No celular, evitar editor de código gigante. Usar **cards progressivos** (uma pergunta por tela, "Continue →") e um **Architecture Builder** tipo drag-and-drop (arrastar blocos como GROUP BY, JOIN, FILTER, WINDOW, CALCULATE para um pipeline visual) — permite treinar arquitetura analítica no ônibus/sofá/fila sem digitar SQL.

**"Explain it"**: após resolver, pedir para explicar o raciocínio em 30 segundos (texto inicialmente; futuramente áudio/transcrição). Avaliar presença de: population, grain, metric definition, comparison, result, limitation.

## 12. Geração de conteúdo por IA

**Case Generator**: cases parametrizados via schema JSON (`domain`, `difficulty`, `skills`, `prompt`, `dataset`, `expected_reasoning`, `expected_architecture`, `solution_sql`, `common_errors`, `hints`) — permite gerar milhares de variações.

**Regra crítica**: a IA não deve simplesmente gerar uma pergunta e uma resposta. Cada exercício gerado deve conter internamente: canonical metric definition, expected population, expected grain, expected transformation graph, expected output, reference SQL, validation checks, common wrong solutions, reasoning rubric. **O SQL de referência deve ser executado automaticamente antes de publicar o exercício — se o resultado não puder ser validado, o exercício não entra no banco.**

## 13. Seed datasets sintéticos

Bancos reutilizáveis por domínio, cada um com relações 1:N **e** algumas N:N (para armadilhas realistas de JOIN):
- **CommerceDB**: users, sessions, orders, order_items, payments, products, merchants, refunds
- **SubscriptionDB**: accounts, subscriptions, plans, invoices, payments, usage_events, support_tickets
- **MobilityDB**: users, drivers, rides, payments, cities, promotions
- **MarketingDB**: campaigns, impressions, clicks, conversions, spend, customers
- **RetailDB**: stores, customers, transactions, transaction_items, products, inventory

## 14. Cases que PRECISAM existir na biblioteca inicial

Combinações obrigatórias de padrões técnicos: GROUP BY→WINDOW; JOIN→GROUP BY→WINDOW; GROUP BY→LAG; GROUP BY→WINDOW→FILTER; múltiplas CTEs com grains diferentes; company vs total; segment vs overall population; current vs historical period; rolling average; running total; share of total; percentage-point change vs relative percentage change; cohort metrics; conditional denominators; eligible populations; deduplication before aggregation; 1:N e N:N join inflation; LEFT JOIN filter mistake; NULL denominator; integer division; date cohort vs event date; current state vs historical state; latest/first record per entity; event sequences; multiple events in rolling window.

## 15. Métrica de sucesso do produto

**Não otimizar para**: quantos exercícios o usuário fez.
**Otimizar para**: quanto menos ajuda ele precisa para estruturar problemas novos.

Dashboard "30 Day Development" com evolução de: Correctness, Autonomy, Architecture, Metric Definition, SQL (ex.: Correctness 71→84, Autonomy 54→73, Architecture 49→76).

**Critério de sucesso comportamental**: diante de um pedido tipo *"Calcule a taxa X de cada segmento, compare-a com a taxa geral do mês e mostre sua evolução acumulada"*, o comportamento esperado não é abrir o editor imediatamente — deve ser automático pensar: O que é X? → Qual população? → Numerador/denominador? → Resultado final em qual grain? → Preciso criar qual grain intermediário? → Quais etapas dependem das anteriores? → GROUP BY? → WINDOW? → Agora SQL. **Essa mudança de comportamento é o verdadeiro produto.**

## 16. Relação com o Analyst Gym (referência)

O documento incorpora a lógica pedagógica do Analyst Gym — sessões curtas, formatos variados (Lesson, Rapid Fire, Currency, Scenario), confiança declarada antes do feedback — **sem copiar o produto**. O diferencial proposto é uma camada muito mais forte de **metric definition → grain → query architecture → implementation**, que os formatos do Analyst Gym não cobrem.

## 17. Roadmap

**V1 (MVP)**: Authentication, PWA/mobile layout, Daily Drill, Metric Lab, Granularity Trainer, Architecture Puzzle, SQL Build, Feedback, Hints, Skill tracking, Streak. **100 exercícios manuais/seeded de alta qualidade.**

**V2**: Rapid Fire, Investigation Budget, Scenario, Adaptive Practice, Autonomy Score, Boss Fight.

**V3**: AI case generation, Personalized workouts, Voice reasoning, Advanced analytics, Large case datasets.

---
*Resumo gerado a partir do PDF original para reduzir custo de releitura em sessões futuras. Consulte o PDF original na pasta do usuário para qualquer detalhe visual (mockups de telas, JSON completo) que não tenha sido totalmente capturado aqui.*