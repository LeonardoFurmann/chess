# Chess — Especificação do MVP

> Documento de referência do projeto. Toda tarefa (humana ou de agente) deve ser rastreável a uma seção daqui.
> Decisões tomadas na sessão de planejamento de 2026-10-03.

---

## 1. Visão e objetivos

Jogo de xadrez no navegador, em Next.js, com motor de regras e IA **escritos do zero**.

O projeto tem dois objetivos, nesta ordem:

1. **Testar o Claude como orquestrador de agentes** — o trabalho é dividido em tarefas executadas por agentes em paralelo, com pipeline de implementação → revisão → verificação, e o resultado é avaliado pelo histórico de PRs.
2. **Entregar um jogo correto e jogável** — regras completas de xadrez, 2 jogadores locais e partida contra a máquina.

Por isso a spec privilegia **contratos explícitos** e **critérios de aceite verificáveis por máquina** (testes), que permitem a agentes trabalharem isolados e a outros agentes validarem o resultado.

### Dentro do escopo (MVP)

- 2 jogadores no mesmo navegador.
- Partida contra a máquina (IA própria, 3 níveis, escolha de cor).
- Todas as regras oficiais, incluindo empates (seção 4.4).
- FEN (importar/exportar) e SAN (lista de lances).
- Partida salva no `localStorage`.

### Fora do escopo (MVP)

- Multiplayer online, relógio, contas/login, banco de dados, backend.
- Deploy (roda apenas com `npm run dev`).
- Exportar/importar PGN.
- Livro de aberturas, tablebases, ELO.
- Animações, sons, temas, navegação pelo histórico, setas/marcações.

