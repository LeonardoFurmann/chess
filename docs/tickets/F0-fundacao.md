# F0 — Fundação: tooling, contratos e fixtures

| | |
|---|---|
| **Executor** | humano + Claude (sem pipeline de agentes) |
| **Depende de** | — |
| **Desbloqueia** | todos os tickets |
| **Spec** | §2, §3, §4.1, §4.6, §5.4, §7.4, §8 |

## Objetivo

Deixar o repositório pronto para agentes trabalharem em paralelo sem conflito: ferramentas configuradas e **um stub para cada função** que os tickets vão implementar, com as assinaturas definitivas.

## Subtarefas

### F0.1 — GitHub CLI
- [x] Instalar o `gh` e autenticar (`gh auth status` ok).
- [x] Repositório público; sem CI/CD no MVP.

### F0.2 — Scaffold e tooling
- [ ] Next.js (App Router, TypeScript strict, Tailwind, ESLint) na raiz de `chess/`, preservando `README.md` e `.gitignore`.
- [ ] `.nvmrc` com `20` e `"engines": { "node": ">=20" }`.
- [ ] Alias `@/` → `src/`.
- [ ] Vitest (ambiente `node` para `src/engine` e `src/ai`; `jsdom` + Testing Library para componentes e hooks).
- [ ] Separação `*.test.ts` (suíte `test`) e `*.slow.test.ts` (suíte `test:slow`).
- [ ] Playwright (Chromium) com `webServer` apontando para o `dev`.
- [ ] Scripts da SPEC §2.
- [ ] ESLint: `@typescript-eslint/no-explicit-any: error` + regras de fronteira da SPEC §3.2 (`no-restricted-imports` por pasta ou `eslint-plugin-boundaries`), com um teste manual provando que uma importação proibida falha.
- [ ] `chess.js` como `devDependency`.

### F0.3 — GitHub
- [x] Labels (fase, área, tamanho, caminho crítico, `review:approved`, `review:changes-requested`) e milestone `MVP`.
- [x] Uma issue por ticket.

### F0.4 — Documentação para agentes
- [ ] `CLAUDE.md` do projeto: resumo de SPEC §2 (convenções), §3 (arquitetura e fronteiras) e §7 (processo), regras comuns dos tickets (README de `docs/tickets`).
- [ ] README: como rodar, atribuição das peças cburnett.

### F0.5 — Contratos (stubs)

Cada arquivo abaixo é criado com tipos completos e funções que lançam `new Error("not implemented")`, exceto os marcados como **completo na F0**.

**Motor — camada interna (`src/engine/core/`)**

| Arquivo | Declara | Implementado em |
|---|---|---|
| `types.ts` | constantes de cor e peça (§4.1), `Square` (índice 0–63), `Move` (number), bits de roque, `UndoInfo` | **completo na F0** |
| `move.ts` | layout de bits do lance: `encodeMove`, `moveFrom`, `moveTo`, `movePromotion`, `moveFlags`, constantes de flags | **completo na F0**, com testes |
| `rng.ts` | `createRng(seed)` — PRNG determinístico (ex.: mulberry32) | **completo na F0** |
| `board.ts` | `squareName`, `parseSquare`, `fileOf`, `rankOf`, tabelas pré-calculadas de destinos de cavalo e rei, direções de deslizamento | T1.1 |
| `position.ts` | tipo `Position` (campos da §4.1), `createEmptyPosition`, `clonePosition` | T1.1 |
| `fen.ts` | `START_FEN`, `parseFen` (lança em FEN inválido), `toFen` | T1.1 |
| `attacks.ts` | `isSquareAttacked(pos, square, byColor)` | T1.2 |
| `movegen.ts` | `generatePseudoLegalMoves(pos): Move[]` | T1.3 |
| `zobrist.ts` | chaves (dois `uint32` por entrada), `computeHash(pos)`, acessores das chaves para atualização incremental | T1.4 |
| `draw.ts` | `isInsufficientMaterial(pos)`, `isFiftyMoveDraw(pos)` | T1.5 |
| `make-move.ts` | `makeMove(pos, move)`, `unmakeMove(pos)` | T1.6 |
| `legal.ts` | `generateLegalMoves`, `inCheck`, `isCheckmate`, `isStalemate` | T1.6 |
| `repetition.ts` | `repetitionCount(pos)` | T1.6 |
| `perft.ts` | `perft(pos, depth)`, `perftDivide(pos, depth)` | T1.6 |
| `notation.ts` | `moveToUci`, `uciToMove` (retorna `null` se ilegal), `moveToSan` | T1.7 |
| `index.ts` | reexporta a camada interna | **completo na F0** |

