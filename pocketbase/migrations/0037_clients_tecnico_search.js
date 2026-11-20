// 0037 — Técnico (Somente OS) precisa ENXERGAR o cadastro de clientes para
// criar OS com autocomplete (digitar 3+ letras e escolher), e PRECISÃO de
// editar telefone/endereço do cliente atendido pela ficha da OS.
//
// Regra antiga de leitura deixava o técnico sem ver quase nenhum cliente
// (só os atribuídos a ele), o que quebraria a busca. Nova regra: qualquer
// usuário autenticado LÊ (busca na OS); editar/continua restrito ao dono,
// aos atribuídos e a quem criou (exigência: técnico não ganha Clientes no
// menu — continua vendo apenas Ordens de Serviço; pode corrigir o telefone/
// endereço do cliente da OS que atendeu, pela ficha dela).
migrate(
  (app) => {
    const clients = app.findCollectionByNameOrId('clients')
    const leitura = "@request.auth.id != ''"
    clients.listRule = leitura
    clients.viewRule = leitura
    app.save(clients)
    console.log('0037: leitura de clients liberada para usuários autenticados (busca na OS)')
  },
  (app) => {
    const clients = app.findCollectionByNameOrId('clients')
    const leitura =
      "@request.auth.id != '' && (@request.auth.role = 'owner' || assigned_to = @request.auth.id || created_by = @request.auth.id || assigned_to = '')"
    clients.listRule = leitura
    clients.viewRule = leitura
    app.save(clients)
  },
)
