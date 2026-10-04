# chess

Jogo de xadrez no navegador, em Next.js, com motor de regras e IA escritos do zero. Dá para jogar com 2 pessoas no mesmo navegador ou contra a máquina (3 níveis).

> Em desenvolvimento. Planejamento em [`docs/SPEC.md`](docs/SPEC.md) e tarefas em [`docs/tickets/`](docs/tickets/README.md).

## Como rodar

Requer Node 20+.

```bash
npm install
npm run dev
```

Abra <http://localhost:3000>.

## Testes

```bash
npm test             # suíte rápida (Vitest)
npm run test:slow    # perft profundo e partidas da IA
npx playwright install chromium   # uma vez
npm run test:e2e     # ponta a ponta (Playwright)
```

## Créditos

Peças: conjunto **cburnett**, de [Colin M.L. Burnett](https://en.wikipedia.org/wiki/User:Cburnett), licenciado sob [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Arquivos obtidos do repositório do [Lichess](https://github.com/lichess-org/lila).
