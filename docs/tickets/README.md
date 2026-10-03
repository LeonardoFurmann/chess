# Tickets do MVP

Divisão da [SPEC](../SPEC.md) em tarefas para o pipeline de agentes (SPEC §7). Cada ticket tem uma issue no GitHub (milestone `MVP`), com as dependências registradas como "blocked by". **Os arquivos daqui são a fonte da verdade**; a issue é o ponto de acompanhamento.

- **F0** é executada pelo humano + Claude, sem agentes. Ela cria os contratos (stubs) de todos os arquivos que os tickets seguintes implementam.
- **T1.x** — motor de regras. **T2.x** — IA e interface.
- Cada ticket lista: dependências, **escopo de arquivos** (o agente só pode alterar esses caminhos), critérios de aceite e pontos de ataque para o verificador.
- Tamanho: **P** (pequeno), **M** (médio), **G** (grande).

## Lista

| Ticket | Issue | Título | Depende de | Tamanho |
|---|---|---|---|---|
| [F0](F0-fundacao.md) | [#1](https://github.com/LeonardoFurmann/chess/issues/1) | Fundação: tooling, contratos, fixtures | — | G |
| [T1.1](T1.1-position-fen.md) | [#2](https://github.com/LeonardoFurmann/chess/issues/2) | Position, FEN e utilitários de tabuleiro | F0 | M |
| [T1.2](T1.2-attacks.md) | [#3](https://github.com/LeonardoFurmann/chess/issues/3) | Detecção de casas atacadas | T1.1 | P |
| [T1.3](T1.3-movegen.md) | [#4](https://github.com/LeonardoFurmann/chess/issues/4) | Geração de lances pseudolegais | T1.1 | G |
| [T1.4](T1.4-zobrist.md) | [#5](https://github.com/LeonardoFurmann/chess/issues/5) | Hash Zobrist | T1.1 | P |
| [T1.5](T1.5-static-draws.md) | [#6](https://github.com/LeonardoFurmann/chess/issues/6) | Material insuficiente e regra dos 50 lances | T1.1 | P |
| [T1.6](T1.6-make-legal-perft.md) | [#7](https://github.com/LeonardoFurmann/chess/issues/7) | make/unmake, legalidade, repetição e perft | T1.2, T1.3, T1.4 | G |
| [T1.7](T1.7-notation.md) | [#8](https://github.com/LeonardoFurmann/chess/issues/8) | Notação UCI e SAN | T1.6 | M |
| [T1.8](T1.8-game-api.md) | [#9](https://github.com/LeonardoFurmann/chess/issues/9) | API pública `Game` | T1.5, T1.6, T1.7 | M |
| [T1.9](T1.9-oracle-suite.md) | [#10](https://github.com/LeonardoFurmann/chess/issues/10) | Suíte de oráculo com `chess.js` | T1.8 | M |
| [T2.1](T2.1-evaluate.md) | [#11](https://github.com/LeonardoFurmann/chess/issues/11) | Avaliação estática | T1.1 | P |
| [T2.2](T2.2-search.md) | [#12](https://github.com/LeonardoFurmann/chess/issues/12) | Busca: negamax, alfa-beta, aprofundamento iterativo | T1.5, T1.6, T2.1 | G |
| [T2.3](T2.3-worker-levels.md) | [#13](https://github.com/LeonardoFurmann/chess/issues/13) | Web Worker, níveis e hook `useEngine` | T1.7, T2.2 | M |
| [T2.4](T2.4-board-component.md) | [#14](https://github.com/LeonardoFurmann/chess/issues/14) | Componente `Board` | F0 | G |
| [T2.5](T2.5-panel-components.md) | [#15](https://github.com/LeonardoFurmann/chess/issues/15) | Painel lateral e janela de promoção | F0 | M |
| [T2.6](T2.6-home-storage.md) | [#16](https://github.com/LeonardoFurmann/chess/issues/16) | Tela inicial e persistência | F0 | M |
| [T2.7](T2.7-play-page.md) | [#17](https://github.com/LeonardoFurmann/chess/issues/17) | Página `/play` (integração) | T1.8, T2.3, T2.4, T2.5, T2.6 | G |
| [T2.8](T2.8-e2e.md) | [#18](https://github.com/LeonardoFurmann/chess/issues/18) | Testes ponta a ponta (Playwright) | T2.7 | M |

## Grafo de dependências

```
F0 ─┬─► T1.1 ─┬─► T1.2 ─┐
    │         ├─► T1.3 ─┼─► T1.6 ─┬─► T1.7 ─┬─► T1.8 ─► T1.9
    │         ├─► T1.4 ─┘         │         │     ▲
    │         ├─► T1.5 ───────────┼─────────┼─────┘
    │         └─► T2.1 ───────────┴─► T2.2 ─┴─► T2.3 ─┐
    │              (T1.5 também ─► T2.2)               │
    ├─► T2.4 ─────────────────────────────────────────┤
    ├─► T2.5 ─────────────────────────────────────────┼─► T2.7 ─► T2.8
    └─► T2.6 ─────────────────────────────────────────┘    ▲
                                              T1.8 ────────┘
```

## Ondas de paralelismo (sugestão, limite de 4 implementadores)

| Onda | Tickets prontos para começar | Observação |
|---|---|---|
| 1 | T1.1, T2.4, T2.5, T2.6 | Motor e UI começam juntos — UI depende só dos tipos da F0 |
| 2 | T1.2, T1.3, T1.4, T1.5, T2.1 | 5 prontos, 4 vagas — priorizar **T1.3** (caminho crítico) |
| 3 | T1.6 | Gargalo: único ticket do caminho crítico |
| 4 | T1.7, T2.2 | |
| 5 | T1.8, T2.3 | |
| 6 | T1.9, T2.7 | |
| 7 | T2.8 | |

**Caminho crítico:** F0 → T1.1 → T1.3 → T1.6 → T1.7 → T1.8 → T2.7 → T2.8. Atrasos nesses tickets atrasam o MVP; os demais têm folga.

## Regras comuns a todos os tickets

- Ler a SPEC (seções indicadas no ticket) e o `CLAUDE.md` antes de começar.
- Implementar **apenas** as funções declaradas pelos stubs da F0 nos arquivos do escopo. Assinaturas são contrato: não alterar. Se for impossível cumprir o ticket sem mudar um contrato, parar e escalar (SPEC §7.3).
- Arquivos auxiliares novos são permitidos **dentro das pastas do escopo**, desde que não sejam exportados pelos `index.ts`.
- Antes de abrir o PR: `npm run lint && npm run typecheck && npm test && npm run build`.
- Branch `task/<id>-<slug>`, commits em Conventional Commits, PR `[<id>] <título>` com `Closes #<issue>` (SPEC §7.3).
