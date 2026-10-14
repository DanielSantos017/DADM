# Adequação ao Regimento Interno da Tesouraria

Este arquivo acompanha a implementação. Um item só deve ser marcado como concluído depois de haver bloqueio no servidor/regras do banco, testes e validação de um tesoureiro. Telas, avisos ou cálculos isolados não tornam o APP conforme.

## Estado atual

| Exigência | Artigo | Estado | Critério de conclusão |
| --- | --- | --- | --- |
| Documento em toda entrada/saída | 4º | Upload privado e opcional disponível no Caixa; não há bloqueio sem anexo | Definir procedimento para documentos ausentes e validar interpretação do art. 4º com a Tesouraria. |
| Solicitação, análise, aprovação e pagamento de projeto | 5º | Parcial | Estados separados, orçamento versionado e trilha de aprovação antes do desembolso. |
| Todas as entradas e despesas por projeto | 5º-A | Parcial | Lançamentos brutos conciliados, classificados e sem substituição pelo resultado líquido. |
| Plano orçamentário pré-aprovado e exceção expressa | 5º-B, §1º | Despesa manual exige autorização aprovada pela API; projetos ainda não integrados | Integrar orçamento versionado de projeto ao desembolso e testar regras no emulador. |
| Três cotações comparáveis e menor custo | 5º-B, §2º | Anexos e verificação de três fornecedores nas solicitações; despesa manual usa decisão aprovada | Conferência humana de equivalência dos itens e integração completa com projetos e compras. |
| Jurisdição da Tesouraria sobre receitas e aprovação de gastos | 5º-C | Receita manual apenas por tesoureiro e despesa manual mediante decisão; outros módulos pendentes | Integrar vendas de estoque, lotes e projetos sem lançamentos líquidos ou fora do servidor. |
| Comprovante fiscal definitivo em cinco dias úteis | 5º-D | Base de cálculo testada | Data do gasto, calendário de feriados, alertas e bloqueio de novos repasses. |
| Reembolso previamente autorizado ou exceção aprovada | 5º-E | API dos pedidos públicos bloqueia aprovação sem base; fluxo legado congelado nas regras propostas | Validar regras no emulador e implantar; conferir escopo da autorização, não apenas valor/data. |
| Reserva de 20% da receita líquida | 5º-F | Razão interno calcula bruto menos taxas e estornos; conciliação manual | Comprovar taxas e estornos no extrato, tratar migração histórica e conferir periodicamente o saldo reservado. Integração bancária está fora do escopo. |
| Uso da reserva com duas aprovações | 5º-F | Regra aplicada às novas liberações no razão; política de quórum pendente | Configurar membros e quóruns, validar atos e impedir caminhos financeiros paralelos. |
| Balancete e balanço patrimonial semestrais | 6º | Não implementado | Fechamento de período com entradas, saídas por área/projeto e patrimônio. |
| Prestação imediata em vacância, com ata | 7º | Não implementado | Fluxo de transição do tesoureiro, pacote de contas e ata anexada. |
| Conferência semestral de bens | 8º | Não implementado | Patrimônio separado do estoque comercial, contagem e divergências documentadas. |

## Sequência de implantação

1. **Governança e trilha de auditoria:** papéis de tesoureiro, colegiado, Conselho Administrativo e assinatura administrativa; decisões imutáveis com ator, data e evidência. A proteção precisa ser no servidor e nas regras do Firebase.
2. **Orçamento e autorização:** solicitações por área/projeto, orçamento versionado e aprovação prévia. Não permitir lançamento de gasto apenas porque uma tela mostra o botão.
3. **Cotações e desembolsos:** vínculo de três propostas ao pedido, comparação e escolha justificadas, comprovante antes do pagamento e documento fiscal definitivo depois.
4. **Reembolso:** vínculo obrigatório com autorização prévia; exceção em fluxo próprio, sem aprovação automática pela tela atual.
5. **Receita, reserva e conciliação manual:** registrar valor bruto, taxas, estornos e entrada líquida; separar contabilmente 20% da entrada líquida. Divergências precisam de lançamentos reversores, não edição do histórico. Não haverá integração bancária.
6. **Prazo, bloqueios e relatórios:** calendário de dias úteis, alerta, bloqueio de repasses, fechamento semestral, patrimônio e prestação de contas em vacância.

## Decisões da Tesouraria pendentes

- Composição e quórum do colegiado e do Conselho Administrativo; comprovação da reunião/ata.
- Definição operacional de entrada financeira líquida, tratamento de taxas, estornos, devoluções e arredondamento em centavos.
- Calendário de feriados usado no prazo de cinco dias úteis.
- Tratamento dos lançamentos e reembolsos legados durante a migração.

Pedidos legados pendentes permanecem visíveis para auditoria, mas não podem mais ser aprovados ou excluídos pelo navegador após a publicação das regras propostas. O solicitante deve registrar novo pedido no formulário público, citando o protocolo antigo na justificativa. A equipe deve conciliar duplicidades antes de qualquer pagamento. Como as regras ainda não foram implantadas, a proteção não está ativa em produção.

Por decisão operacional, o documento de entrada ou saída do Caixa pode ser anexado depois do lançamento, sem impedir o registro financeiro. O arquivo fica privado no Storage (PDF, PNG ou JPG, até 5 MB) e é acessado apenas por perfis da diretoria. Essa flexibilidade não comprova, por si só, atendimento ao art. 4º; convém definir exceções, prazo e revisão periódica dos lançamentos sem documento.

As novas rotas `/governanca` e `/reserva` são uma base operacional, não um selo de conformidade. `governance_policy` precisa ser configurada por administrador do Firebase com `version`, membros e quóruns de `treasury` e `council`, e `reimbursementExceptionBodies`. Não há quórum padrão. As regras negam escrita dessa política pelo navegador. Sem ela, decisões colegiadas não são concluídas.

`calculateNetReceipt` aplica a definição informada pela Tesouraria (recebido bruto menos taxas do meio de pagamento e estornos/devoluções); `allocateNetReceipt` calcula 20% e `/api/reserva` registra em razão interno após confirmação manual do extrato. Integração bancária, transferência automática e split de PSP estão fora do escopo por decisão do usuário. `fiscalReceiptDeadline` está testada, mas alertas e bloqueios ainda dependem do calendário de feriados e do vínculo entre gasto e responsável. Não implantar como automação financeira integral antes de tratar os caminhos legados e fazer conciliação real.

O painel soma ao saldo já lançado no Caixa a variação líquida dos projetos `Aberto` e `Pendente_Aprovacao`, exibindo **saldo projetado não contábil**. Projetos `Processado` não entram nessa projeção. Na reabertura de um projeto com fechamento legado já lançado no Caixa, o valor desse fechamento vira base de comparação para evitar dupla contagem. Só o tesoureiro pode reabrir, pela API, com justificativa e auditoria. A composição do Colegiado da Tesouraria pode ser gerida pelo tesoureiro na aba `/colegiado`; isso não define quórum automaticamente.
