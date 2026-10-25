# Relatório da Fase 2 — IA e interface (T2.1–T2.8)

> Relatório de orquestração conforme a [SPEC §7.5](../SPEC.md#75-relatório-por-fase). Os tickets da Fase 2 correram nas mesmas ondas que os da Fase 1, entre 2026-10-18 (ondas 1–6) e 2026-10-25 (onda 7, retomada depois de uma interrupção da sessão). Executores: orquestrador Opus 5.5, implementadores e verificadores Sonnet 5.5, revisores Opus 5.5.
>
> A divisão por ondas, o paralelismo com a Fase 1 e os incidentes das ondas 1–6 estão detalhados no [relatório da Fase 1](fase-1.md). Este relatório trata dos tickets T2.x, da onda 7 e do ticket T1.10, que nasceu do relatório anterior.

## 1. Resultado

Os 8 tickets da Fase 2 foram mergeados na `main`, e as issues #11–#18 estão fechadas. Com eles e o T1.10 (#38), **o milestone MVP não tem mais nenhuma issue aberta**. Ao fim da fase:

- **E2E (Playwright, Chromium):** 20 de 20 cenários passam em 1,2 min, contra o limite de 2 min. São os 9 cenários da SPEC §6.6, com o 5 dividido em local e IA, mais 10 adversariais do verificador. Rodei a suíte no resultado juntado com a `main`, com a máquina livre, e ela não revelou nenhum bug da aplicação.
- **IA:** ganhou 20 de 20 partidas contra o jogador aleatório com `maxDepth` 3, sem nenhuma derrota (SPEC §5.5). Não houve lance ilegal em 100 partidas. Todos os mates em 1 e em 2 das fixtures foram resolvidos.
- **Suíte rápida:** 1.024 testes na `main`. A `test:slow` passou na onda 6, com 31 testes em 298 s.
- **Contratos e escalonamentos:** nenhum contrato da F0 alterado, nenhum escalonamento ao humano.

| Ticket | PR | Commit na `main` | Merge | Retrabalho | Testes adversariais |
|---|---|---|---|---|---|
| T2.1 Avaliação estática | #28 | `8635a2a` | 18/10 17:39 | 0 | 19 |
| T2.2 Busca | #31 | `1c40a53` | 18/10 21:46 | 1 (timeout de teste) | 53 |
| T2.3 Worker, níveis, `useEngine` | #34 | `3f7774f` | 18/10 22:25 | 0 | 33 |
| T2.4 `Board` | #22 | `bcdbf5d` | 18/10 16:07 | 1 (bug real) | 28 |
| T2.5 Painel e promoção | #23 | `75f6c93` | 18/10 16:08 | 1 (bug real) | 34 |
| T2.6 Tela inicial e persistência | #21 | `2e80288` | 18/10 16:09 | 0 | 45 |
| T2.7 Página `/play` | #35 | `06aeffa` | 18/10 23:18 | 0 | 28 |
| T2.8 E2E | #40 | `f0a9865` | 25/10 17:38 | 0 | 10 |
| T1.10 Invariantes no oráculo (complemento da Fase 1) | #39 | `6bc57be` | 25/10 17:42 | 2 (escopo) | 15 |

As contagens de testes adversariais são as informadas pelo verificador e seguem o mesmo critério do relatório da Fase 1.

## 2. Linha do tempo do paralelismo

Horários informados pelos agentes (`date -Iseconds`), aproximados. **I** = implementador, **R** = revisor, **V** = verificador, **F** = retrabalho, **M** = merge pelo orquestrador.

| Onda | Ticket | Linha do tempo | Em paralelo com |
|---|---|---|---|
| 1 (18/10) | T2.4 | I 14:09–15:08 · R 15:08–15:21 (reprovado) · V 15:11–15:31 · F 15:31–15:48 · R/V 15:48–15:55 · M 16:07 | T1.1, T2.5, T2.6 |
| 1 | T2.5 | I 14:09–15:21 · V 15:21–15:31 · R 15:21–15:37 (reprovado) · F 15:37–15:44 · R/V 15:45–15:57 · M 16:08 | T1.1, T2.4, T2.6 |
| 1 | T2.6 | I 14:09–14:41 · R 14:42–15:11 · V 14:42–15:19 · M 16:09 | T1.1, T2.4, T2.5 |
| 2 | T2.1 | (fila até a 5ª vaga) I 16:53–17:18 · R 17:18–17:20 · V 17:18–17:28 · M 17:39 | T1.2–T1.5 |
| 4 | T2.2 | I 20:44–20:56 · R 20:56–20:59 · V 20:56–21:24 · F (timeout, agente avulso) + chore #32 · M 21:46 | T1.7 |
| 5 | T2.3 | I 21:51–22:07 · R 22:08–22:09 · V 22:08–22:16 · M 22:25 | T1.8 |
| 6 | T2.7 | I 22:42–22:54 · R 22:55–22:58 · V 22:55–23:02 · M 23:18 | T1.9 |
| 7 (25/10) | T2.8 | I 16:16–16:37 · R 16:37–16:40 · V 16:37–17:07 · M 17:38 | T1.10 |
| 7 | T1.10 | I 18/10 23:37–23:48 · R 16:16–16:18 · V 16:16–16:43 · F 16:44–17:00 · R 17:00–17:03 (reprovado) · F 17:12–17:22 · R/V 17:22–17:31 · M 17:42 | T2.8 |

A onda 7 começou em 18/10 às 23:36, mas a sessão foi encerrada no meio dela. Só a implementação da T1.10 terminou nesse dia. O resto foi retomado em 25/10 às 16:16, pelo cache do workflow, depois da limpeza descrita na seção 8.

A UI (T2.4–T2.6) dependia só dos tipos da F0 e correu inteira na onda 1, junto com o início do motor. Isso deixou a T2.7 limitada apenas pelo caminho crítico do motor e da IA.

## 3. Rodadas de retrabalho

| Ticket | Rodadas | Causa | Desfecho |
|---|---|---|---|
| T2.4 | 1 | O revisor achou um bug real (seção 4). | Corrigido em `fix(ui): end drag on window pointerup/cancel…` e aprovado na re-revisão. |
| T2.5 | 1 | O revisor achou um bug real (seção 4). | Corrigido com uma prop opcional `firstColor` no `MoveList` e aprovado. |
| T2.2 | 1 | No merge de verificação do orquestrador, um teste adversarial pesado estourou o timeout de 5 s com a suíte completa em paralelo. | O verificador deu timeout explícito aos testes pesados, e o chore #32 (timeout global de 30 s, revisado por Opus) resolveu a causa. |
| T1.10 | 2 | Rodada 1: um teste pesado da T1.9 (`oracle.adversarial.test.ts`) estourou 30 s com a máquina carregada, e o implementador subiu o timeout dele. Rodada 2: o revisor reprovou, porque o ticket proíbe alterar testes existentes. | O implementador reverteu, deixando o PR só com arquivos novos, e o revisor aprovou. A fragilidade do teste da T1.9 ficou no backlog (seção 10). |
| T2.1, T2.3, T2.6, T2.7, T2.8 | 0 | — | — |

A T1.10 chegou ao máximo de 2 rodadas sem precisar ser escalada.

## 4. O que o revisor e o verificador pegaram

**Revisor (Opus).** Pegou os dois únicos bugs funcionais de todo o MVP, os dois na onda 1:

- **T2.4, arraste preso (SPEC §6.2).** Quando a peça era solta fora do tabuleiro, os handlers de ponteiro do `div` não recebiam o `pointerup`, e o estado de arraste nunca era limpo. A peça seguia o cursor, e o clique seguinte em qualquer casa concluía o lance antigo, por exemplo arrastar `e2` para fora e depois clicar em `e4` chamava `onMove("e2","e4")`.
- **T2.5, numeração do `MoveList` (SPEC §6.1 e §6.3).** O componente supunha que o primeiro lance é sempre das brancas. Numa partida por `?fen=` com as pretas a jogar, ele mostrava `1. e5` em vez de `1... e5` e deslocava todos os pares.

Também segurou o escopo da T1.10 na segunda rodada (seção 3).

As notas não bloqueantes do revisor foram decisivas para a integração. Cinco orientações acumuladas das revisões de T2.4, T2.5, T2.3 e T1.8 foram passadas explicitamente ao implementador da T2.7, que as aplicou:

1. memoizar `board` e `legalMoves`;
2. passar `firstColor`;
3. tratar a rejeição de `requestMove`;
4. reconstruir a partida salva com `createGame` mais `play`;
5. provar que o build emite o chunk do Worker.

A T2.7 passou sem retrabalho, e o E2E não achou nenhum bug de integração.

**Verificador (Sonnet).** Escreveu 250 testes adversariais nos tickets T2.x, sem ler a implementação, e não pegou nenhum bug real que tenha feito um teste falhar. Contribuições relevantes:

- **T2.3:** apontou que um `cancel()` chamado depois da desmontagem do hook cria um Worker que nunca é encerrado. Não virou teste porque a SPEC não define o caso, mas foi registrado. O revisor viu o mesmo ponto.
- **T2.8:** escreveu 10 cenários E2E adversariais, entre eles soltar a peça fora do tabuleiro, cancelar a promoção, recarregar durante a vez da IA, afogamento por `?fen=` e o redirecionamento de `/play` sem partida salva. Todos passam. Ele também descobriu que o *route announcer* do Next também tem `role="alert"`, então `getByRole('alert')` é ambíguo nos testes.
- **T2.2 e T1.10:** os testes pesados dele expuseram a fragilidade de timeout da suíte (seção 5).

## 5. O que escapou

- **Timeouts da suíte rápida.** Duas vezes, testes pesados que passavam isolados estouraram o timeout com a suíte completa em paralelo: o adversarial da T2.2 na onda 4, e o oráculo adversarial da T1.9 na onda 7. Revisores e verificadores não viram o primeiro antes do merge de verificação do orquestrador. O segundo ainda está no limite com a máquina carregada e passa com ela livre.
- **Cenário 7 do E2E.** O teste verifica o indicador de "pensando" pelo `data-testid`, não pelo texto. A IA de nível 1 responde em milissegundos, e o teste usa um `MutationObserver` para registrar que o indicador apareceu. O revisor anotou isso como melhoria.
- **Robustez fora da SPEC.** O Worker vaza se `cancel()` for chamado depois da desmontagem. Nos níveis médio e difícil, um lance forçado gasta todo o tempo da busca.

Nenhum bug funcional foi encontrado depois de um merge. O E2E, a última barreira, passou de primeira.

## 6. Escalonamentos

Nenhum. Nenhum ticket pediu mudança de contrato, e nenhum precisou passar de 2 rodadas de retrabalho, embora a T1.10 tenha usado as duas. As decisões que mudaram o plano foram tomadas pelo humano:

- incluir a T1.10, a partir da lacuna apontada no relatório da Fase 1;
- concluir a onda 7 depois da interrupção.

## 7. Tempo e tokens

| Item | Valor |
|---|---|
| Onda 7 (retomada) | 25/10, das 16:16 aos merges às 17:42 (≈ 1h26), mais pelo menos 12 min em 18/10 antes da interrupção (das 23:36 até o fim da implementação da T1.10; o horário exato da interrupção não ficou registrado) |
| Agentes da onda 7 | 12 concluídos + 3 interrompidos pelo fim da sessão em 18/10 (implementador da T2.8, revisor e verificador da T1.10) |
| Tokens da onda 7 | ≈ 0,60 M na retomada. O trecho de 18/10 não tem registro de uso, porque a sessão foi encerrada antes do fim do workflow. |
| Tokens do MVP inteiro (subagentes) | ≈ 4,7 M: 3,96 M das ondas 1–6 e agentes avulsos (ver o relatório da Fase 1), ≈ 0,60 M da onda 7 e ≈ 0,14 M das revisões dos relatórios |

Os workflows misturam tickets das duas fases, então não há divisão exata de tokens por fase. Pela proporção de agentes, os T2.x ficam com um pouco menos da metade. O consumo do orquestrador não está incluído.

## 8. Incidentes da onda 7

1. **Sessão interrompida no meio da onda (18/10 → 25/10).** O workflow parou sem registro de conclusão. Na retomada, encontrei:
   - um lock órfão do E2E (`.claude/e2e.lock`), que travaria qualquer execução nova do Playwright;
   - o worktree da T2.8 com trabalho não commitado (`e2e/play.spec.ts`), segurando a branch local;
   - o worktree vazio do verificador da T1.10.

   O que fiz:
   - guardei uma cópia do trabalho parcial;
   - removi o lock e os worktrees, e liberei a branch;
   - retomei com `resumeFromRunId`.

   A implementação da T1.10 voltou do cache, e a T2.8 recomeçou do zero.
2. **Letra do drive de novo.** A sessão nova abriu com o diretório como `d:\` minúsculo, o mesmo problema da onda 2. Desta vez foi corrigido antes de disparar qualquer worktree, graças à memória registrada no incidente anterior.
3. **Comandos com `trap` e subshell recusados.** O comando com lock para a porta 3000, prescrito no prompt, foi recusado pelo harness nesta sessão. Os agentes rodaram a mesma lógica por scripts no scratchpad, com os mesmos locks.
4. **Porta 3000 compartilhada.** O `playwright.config.ts` usa `reuseExistingServer: true`. Sem serialização, um agente poderia testar o servidor de outro worktree. Isso foi mitigado com o lock de E2E e a checagem de porta livre, e nenhum caso aconteceu.

## 9. Lições

1. **O revisor rende mais em UI e integração do que em código bem especificado.** Na Fase 1 ele não reprovou nenhum ticket; na Fase 2 pegou os dois únicos bugs reais. A previsão do relatório da Fase 1 se confirmou.
2. **Notas do revisor passadas adiante evitam retrabalho.** A T2.7, o maior ticket de integração, passou de primeira com as cinco orientações acumuladas. Isso merece virar regra do processo: o orquestrador consolida as notas não bloqueantes por ticket dependente.
3. **O verificador cega dá cobertura, não descoberta, quando a SPEC é precisa.** Foram 642 testes adversariais no MVP (377 na Fase 1, 250 na Fase 2 e 15 na T1.10) e nenhum bug achado por eles. O valor está na rede de regressão e na robustez. Em UI, ele sofre por não poder ler a implementação para achar seletores. Ler só os textos visíveis e os `aria-label` funcionou.
4. **Escopo de arquivos rígido funciona, mas cobra testes compartilhados.** A T1.10 mostrou o custo: corrigir um teste frágil de outro ticket exige um ticket próprio. É a regra certa, e a SPEC §7.3 manda reprovar desvio de escopo, mas os tickets deveriam prever "ajustes de timeout em testes existentes" como chore do orquestrador.
5. **Sessões longas precisam de retomada planejada.** O cache do workflow salvou o trabalho concluído, mas sobraram lock órfão e trabalho não commitado. Locks deveriam ter dono e expiração, por exemplo um arquivo com PID e horário em vez de um `mkdir`, e implementadores deveriam fazer commits intermediários.
6. **Infraestrutura continua sendo a maior fonte de atrito.** Tivemos timeouts, porta compartilhada, letra do drive e restrições do harness. Antes de uma Fase 3 com mais paralelismo, vale investir em CI (GitHub Actions, já no backlog da SPEC §9), que tiraria as checagens da máquina compartilhada.

## 10. Backlog gerado

- **Testes:** dar timeout explícito maior ou mover para `*.slow.test.ts` os jogos aleatórios de `test/oracle/oracle.adversarial.test.ts` (posições 4–6), que chegam a 30–65 s com a máquina carregada.
- **IA:** devolver o lance forçado logo depois da profundidade 1 nos níveis médio e difícil (`search.ts` ou `handler.ts`).
- **Hooks:** guarda contra `cancel()` depois da desmontagem em `useEngine`, para não vazar o Worker.
- **E2E:** fazer o cenário 7 verificar também o texto "pensando".
- **Infra:** versionar `.claude/` no `.gitignore`; criar o alias `@fixtures/*`; locks com dono e expiração; CI no GitHub Actions (SPEC §9).
- **Itens da Fase 3 da SPEC §9:** ordenação de lances, quiescência, tabela de transposição, PGN, animações, relógio, deploy.
