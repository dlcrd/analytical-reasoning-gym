# Analytical Reasoning Gym — Escopo do V1 (decisões travadas)

> Este documento é o resultado de uma sessão de "grilling" (stress-test de plano) sobre o PRD original (`claude/prd-analytical-reasoning-gym.md`). Ele **substitui** o corte de V1 originalmente proposto no PRD e é a base pra abrir uma sessão de implementação no Claude Code. Onde este documento diverge do PRD original, **este documento vale**.

## 1. Contexto

Ferramenta pessoal de Diego (BeegolAI) para treinar raciocínio analítico — não apenas sintaxe SQL, mas a cadeia completa problema de negócio → pergunta analítica → definição de métrica → população/granularidade → arquitetura de query → SQL → validação → interpretação.

- **Usuário**: só Diego. Sem prazo firme — projeto de aprendizado pessoal.
- **Quem constrói**: Diego + Claude Code/Cowork. Este documento é o output do planejamento; a implementação de fato acontece numa sessão separada do Claude Code.
- **Nível do praticante**: já é analista, não é iniciante. O treino começa em nível intermediário e escala para avançado — não cobre fundamentos básicos de SQL/agregação simples.

## 2. Plataforma e infraestrutura

| Decisão | Escolha |
|---|---|
| Formato | Web app responsivo (funciona bem no navegador do celular). **Não** é PWA instalável nem app nativo — mobile-first foi relaxado para "mobile-friendly". |
| Autenticação | **Nenhuma.** Usuário único implícito. Se for deployado publicamente, proteger com senha simples via variável de ambiente — sem tela de login, sem contas. |
| Deploy | Hospedagem simples (ex.: Vercel) para acesso via navegador do celular fora de casa. Não rodar só localmente. |
| Execução de SQL | **DuckDB-WASM**, client-side, no navegador. Sem servidor de sandbox isolado — não há usuário não-confiável a se proteger. |
| Dados operacionais | Um banco (Postgres, conforme stack do PRD) guarda progresso do usuário e o índice/metadados do banco de exercícios. Separado dos datasets usados dentro dos exercícios (esses vivem no DuckDB-WASM). |

## 3. Modos de sessão incluídos no V1

Apenas quatro modos, todos do PRD original (seções 6-14), cobrindo o núcleo pedagógico:

1. **Metric Lab** — sem SQL inicial; perguntas progressivas (população → evento → janela temporal → fórmula) antes de implementar.
2. **Granularity Trainer** — treina especificamente o que "1 linha" representa em cada estágio do pipeline; monta visualmente antes de escrever SQL.
3. **Query Architecture** (versão completa, não a versão puzzle) — problema complexo sem editor SQL imediato; usuário define grain final, métricas necessárias e monta o plano de transformação em blocos antes de implementar.
4. **SQL Build** — modo tradicional de SQL, mas sempre contextualizado por problema de negócio (nunca "faça um exercício de LAG"); cobre filtering, aggregation, joins, dates, CTEs, subqueries, window functions, ranking, running totals, LAG/LEAD, multi-grain, pipelines complexos.

**Explicitamente fora do V1**: Daily Drill, Architecture Puzzle, Rapid Fire, Investigation Budget, Scenario, Metric/Query/Grain Debugger, Metric Reverse Engineering, Explain Before You Code, Ambiguous Requirements, Validation Lab, Confidence Calibration, Multi-Grain Challenge dedicado, Workout Mode, Boss Fight. Todos ficam para V2/V3, sem compromisso de data.

## 4. Conteúdo e geração de exercícios