**Motor — camada pública (`src/engine/`)**

| Arquivo | Declara | Implementado em |
|---|---|---|
| `types.ts` | `SquareName` (`"a1"`…`"h8"`), `Color` (`"w"`/`"b"`), `PieceType`, `Piece`, `BoardState` (64 × `Piece \| null`, índice a1 = 0), `MoveInput`, `GameMove` (from, to, promotion, san, uci, captura), `GameStatus` (§4.3), `Game` (readonly) | **completo na F0** |
| `game.ts` | `createGame`, `play`, `undo`, `getLegalMoves`, `getLegalMovesFrom`, `getStatus`, `getBoard`, `getTurn`, `getFen`, `getHistory`, `getLastMove`, `getInitialFen`, `getUciMoves` | T1.8 |
| `index.ts` | reexporta **apenas** a camada pública | **completo na F0** |

**IA (`src/ai/`)**

| Arquivo | Declara | Implementado em |
|---|---|---|
| `protocol.ts` | mensagens `search`, `stop`, `bestmove`, `error` (§5.4), tipo `Level` (`1 \| 2 \| 3`) | **completo na F0** |
| `evaluate.ts` | `PIECE_VALUES`, `evaluate(pos): number` (centipeões, ponto de vista do lado a jogar) | T2.1 |
| `search.ts` | `SearchOptions` (`maxDepth?`, `timeLimitMs?`, `randomMarginCp?`, `rng?`, `shouldStop?`), `SearchResult` (`move`, `score`, `depth`, `nodes`, `timeMs`), `search(pos, options)`, `MATE_SCORE` | T2.2 |
| `levels.ts` | `LEVELS: Record<Level, SearchOptions>` | T2.3 |
| `worker.ts` | entrada do Worker | T2.3 |

**UI**

| Arquivo | Declara | Implementado em |
|---|---|---|
| `src/hooks/useEngine.ts` | assinatura do hook (§T2.3) | T2.3 |
| `src/hooks/useGame.ts` | assinatura do hook (§T2.7) | T2.7 |
| `src/lib/storage.ts` | `SavedGame` (v1, §6.5), `loadGame`, `saveGame`, `clearGame` | T2.6 |

### F0.6 — Fixtures (`test/fixtures/`)
- [ ] `perft.ts`: posições e contagens da SPEC §4.6, **conferidas contra a Chess Programming Wiki**, separando o que cabe na suíte rápida (≤ ~500 mil nós).
- [ ] `mates.ts`: ≥ 10 mates em 1 e ≥ 10 mates em 2 (FEN + lances que dão mate), validados com `chess.js`.
- [ ] `random-positions.ts`: gerador determinístico (`createRng` + `chess.js`) de N posições por partidas aleatórias, a partir da posição inicial e das FENs de perft, retornando FEN + histórico UCI.

### F0.7 — Assets
- [ ] SVGs cburnett em `public/pieces/` (`wK.svg`, `wQ.svg`, …, `bP.svg`).

## Critérios de aceite

- [ ] `npm run lint && npm run typecheck && npm test && npm run build` passam (stubs não são chamados por testes).
- [ ] Importar `@/engine/core` dentro de `src/components` gera erro de lint.
- [ ] Todos os arquivos da tabela da F0.5 existem com as assinaturas definitivas.
