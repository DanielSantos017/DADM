# Homologação em segundo projeto Firebase

Esta branch é adequada para **testes isolados**, não para movimentações financeiras reais. Não aponte o segundo deploy ao Realtime Database ou Storage de produção. As regras ainda não foram validadas no emulador neste ambiente e decisões colegiadas permanecem inativas sem membros e quóruns.

## Configuração antes de publicar

1. Crie projeto Firebase separado, com Authentication, Realtime Database e Storage próprios. Faça backup das regras e dados de qualquer projeto existente antes de alterar as regras.
2. Defina as variáveis de `.env.example` no servidor de homologação. Nunca publique `FIREBASE_SERVICE_ACCOUNT_JSON`, `PUBLIC_FORM_RATE_SECRET`, `TURNSTILE_SECRET_KEY`, `EXPORT_SECRET` ou `FIREBASE_DB_SECRET` no navegador. Restrinja a conta de serviço ao projeto de homologação.
3. Configure Turnstile para o **hostname de homologação**. Sem `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` e `PUBLIC_FORM_RATE_SECRET`, o formulário público responderá 503 por segurança.
4. Instale as regras de `database.rules.json` e `storage.rules` **somente no projeto de homologação**. O deploy da aplicação não publica essas regras automaticamente.
5. Crie o primeiro perfil `roles/<firebase-auth-uid>` com `email` e `role: "tesoureiro"` por uma credencial administrativa do projeto. O app não oferece autopromoção. Os demais usuários entram como `pendente` e são aprovados pela Tesouraria.
6. Não cadastre `governance_policy` com membros ou quóruns fictícios. Solicitações colegiadas ficam pendentes até a Tesouraria fornecer UIDs, quóruns e versão da política.

## Verificações antes do teste de usuários

- `npm ci`, `npm test`, `npx tsc --noEmit`, `npm run test:rules`, `npm run build` no ambiente de publicação. Corrija qualquer falha; não substitua falha do emulador por inspeção visual.
- Visitante não pode ler Caixa, papéis, pedidos ou comprovantes; envio público funciona somente com Turnstile e limite de tentativas.
- Usuário comum não consegue lançar diretamente em `transactions`, alterar reserva ou criar voto pelo SDK do navegador.
- Receita manual somente com tesoureiro; despesa manual somente com autorização aprovada e suficiente; reutilizar o protocolo deve retornar 409.
- Upload de documento PDF/PNG/JPG de até 5 MB é opcional no Caixa, e download só funciona para tesoureiro/coordenador autenticado.
- Reembolso público só é aprovado com autorização anterior ao gasto ou exceção aprovada. Confirmar o pagamento lança no Caixa uma única vez.
- Conferir a reserva usando exemplo de R$ 100,00 brutos, R$ 3,00 de taxas e R$ 7,00 de estornos: líquido de R$ 90,00, reserva de R$ 18,00. Nenhum Pix ou split bancário é executado pelo app.

## Restrições deliberadas

- O atalho que lançava somente o saldo líquido de projeto/lote foi desativado. Entradas e saídas brutas devem ser conciliadas separadamente.
- Venda de estoque reduz o item, mas **não** cria receita automática; a Tesouraria precisa registrar a entrada conciliada. Não usar essa rotina como ponto de venda até haver integração transacional.
- Lançamentos do Caixa são imutáveis no SDK cliente. O tesoureiro pode gerar estorno reversor justificado para lançamentos individuais não vinculados a reembolso ou reserva; o original permanece. Pedidos de correção não geram estorno automaticamente. Lançamentos vinculados exigem conciliação específica.
- Não existem ainda fechamento semestral, registro patrimonial, prestação de contas em vacância, alertas de prazo fiscal e split por provedor de pagamento.
- O documento do Caixa é opcional por decisão operacional; isso exige validação da Tesouraria quanto ao art. 4º do regimento.

Não migrar dados reais para o projeto de homologação sem anonimizar nomes, e-mails, comprovantes e chaves Pix.
