# APP-DADM

Aplicação de controle financeiro, estoque, pedidos, projetos e reembolsos do DADM. Usa Next.js 16 e Firebase Realtime Database.

## Desenvolvimento

```bash
npm ci
npm run dev
```

Copie `.env.example` para `.env.local` e preencha as variáveis. Não publique esse arquivo. As variáveis `NEXT_PUBLIC_*` são públicas. `FIREBASE_SERVICE_ACCOUNT_JSON` aceita o JSON da conta de serviço em uma linha; em hospedagem com credenciais padrão, pode ficar vazio. A conta precisa acessar Realtime Database e Storage. Defina `PUBLIC_FORM_RATE_SECRET` como segredo aleatório longo.

## Reembolso público

O formulário em `/reembolso` não exige login. A pessoa informa nome, e-mail, valor, chave e titular Pix, justificativa e comprovante PDF/PNG/JPG de até 5 MB. O servidor valida os dados, o desafio Cloudflare Turnstile e o limite de cinco envios por IP/hora. Dados Pix e comprovantes ficam separados dos registros exibidos nas listagens.

Na tela interna `/reembolsos`, a diretoria analisa e aprova ou recusa. Somente o tesoureiro registra o pagamento, com a referência Pix. O lançamento no caixa ocorre ao marcar como pago, não na aprovação. O Pix em si é feito fora do aplicativo.

O pedido novo solicita a data/hora do gasto e um protocolo de autorização prévia, se houver. A aprovação via servidor exige autorização de gasto aprovada **antes** do gasto e com valor suficiente, ou uma exceção vinculada ao reembolso e aprovada em `/governanca`. A compatibilidade de finalidade e o documento fiscal ainda precisam de conferência humana. Reembolsos legados pendentes ficam preservados para auditoria; após publicar as regras propostas, não podem ser aprovados pelo fluxo antigo. É necessário abrir novo pedido e conciliar o protocolo anterior.

## Governança e reserva

`/governanca` registra planos orçamentários, autorizações de gastos, exceções de reembolso e pedidos de uso da reserva. Gastos exigem três cotações de fornecedores distintos com propostas anexadas antes da aprovação. A equivalência dos itens precisa ser verificada pelos votantes. Decisões do colegiado e do Conselho só são concluídas após configurar `governance_policy` no Firebase Admin, com UIDs dos membros, quóruns e versão; não existe quórum presumido. O uso do Fundo de Reserva exige os dois órgãos. O tesoureiro pode registrar autorização expressa de gasto não previsto e veto justificado.

`/reserva` mantém um razão interno: o tesoureiro vincula uma entrada bruta individual do Caixa à referência do extrato, informa taxas e estornos, e o servidor separa 20% do líquido para a reserva, sem criar receita adicional. Uma liberação exige pedido de reserva aprovado pelos dois órgãos e uma despesa correspondente no Caixa. Integração bancária, transferência automática e split de PSP estão fora do escopo por decisão do usuário; veja [a matriz de conformidade](docs/regimento-conformidade.md) antes de implantar.

O painel exibe separadamente o saldo lançado no Caixa, a variação líquida dos projetos abertos/pendentes e o saldo projetado. Essa projeção não cria transações. O tesoureiro pode reabrir um projeto `Processado` com justificativa; valores de fechamento já incorporados ao Caixa são descontados da projeção. A aba `/colegiado`, exclusiva do tesoureiro, nomeia usuários ativos já cadastrados para o Colegiado da Tesouraria, sem alterar o perfil base. Quóruns continuam pendentes de definição.

Crie um widget Turnstile para o domínio da aplicação e configure `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` e `TURNSTILE_EXPECTED_HOSTNAME` (somente host, sem protocolo). Sem as chaves, o formulário fica indisponível. `seudominio.com/reembolso` é uma rota; para `reembolso.seudominio.com` é preciso configurar DNS e roteamento na hospedagem.

Antes de produção, publique um aviso de privacidade, defina prazo de retenção e processo de exclusão dos comprovantes e confirme a base legal para tratar dados pessoais e bancários.

## Segurança do Firebase

`database.rules.json` e `storage.rules` estão versionados, mas **não são publicados automaticamente**. As regras novas podem afetar integrações existentes; confira o projeto alvo e faça backup das regras vigentes antes de implantar. Execute:

```bash
npm test
npm run test:rules
npx tsc --noEmit
```

Depois da revisão, publique com `npx firebase deploy --only database,storage --project SEU_PROJECT_ID`. Não use regras globais `.read`/`.write: true`. O formulário usa Admin SDK no servidor. As regras não dão ao navegador acesso direto a `reimbursement_private` nem aos comprovantes; rotas internas verificam ID token e perfil no servidor.

## Exportação para integração

`POST /api/export-data` exige `Authorization: Bearer <EXPORT_SECRET>`. Defina `EXPORT_SECRET` e `FIREBASE_DB_SECRET` apenas no ambiente do servidor; sem ambos, a rota retorna 503. A integração anterior que usava `GET` com `token` e `fireauth` na URL deve ser atualizada. Gere um segredo novo para `EXPORT_SECRET`, pois o valor padrão antigo foi publicado no histórico Git. Não inclua credenciais em query strings da chamada à aplicação.

O endpoint retorna as coleções formatadas para planilhas. A integração deve tratar respostas 401, 502 e 503 e executar a exportação somente em ambiente confiável.

## Controle de acesso

A navegação e as telas fazem checagens de perfil no cliente. A proteção real depende das regras do Firebase, agora versionadas no repositório, e da implantação delas no projeto correto. Não há mais autopromoção por e-mail fixo: o primeiro tesoureiro precisa ser criado por administrador do Firebase fora do aplicativo. Despesas manuais são registradas somente pela API com autorização aprovada; o cliente não escreve diretamente em `transactions`. Um protocolo de autorização não pode ser usado em dois gastos ou reembolsos. Estornos individuais elegíveis geram um lançamento inverso, sem excluir o original.

## Limitações conhecidas

- O projeto usa fontes locais do sistema para permitir build sem download de fontes; a aparência pode variar ligeiramente por plataforma.
- O lint do código existente contém violações de `no-explicit-any` e regras de hooks. A verificação TypeScript pode passar enquanto o lint falha.
- A conciliação bancária ainda é uma confirmação manual com referência de extrato; não há integração bancária, split bancário ou pagamento Pix automático.
- Lotes, projetos e vendas de estoque ainda exigem conciliação manual de entradas e saídas brutas; os atalhos antigos que lançavam resultado líquido no Caixa foram suspensos.
- O limite por IP depende dos cabeçalhos do proxy. Além do Turnstile, configure proteção de borda/WAF. Não há confirmação de e-mail nem deduplicação de comprovantes.
