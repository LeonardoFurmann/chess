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
- [x] Next.js 16 (App Router, TypeScript strict, Tailwind 4, ESLint 9) na raiz de `chess/`.
- [x] `.nvmrc` com `20`, `engines.node >= 20.19`, `.gitattributes` forçando LF.
- [x] Alias `@/` → `src/`.
- [x] Vitest 4 com dois projetos: `node` (`src/engine`, `src/ai`, `test/`) e `dom` (jsdom + Testing Library para `components`, `hooks`, `lib`, `app`).
- [x] `*.test.ts` na suíte `test`; `*.slow.test.ts` em `test:slow` (`vitest.slow.config.ts`).
- [x] Playwright (Chromium) com `webServer` no `dev`; testes em `e2e/`.
- [x] Scripts da SPEC §2 (`typecheck` roda `next typegen` antes do `tsc`).
- [x] ESLint: `no-explicit-any` como erro + fronteiras da SPEC §3.2 (`@typescript-eslint/no-restricted-imports` por pasta) + proibição de `../` em `src/`. Verificado com importações proibidas de propósito.
- [x] `chess.js` como `devDependency`.

### F0.3 — GitHub
- [x] Labels (fase, área, tamanho, caminho crítico, `review:approved`, `review:changes-requested`) e milestone `MVP`.
- [x] Uma issue por ticket, com dependências "blocked by".

### F0.4 — Documentação para agentes
- [x] `CLAUDE.md` do projeto (importa o `AGENTS.md` gerado pelo Next).
- [x] README com como rodar e atribuição das peças.

### F0.5 — Contratos (stubs)

Stubs lançam `new Error("not implemented")`. Os marcados como **completo na F0** já funcionam.

**Motor — camada interna (`src/engine/core/`)**

| Arquivo | Declara | Implementado em |
|---|---|---|
| `types.ts` | `WHITE`/`BLACK`, constantes de peça, `PieceCode`, `Square`, `NO_SQUARE`, `Move`, bits de roque, `HashPair`, `UndoInfo`, `pieceColor`, `pieceKind` | **completo na F0** |
| `move.ts` | layout de bits do lance: `encodeMove`, `moveFrom`, `moveTo`, `movePromotion`, `moveFlags`, `hasFlag`, flags `MOVE_*` | **completo na F0**, com testes |
| `rng.ts` | `createRng(seed)` — mulberry32 | **completo na F0**, com testes |
| `board.ts` | `fileOf`, `rankOf`, `makeSquare`, `squareName`, `parseSquare`, `knightTargets`, `kingTargets`, `ray` (+ constantes de direção, completas) | T1.1 |
| `position.ts` | interface `Position` (inclui `whiteKing`/`blackKing`), `createEmptyPosition`, `clonePosition` | T1.1 |
| `fen.ts` | `START_FEN` (completo), `parseFen`, `toFen` | T1.1 |
| `attacks.ts` | `isSquareAttacked(pos, square, byColor)` | T1.2 |
| `movegen.ts` | `generatePseudoLegalMoves(pos): Move[]` | T1.3 |
| `zobrist.ts` | `ZobristKeys`, `pieceKeyIndex` (completo), `getZobristKeys`, `hashedEpFile`, `computeHash` | T1.4 |
| `draw.ts` | `isInsufficientMaterial(pos)`, `isFiftyMoveDraw(pos)` | T1.5 |
| `make-move.ts` | `makeMove(pos, move)`, `unmakeMove(pos)` | T1.6 |
| `legal.ts` | `generateLegalMoves`, `inCheck`, `isCheckmate`, `isStalemate` | T1.6 |
| `repetition.ts` | `repetitionCount(pos)` (1 = primeira ocorrência) | T1.6 |
| `perft.ts` | `perft(pos, depth)`, `perftDivide(pos, depth)` | T1.6 |
| `notation.ts` | `moveToUci`, `uciToMove` (retorna `null` se ilegal), `moveToSan` | T1.7 |
| `index.ts` | reexporta a camada interna | **completo na F0** |

**Motor — camada pública (`src/engine/`)**

| Arquivo | Declara | Implementado em |
|---|---|---|
| `types.ts` | `SquareName`, `Color` (`"w"`/`"b"`), `PieceType`, `PromotionPiece`, `Piece`, `BoardState`, `MoveInput`, `GameMove`, `DrawReason`, `GameStatus` (união discriminada por `kind`), `Game` (`initialFen` + `uciMoves`) | **completo na F0** |
| `game.ts` | `createGame`, `play`, `undo`, `getLegalMoves`, `getLegalMovesFrom`, `getStatus`, `getBoard`, `getTurn`, `getFen`, `getHistory`, `getLastMove`, `getInitialFen`, `getUciMoves` | T1.8 |
| `index.ts` | reexporta **apenas** a camada pública | **completo na F0** |

**IA (`src/ai/`)**

| Arquivo | Declara | Implementado em |
|---|---|---|
| `protocol.ts` | `Level`, `SearchRequest` (com `seed?`), `BestMoveResponse`, `ErrorResponse` — sem mensagem `stop` (ver SPEC §5.4) | **completo na F0** |
| `evaluate.ts` | `PIECE_VALUES` (completo), `evaluate(pos): number` | T2.1 |
| `search.ts` | `MATE_SCORE` (completo), `SearchOptions`, `SearchResult`, `search(pos, options)` | T2.2 |
| `levels.ts` | `levelOptions(level, seed?)` | T2.3 |
| `handler.ts` | `handleSearch(request): EngineResponse` — lógica pura do Worker | T2.3 |
| `worker.ts` | entrada do Worker (vazia) | T2.3 |

**UI**

| Arquivo | Declara | Implementado em |
|---|---|---|
| `src/hooks/useEngine.ts` | `MoveRequest`, `UseEngine`, `useEngine()` | T2.3 |
| `src/lib/storage.ts` | `SavedGame` (v1), `STORAGE_KEY`, `loadGame`, `saveGame`, `clearGame` | T2.6 |

`useGame` não tem contrato: é criado e consumido apenas pelo T2.7.

### F0.6 — Fixtures (`test/fixtures/`)
- [x] `perft.ts`: posições e contagens da SPEC §4.6, **todas conferidas com o `chess.js`** (inclusive as profundas), com `fastDepths`/`slowDepths` (limite de 500 mil nós na suíte rápida).
- [x] `mates.ts`: 12 mates em 1 e 10 mates em 2, com todas as soluções (UCI), validados com `chess.js`.
- [x] `random-positions.ts`: `randomPositions({ count, seed, maxPlies, startFens })`, determinístico, retornando `startFen` + lances UCI + FEN.
- [x] `fixtures.test.ts` revalida as fixtures contra o `chess.js` a cada execução.

### F0.7 — Assets
- [x] SVGs cburnett em `public/pieces/` (`wK.svg` … `bP.svg`).

## Critérios de aceite

- [x] `npm run lint` (0 erros; avisos de parâmetros não usados nos stubs), `npm run typecheck`, `npm test`, `npm run build` passam.
- [x] Importar `@/engine/core` dentro de `src/components` gera erro de lint.
- [x] Todos os arquivos das tabelas da F0.5 existem com as assinaturas definitivas.