- **Quantidade inicial**: 65 exercícios.
- **Geração**: via **script reutilizável** de autoria (rodado agora ou quando quiser mais lotes) — **não** é uma feature ao vivo dentro do produto. Sem botão de "gerar exercício novo" pro usuário no V1.
- **Validação obrigatória**: todo exercício gerado deve ter seu SQL de referência executado automaticamente contra o dataset antes de entrar no banco. Se não validar, não entra (regra herdada do PRD original, seção 39).
- **Persistência para lotes futuros**: o script deve manter, por exercício, os arquivos gerados e os metadados (domínio, skills/tags, nível de dificuldade, SQL de referência, dataset usado). Isso permite que a próxima rodada de geração receba o histórico como contexto e produza exercícios direcionados — sem repetir padrões já cobertos e sem perder rastreabilidade do que já existe.
- **Domínios no V1**: 3 para começar — **e-commerce, SaaS, fintech** (genéricos, sem contexto específico da BeegolAI). Os demais domínios do PRD original ficam para expansões futuras.
- **Faixa de dificuldade**: pula L1 (métrica única) e L2 (agregação simples) por serem básicos demais. Conteúdo real começa em **L3/L4** e escala até **L10** (análise aberta).

## 5. Progressão e nivelamento

- **Teste de nivelamento**: único e curto (12-16 questões, dificuldade média ~L4/L5, misturando os 4 modos) na primeira vez que o usuário usa o app. Define o nível inicial de partida em cada modo.
- **Nível é persistente por modo** — não é um nível único geral, e não é segmentado por assunto/fraqueza específica. Metric Lab, Granularity Trainer, Query Architecture e SQL Build evoluem cada um no seu próprio ritmo.
- **Regra de avanço**: sobe de nível após **2 acertos seguidos sem nenhuma ajuda** naquele nível/modo.
- **Regra de erro**: o nível **não regride** automaticamente após um erro — só trava a progressão até os 2 acertos seguidos necessários.
- **Sem seleção adaptativa por tópico/fraqueza no V1** — isso é explicitamente adiado pro V2 (Adaptive Practice do PRD original). O V1 é progressão de carga simples (fica mais difícil conforme acerta), não direcionamento por lacuna de assunto.

## 6. Feedback

- **Sistema de dicas: cortado do V1.** Nenhum hint em nenhuma situação — simplifica o que precisa ser construído.
- Feedback pós-resposta continua **granular** (checklist do que foi acertado/errado por etapa — ex.: SQL syntax ✓, Population ✓, Granularity ✗ — com explicação do ponto exato da falha), conforme seção 31 do PRD original. Nunca só "Wrong.".
- Como não há dicas, todo acerto contado pra progressão de nível é, por definição, um acerto sem ajuda.

## 7. Gamificação e acompanhamento

- Manter **streak simples** e um **dashboard leve de skills** (barra de progresso por skill/tag, ao estilo do Skill Graph do PRD original, seção 28).
- **Fora do V1**: Autonomy Score dedicado, Calibration Score, qualquer gamificação além do streak básico.

## 8. Resumo do que fica fora do V1 (checklist)

- Autenticação / contas de usuário
- PWA instalável / app nativo
- Sistema de dicas
- Seleção adaptativa por fraqueza de assunto (Adaptive Practice completo)
- Geração de exercícios ao vivo dentro do produto
- Autonomy Score / Calibration Score
- Daily Drill, Architecture Puzzle, Rapid Fire, Investigation Budget, Scenario, todos os modos de debugging/validação, Workout Mode, Boss Fight
- Domínios além de e-commerce, SaaS e fintech
- Mais de 65 exercícios na primeira leva

## 9. Próximos passos

Este documento + o PRD original (`claude/prd-analytical-reasoning-gym.md`) formam a base para abrir uma sessão de implementação no Claude Code. Sugestão de ordem de trabalho lá:

1. Scaffold do projeto (Next.js + TypeScript + Tailwind, conforme stack do PRD).
2. Schema do banco operacional (progresso por modo, índice de exercícios).
3. Script de geração + validação de exercícios (rodar para produzir os 65 iniciais, 3 domínios, L3-L10).
4. Datasets sintéticos dos 3 domínios para o DuckDB-WASM.
5. Teste de nivelamento.
6. Os 4 modos de sessão (Metric Lab, Granularity Trainer, Query Architecture, SQL Build) com feedback granular.
7. Streak + dashboard de skills.
8. Deploy (Vercel) com proteção simples por senha.