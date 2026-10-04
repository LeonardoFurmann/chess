@AGENTS.md

# Chess

Jogo de xadrez em Next.js com motor de regras e IA escritos do zero. O projeto também serve para testar o Claude como orquestrador de agentes.

**Fonte da verdade:** [`docs/SPEC.md`](docs/SPEC.md). Tarefas: [`docs/tickets/`](docs/tickets/README.md) (uma issue do GitHub por ticket, milestone `MVP`).

## Regras para este projeto

- **Não usar a skill `aprendizado`** nem fazer perguntas de revisão aqui, mesmo que o `CLAUDE.md` de `D:\MeusProjetos` peça. Este projeto não é de estudo dirigido.
- Antes de trabalhar num ticket, leia o arquivo dele em `docs/tickets/` e as seções da SPEC que ele cita.
- Altere **somente** os arquivos do escopo do ticket. Os stubs criados na F0 são **contratos**: implemente o corpo, mas não mude nomes, parâmetros, tipos de retorno nem tipos exportados. Se precisar mudar um contrato, pare e escale.
- Arquivos auxiliares novos são permitidos dentro das pastas do escopo, desde que não sejam reexportados pelos `index.ts`.

## Idioma

| Onde | Idioma |
|---|---|
| Código, nomes de arquivos, comentários | inglês |
| Commits | inglês, Conventional Commits com escopo: `engine`, `ai`, `ui`, `e2e`, `docs`, `chore` (ex.: `feat(engine): add castling`) |
| PRs, comentários de revisão, issues, `docs/` | português |
| Textos da interface | português |

## Comandos

```bash
npm run dev          # servidor de desenvolvimento
npm run lint         # ESLint, inclui as fronteiras entre pastas
npm run typecheck    # next typegen + tsc
npm test             # Vitest, suíte rápida
npm run test:slow    # perft profundo e partidas da IA (*.slow.test.ts)
npm run test:e2e     # Playwright (Chromium)
npm run build
```

**Antes de todo PR:** `npm run lint && npm run typecheck && npm test && npm run build`. Não há CI: essas checagens locais são o portão de qualidade. Avisos de `no-unused-vars` nos stubs ainda não implementados são esperados; erros de lint não.

## Arquitetura (SPEC §3)

```
src/engine/core/   camada interna, mutável (Position) — TS puro
src/engine/        camada pública, imutável (Game) — TS puro
src/ai/            avaliação, busca, Worker — TS puro
src/hooks/         useEngine, useGame
src/components/    componentes de apresentação (props in, eventos out)
src/app/           rotas / e /play
src/lib/           storage
test/fixtures/     perft, mates, posições aleatórias (validados com chess.js)
e2e/               Playwright
```

- Fronteiras garantidas pelo lint (`eslint.config.mjs`): `engine/core` não importa nada de fora dele; componentes só importam **tipos** de `@/engine`; ninguém fora de `engine` e `ai` importa `@/engine/core`.
- Fora da própria pasta, use sempre o alias `@/` (imports relativos com `../` são proibidos em `src/`).
- `chess.js` é `devDependency`, usado **apenas em testes** como oráculo.
- Tabuleiro: `Int8Array(64)`, a1 = 0, h8 = 63; peças com sinal (brancas positivas). Lances empacotados em `number` (`src/engine/core/move.ts`).

## Processo (SPEC §7)

- Branch `task/<id>-<slug>`; PR com título `[<id>] <título>`, corpo em português e `Closes #<issue>`.
- Revisor: comentário com veredito **APROVADO** ou **MUDANÇAS NECESSÁRIAS** + label `review:approved` / `review:changes-requested`.
- Verificador: testes adversariais escritos a partir da SPEC e do ticket, sem ler a implementação, em commit próprio `test(<escopo>): adversarial tests for <id>`.
- Máximo de 2 rodadas de retrabalho; depois, escalar ao humano.
- Merge (squash) apenas pelo orquestrador.

## Ambiente

Windows, Node 20 (`.nvmrc`), npm. O repositório força finais de linha LF (`.gitattributes`).