Ver [Backlog](#9-backlog-fase-3).

---

## 2. Stack e convenções

### Stack

| Item | Escolha |
|---|---|
| Framework | Next.js (versão estável mais recente), App Router |
| Linguagem | TypeScript com `strict: true` |
| Estilo | Tailwind CSS |
| Testes unitários | Vitest |
| Testes ponta a ponta | Playwright (Chromium) |
| Runtime | Node 20 (fixado em `.nvmrc` e `engines` do `package.json`) |
| Gerenciador de pacotes | npm |
| Dependências de produção | apenas Next.js, React e Tailwind — **nenhuma biblioteca de xadrez ou de tabuleiro** |
| Oráculo de testes | `chess.js` como **`devDependency`**, usado exclusivamente em testes |
| Peças | SVG do conjunto **cburnett** (CC BY-SA 3.0), com atribuição no README |

### Idioma

| Onde | Idioma |
|---|---|
| Código (identificadores, arquivos, tipos) | inglês |
| Comentários no código | inglês |
| Mensagens de commit | inglês, [Conventional Commits](https://www.conventionalcommits.org/) — ex.: `feat(engine): add castling` |
| Títulos/descrições de PR e comentários de revisão | português |
| Documentação em `docs/` | português |
| Textos da interface | português |

### Regras técnicas

- Proibido `any` (regra de lint). `unknown` + narrowing quando necessário.
- `src/engine` e `src/ai` são **TypeScript puro**: não importam React, Next nem APIs de DOM (exceção: o arquivo de entrada do Worker, ver 5.4).
- Fronteiras entre pastas garantidas por lint (seção 3.2).
- Todo PR precisa passar em `npm run lint && npm run typecheck && npm test && npm run build` — rodado **localmente** pelo implementador e pelo verificador (não há CI no MVP).

### Scripts do `package.json`

| Script | Faz |
|---|---|
| `dev` | servidor de desenvolvimento |
| `build` | build de produção |
| `lint` | ESLint (inclui regras de fronteira) |
| `typecheck` | `next typegen` + `tsc --noEmit` |
| `test` | Vitest — suíte rápida (obrigatória antes de todo PR) |
| `test:slow` | Vitest — perft profundo e partidas da IA (roda sob demanda) |
| `test:e2e` | Playwright |

---

## 3. Arquitetura

### 3.1 Estrutura de pastas

```
chess/
├── docs/
│   ├── SPEC.md                 # este documento
│   └── reports/                # relatórios de orquestração por fase
├── e2e/                        # testes Playwright
├── public/pieces/              # SVGs cburnett (wK.svg, bQ.svg, ...)
├── src/
│   ├── engine/                 # motor de regras (TS puro)
│   │   ├── core/               # camada interna, mutável (Position)
│   │   ├── index.ts            # camada pública, imutável (Game)
│   │   └── ...
│   ├── ai/                     # IA (TS puro + entrada do Worker)
│   ├── app/                    # rotas Next.js (/ e /play)
│   ├── components/             # componentes React de apresentação
│   ├── hooks/                  # useGame, useEngine
│   └── lib/                    # utilidades da UI (ex.: storage)
└── test/fixtures/              # FENs de perft, mates, posições-armadilha
```

Testes unitários ficam ao lado do código (`*.test.ts`); testes lentos usam o sufixo `*.slow.test.ts`.

### 3.2 Fronteiras (garantidas por lint)

| Pasta | Pode importar |
|---|---|
| `engine/core` | apenas `engine/core` |
| `engine` (público) | `engine/core` |
| `ai` | `engine`, `engine/core` |
| `hooks` | `engine` (público), protocolo de `ai` (apenas tipos + URL do Worker), `lib` |
| `components` | `engine` (público, **apenas tipos**), outros `components` |
| `app` | `components`, `hooks`, `lib`, `engine` (público) |
| `lib` | `engine` (público) |

Ninguém fora de `engine` e `ai` importa `engine/core`. Componentes são de apresentação: recebem dados por props e emitem eventos — não chamam o motor.

### 3.3 Fluxo

```
 UI (app, components)
        │  props / eventos
        ▼
 hooks/useGame ──► engine (Game, imutável) ──► engine/core (Position, mutável)
        │
 hooks/useEngine ──postMessage──► Web Worker (ai) ──► engine/core
```

### 3.4 API em duas camadas

- **Camada interna — `Position` (`engine/core`)**: mutável, otimizada. `makeMove`/`unmakeMove` sobre o mesmo objeto. Usada pela IA, pelo perft e pela própria camada pública.
- **Camada pública — `Game` (`engine`)**: imutável. Cada operação retorna um novo `Game` (objetos congelados). Usada pela UI. Nunca expõe `Position`.

---

## 4. Motor de regras

### 4.1 Representação

- **Tabuleiro:** `Int8Array(64)`.
- **Índice das casas:** `index = rank * 8 + file`, com `a1 = 0`, `h1 = 7`, `a8 = 56`, `h8 = 63`.
- **Peças:** `0` = vazio; brancas positivas, pretas negativas — `1` peão, `2` cavalo, `3` bispo, `4` torre, `5` dama, `6` rei (ex.: `-5` = dama preta).
- **Lance interno:** um `number` com campos empacotados em bits — origem (6 bits), destino (6 bits), peça de promoção, e flags (captura, avanço duplo, en passant, roque curto, roque longo, promoção). O layout exato é definido no contrato da Fase 0.
- **Estado da posição:** tabuleiro, lado a jogar, direitos de roque (4 bits: `K`, `Q`, `k`, `q`), casa de en passant (ou `-1`), contador de meio-lances (regra dos 50), número do lance, casas dos dois reis, hash Zobrist e pilha de histórico para `unmakeMove` (peça capturada, direitos de roque, en passant, contador e hash anteriores).

### 4.2 Camada interna — o que o contrato de `Position` precisa expressar

- Criar a partir de FEN e serializar para FEN.
- Gerar lances legais (estratégia: gerar pseudolegais, aplicar, descartar os que deixam o próprio rei atacado, desfazer).
- `makeMove(move)` / `unmakeMove()`, restaurando **exatamente** o estado anterior (incluindo hash).
- `isSquareAttacked(square, byColor)` e `inCheck()`.
- Hash Zobrist atualizado incrementalmente.
- `perft(depth)` para testes.

### 4.3 Camada pública — o que o contrato de `Game` precisa expressar

- `createGame(fen?)` — padrão: posição inicial.
- Lances legais de toda a posição e a partir de uma casa (em formato público: casas em notação algébrica, ex.: `{ from: "e7", to: "e8", promotion: "q" }`).
- `play(game, move)` → novo `Game`. Lance ilegal **lança erro** (a UI só oferece lances legais).
- `undo(game)` → novo `Game` sem o último lance.
- Status: `playing` | `checkmate` | `stalemate` | `draw` (com motivo: `fifty-move`, `threefold`, `insufficient-material`), vencedor, e se o lado a jogar está em xeque.
- Lado a jogar, FEN atual, histórico em SAN e em UCI (`e2e4`, `e7e8q`), último lance.
- Representação interna do `Game`: FEN inicial + lista de lances (o que torna `undo` e persistência triviais).

### 4.4 Regras

Obrigatórias: movimento de todas as peças, capturas, xeque, xeque-mate, **roque** (rei e torre não moveram, casas entre eles vazias, rei não está em xeque nem passa/chega em casa atacada), **en passant**, **promoção** (dama, torre, bispo, cavalo).

Fim de jogo:

| Situação | Comportamento |
|---|---|
| Xeque-mate | vitória de quem deu o mate |
| Afogamento | empate |
| Regra dos 50 lances (contador de meio-lances ≥ 100) | empate **automático** |
| Tripla repetição | empate **automático** |
| Material insuficiente | empate automático — casos: R×R; R+C×R; R+B×R; R+B(s)×R+B(s) com todos os bispos em casas da mesma cor |

- Xeque-mate tem precedência: se o lance que completa 100 meio-lances der mate, é mate.
- **Repetição:** posições iguais = mesma disposição de peças, mesmo lado a jogar, mesmos direitos de roque e mesma possibilidade de en passant. A casa de en passant entra no hash **apenas se houver captura en passant pseudolegal disponível**. Comparação feita pelo hash Zobrist.
- **Zobrist:** chaves de 64 bits representadas como **dois `uint32`** (sem `BigInt`), geradas por PRNG com semente fixa (determinístico).

### 4.5 Notações

- **FEN:** parse com validação (6 campos, 8 fileiras de 8 casas, um rei de cada cor, valores válidos); FEN inválido lança erro com mensagem clara. Serialização segue o padrão (casa de en passant escrita sempre após avanço duplo).
- **SAN:** letra da peça, desambiguação mínima (coluna, depois fileira, depois ambas), `x` para captura (peão inclui a coluna de origem), `=Q` para promoção, `O-O` / `O-O-O`, `+` para xeque, `#` para mate.

### 4.6 Critérios de aceite

**Perft** — contagens de nós da [Chess Programming Wiki](https://www.chessprogramming.org/Perft_Results). A suíte rápida (`test`) roda até ~500 mil nós por posição; profundidades maiores ficam em `test:slow`.

| Posição | FEN | Profundidade → nós |
|---|---|---|
| Inicial | `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1` | 1→20 · 2→400 · 3→8.902 · 4→197.281 · 5→4.865.609 |
| Kiwipete | `r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1` | 1→48 · 2→2.039 · 3→97.862 · 4→4.085.603 |
| Posição 3 | `8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1` | 1→14 · 2→191 · 3→2.812 · 4→43.238 · 5→674.624 |
| Posição 4 | `r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1` | 1→6 · 2→264 · 3→9.467 · 4→422.333 |
| Posição 5 | `rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8` | 1→44 · 2→1.486 · 3→62.379 · 4→2.103.487 |
| Posição 6 | `r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10` | 1→46 · 2→2.079 · 3→89.890 · 4→3.894.594 |

> Os valores devem ser conferidos contra a fonte ao criar as fixtures na Fase 0.

**Oráculo (`chess.js`)** — em pelo menos **2.000 posições** (geradas por partidas aleatórias com semente fixa, a partir da posição inicial e das FENs de perft):

- o conjunto de lances legais (em UCI) é idêntico ao do `chess.js`;
- o SAN de cada lance legal é idêntico;
- xeque, mate, afogamento e material insuficiente coincidem;
- tripla repetição e regra dos 50 coincidem ao longo das partidas.

**Outros:**

- `makeMove` seguido de `unmakeMove` restaura tabuleiro, estado e hash idênticos (testado em todas as posições do oráculo).
- Hash incremental == hash recalculado do zero, em todas as posições do oráculo.
- FEN: ida e volta (`parse` → `serialize`) preserva a string para as FENs de fixtures; FENs inválidas rejeitadas.
- `Game` é imutável: operações não alteram o objeto original (teste com `Object.isFrozen` e comparação profunda).
- Desempenho: perft(5) da posição inicial em menos de **15 s** numa máquina de desenvolvimento comum (`test:slow`).

---

## 5. IA (MVP)

### 5.1 Algoritmo

- **Negamax** com **poda alfa-beta**.
- **Aprofundamento iterativo** com limite de tempo; ao estourar o tempo, usa o melhor lance da última profundidade **completa**. A profundidade 1 sempre é completada (sempre há um lance a retornar).
- **Avaliação:** material + tabelas de peça por casa (valores da *Simplified Evaluation Function*: P=100, C=320, B=330, T=500, D=900; tabela de rei de meio-jogo), do ponto de vista do lado a jogar.
- **Mate:** score `MATE - ply` (prefere o mate mais rápido e adia o mais lento). Empates (afogamento, repetição, 50 lances, material insuficiente) valem 0.
- Para detectar repetição, a busca recebe o histórico da partida (ver 5.4).

### 5.2 Níveis

| Nível | Configuração |
|---|---|
| Fácil | profundidade fixa 2; escolhe aleatoriamente entre os lances com score até **150 centipeões** abaixo do melhor |
| Médio | aprofundamento iterativo, **500 ms** por lance |
| Difícil | aprofundamento iterativo, **2.000 ms** por lance |

O jogador escolhe brancas, pretas ou aleatório.

### 5.3 Fora do MVP

Ordenação de lances (MVV-LVA, killer moves), busca de quiescência, tabela de transposição, mini-torneio entre versões. Ver [Backlog](#9-backlog-fase-3).

### 5.4 Execução e protocolo do Worker

A busca roda num **Web Worker** (a UI nunca trava). Mensagens no estilo UCI:

- **UI → Worker** `search`: `requestId`, FEN inicial da partida, lista de lances em UCI desde ela, nível e semente opcional (aleatoriedade do nível fácil).
- **Worker → UI** `bestmove`: `requestId`, lance em UCI, profundidade atingida, score, nós visitados, tempo gasto.
- **Worker → UI** `error`: `requestId`, mensagem.

A UI descarta respostas cujo `requestId` não seja o da busca atual (ex.: após desfazer ou nova partida).

**Cancelamento:** a busca é síncrona dentro do Worker, então ele não processa mensagens enquanto busca — uma mensagem `stop` nunca seria lida a tempo. Para cancelar, a UI ignora a resposta pelo `requestId` e, quando precisa liberar a CPU imediatamente, encerra o Worker (`terminate()`) e cria outro.

### 5.5 Critérios de aceite

Os testes chamam a busca diretamente (sem Worker) e usam profundidade/tempo reduzidos para manter a suíte rápida; as partidas completas ficam em `test:slow`.

- **Legalidade:** em **100 partidas** contra um jogador aleatório (semente fixa), em todos os níveis, a IA nunca joga lance ilegal.
- **Força:** em **20 partidas** contra o jogador aleatório com profundidade fixa 3: **0 derrotas** e **≥ 90% de vitórias**. (Empates são tolerados porque, sem conhecimento de finais, a IA pode não converter vantagens dentro da regra dos 50 lances — isso melhora na Fase 3.)
- **Mates:** pelo menos 10 posições de **mate em 1** resolvidas com profundidade ≥ 2, e 10 de **mate em 2** resolvidas com profundidade ≥ 4 (FENs em `test/fixtures`).
- **Tempo:** nos níveis médio e difícil, a busca retorna em até **limite + 10%**.
- **Determinismo:** com a mesma semente, o nível fácil produz a mesma sequência de lances.

---

## 6. Interface

### 6.1 Rotas

- **`/`** — tela inicial:
  - "Jogar local".
  - "Jogar contra a máquina", escolhendo cor (brancas / pretas / aleatório) e nível (fácil / médio / difícil).
  - "Continuar partida", se houver partida salva.
- **`/play`** — partida. Parâmetros: `mode=local|ai`, `color=white|black` e `level=1|2|3` (modo `ai`), `fen=` (opcional, posição inicial; usado também pelos testes ponta a ponta).
  - Com parâmetros: inicia nova partida (substitui a salva).
  - Sem parâmetros: retoma a partida salva; se não houver, redireciona para `/`.

### 6.2 Tabuleiro

- Mover por **clique-clique** (seleciona peça, clica no destino) e por **arrastar-e-soltar** (mouse e toque).
- Destaques: casa selecionada, destinos legais (com marcação diferente para captura), último lance, rei em xeque.
- Lance inválido: a peça volta à origem, nada muda.
- **Promoção:** janela com dama, torre, bispo e cavalo; cancelar desfaz a seleção.
- Coordenadas a–h e 1–8 na borda.
- **Virar tabuleiro.** Contra a IA, começa do lado do jogador.
- Bloqueado após o fim da partida e enquanto a IA pensa.
- Acessibilidade mínima: cada casa tem `aria-label` (ex.: "e4, cavalo branco").

### 6.3 Painel lateral

- Lista de lances em SAN, numerada (`1. e4 e5`).
- De quem é a vez e resultado com motivo (ex.: "Xeque-mate — brancas vencem", "Empate por tripla repetição").
- Indicador "IA pensando…".
- **Nova partida** (volta para `/`) e **Desfazer**: no modo local, desfaz 1 lance; contra a IA, desfaz até o último lance do jogador (normalmente 2) e cancela uma busca em andamento.

### 6.4 Layout

Responsivo: em telas largas, tabuleiro + painel lado a lado; em telas estreitas, painel abaixo. Jogável a partir de 375 px de largura, sem rolagem horizontal.

### 6.5 Persistência

- Chave `chess:current-game` no `localStorage`.
- Conteúdo: `{ v: 1, mode, color, level, initialFen, moves: string[] /* UCI */ }`.
- Salva a cada lance; dado ausente, corrompido ou de outra versão é descartado sem erro.

### 6.6 Critérios de aceite (Playwright)

1. Partida local até o mate do pastor (`e4 e5 Qh5 Nc6 Bc4 Nf6 Qxf7#`): exibe o mate com vitória das brancas e o tabuleiro para de aceitar lances.
2. Lance por clique-clique e por arrastar-e-soltar.
3. Tentativa de lance ilegal não altera a posição.
4. Promoção a partir de `?fen=`: escolher cavalo resulta em cavalo na casa de destino e `=N` na lista.
5. Desfazer: modo local volta 1 lance; contra a IA volta até o lance do jogador.
6. Recarregar a página mantém a partida.
7. Jogando de pretas contra a IA: a IA joga primeiro sozinha e o indicador "pensando" aparece.
8. Virar tabuleiro inverte as coordenadas.
9. Viewport de 375 px: tabuleiro inteiro visível, sem rolagem horizontal.

Componentes têm testes unitários (Vitest + Testing Library) para renderização e eventos.

---

## 7. Processo de orquestração

### 7.1 Papéis

| Papel | Responsabilidade | Modelo |
|---|---|---|
| **Orquestrador** | Lê a spec e as tarefas, decide o paralelismo respeitando dependências, dispara agentes, faz merge, trata falhas e escreve o relatório da fase | Opus 5.5 (sessão principal) |
| **Implementador** | Trabalha num **git worktree próprio**, implementa a tarefa com testes, abre o PR | Sonnet 5.5 |
| **Revisor** | Revisa o diff contra a spec, o contrato e os critérios de aceite; comenta e dá o veredito | Opus 5.5 |
| **Verificador** | Escreve **testes adversariais a partir apenas da spec** (sem ler a implementação), roda todas as suítes | Sonnet 5.5 |

### 7.2 Pipeline por tarefa

1. Implementador cria a branch `task/<id>-<slug>` num worktree, implementa, roda `lint`, `typecheck`, `test` e `build`, e abre o PR.
2. Revisor e verificador atuam sobre o PR (podem rodar em paralelo). O verificador adiciona seus testes como commit próprio (`test(<escopo>): adversarial tests for <id>`).
3. Veredito do revisor: **APROVADO** ou **MUDANÇAS NECESSÁRIAS** (comentário no PR, em português, citando a seção da spec).
4. Se houver reprovação (revisor ou testes do verificador), o implementador corrige. **Máximo de 2 rodadas de retrabalho**; depois disso, a tarefa é escalada para o humano.
5. Merge (squash) pelo orquestrador quando: **checagens locais verdes (lint, typecheck, test, build) + veredito APROVADO + testes do verificador passando**. O orquestrador roda as checagens de novo na branch atualizada antes do merge.

### 7.3 Regras

- **Paralelismo:** até **4 implementadores** simultâneos, respeitando o grafo de dependências.
- **Escopo de arquivos:** cada tarefa lista as pastas/arquivos que pode alterar; alterações fora disso são motivo de reprovação.
- **Contratos são do humano:** nenhum agente altera os contratos da Fase 0. Se uma tarefa exigir mudança de contrato, o agente para e escala.
- **Conflitos de merge:** o orquestrador faz rebase da branch; se o conflito for semântico, devolve ao implementador (conta como rodada de retrabalho).
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/), em inglês, com escopo da área — `engine`, `ai`, `ui`, `e2e`, `docs`, `chore` (ex.: `feat(engine): generate pawn promotions`, `test(ai): add mate-in-2 fixtures`).
- **Issues:** cada ticket é uma issue no GitHub; o PR fecha a issue (`Closes #<n>` no corpo).
- **Formato do PR:** título `[<id>] <descrição>`; corpo com o que foi feito, como testar, checklist dos critérios de aceite atendidos e `Closes #<n>`.

### 7.4 Aprovação no GitHub

Todos os agentes usam a conta do humano via `gh`, e o GitHub **não permite aprovar o próprio PR**. Por isso:

- O veredito do revisor é registrado como **comentário** + label `review:approved` (ou `review:changes-requested`).
- Não há CI nem proteção de branch no MVP: a regra de merge (7.2) é aplicada pelo orquestrador, que é o único a fazer merge na `main`.
- Os PRs da Fase 0 (contratos) são revisados e mergeados pelo humano.

### 7.5 Relatório por fase

Ao fim de cada fase, o orquestrador escreve `docs/reports/fase-<n>.md` com: tarefas executadas e linha do tempo do paralelismo, rodadas de retrabalho por tarefa, problemas pegos pelo revisor e pelo verificador (e os que escaparam), escalonamentos, tempo e tokens gastos, e lições para a próxima fase.

---

## 8. Fase 0 — Fundação (humano + Claude, sem agentes)

- [ ] Instalar e autenticar o GitHub CLI (`gh auth status` ok).
- [ ] Scaffold do Next.js (App Router, TypeScript strict, Tailwind) na raiz de `chess/`.
- [ ] `.nvmrc` (Node 20) e `engines` no `package.json`.
- [ ] Vitest (+ Testing Library), Playwright (Chromium), scripts da seção 2.
- [ ] ESLint com proibição de `any` e regras de fronteira da seção 3.2.
- [ ] Labels `review:approved` e `review:changes-requested`.
- [ ] `CLAUDE.md` do projeto com convenções, fronteiras e processo (resumo das seções 2, 3 e 7).
- [ ] **Contratos:** tipos e codificação (peças, casas, lances internos e públicos), assinaturas de `Position` e de `Game` (stubs que lançam `not implemented`), protocolo de mensagens do Worker, assinaturas de avaliação e busca.
- [ ] **Fixtures:** FENs e contagens de perft (seção 4.6), ≥ 10 mates em 1, ≥ 10 mates em 2, gerador de posições aleatórias com semente.
- [ ] SVGs cburnett em `public/pieces/` e atribuição no README.
- [x] Divisão do MVP em tarefas (com id, descrição, dependências, escopo de arquivos e critérios de aceite) — ver [`docs/tickets/`](tickets/README.md).

---

## 9. Backlog (Fase 3+)

- **IA:** ordenação de lances (MVV-LVA, killer moves), busca de quiescência, tabela de transposição (usando o Zobrist), tabela de rei de final, mini-torneio entre versões como critério de aceite.
- **Notação:** exportar e importar PGN.
- **Interface:** animações, sons, temas de tabuleiro, navegação pelo histórico, setas e marcações com o botão direito.
- **CI/CD:** GitHub Actions (lint, typecheck, testes, build, e2e) e proteção da `main`.
- **Deploy:** Vercel (com preview por PR) ou a VPS.
- **Jogo:** relógio, multiplayer online.

---

## 10. Pendências

Nenhuma. (`gh` autenticado; repositório público; CI/CD fora do MVP.)
