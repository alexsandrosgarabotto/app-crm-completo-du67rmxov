migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId('_pb_users_auth_')
    const clientsCollection = app.findCollectionByNameOrId('clients')

    // Regra comum do CRM: qualquer usuário autenticado lê/edita; exclusão só owner.
    const authed = "@request.auth.id != ''"
    const ownerOnly = "@request.auth.id != '' && @request.auth.role = 'owner'"

    // ---------------------------------------------------------------
    // 1. Ordens de Serviço (itens embutidos como JSON, padrão do app)
    // ---------------------------------------------------------------
    const serviceOrders = new Collection({
      name: 'service_orders',
      type: 'base',
      listRule: authed,
      viewRule: authed,
      createRule: authed,
      updateRule: authed,
      deleteRule: ownerOnly,
      fields: [
        { name: 'number', type: 'text', required: false }, // OS-0001
        {
          name: 'client_id',
          type: 'relation',
          collectionId: clientsCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: true,
        },
        { name: 'conversation_id', type: 'text', required: false }, // conversa WhatsApp de origem
        {
          name: 'status',
          type: 'select',
          values: ['aberta', 'em_andamento', 'aguardando_peca', 'finalizada', 'cancelada'],
          maxSelect: 1,
          required: true,
        },
        { name: 'opened_at', type: 'date', required: false },
        { name: 'finished_at', type: 'date', required: false },
        {
          name: 'responsible_id',
          type: 'relation',
          collectionId: usersCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        },
        { name: 'problem_description', type: 'text', required: false },
        { name: 'notes', type: 'text', required: false },
        { name: 'items', type: 'json', required: false, maxSize: 2000000 },
        { name: 'total_value', type: 'number', required: false },
        { name: 'invoice_id', type: 'text', required: false }, // conta a receber gerada
        { name: 'stock_released', type: 'bool', required: false }, // baixa de estoque já feita
        {
          name: 'created_by',
          type: 'relation',
          collectionId: usersCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_so_client ON service_orders (client_id)',
        'CREATE INDEX idx_so_status ON service_orders (status)',
        'CREATE INDEX idx_so_number ON service_orders (number)',
      ],
    })
    app.save(serviceOrders)

    // ---------------------------------------------------------------
    // 2. Templates de mensagens automáticas do WhatsApp (editáveis na UI)
    // ---------------------------------------------------------------
    const templates = new Collection({
      name: 'whatsapp_templates',
      type: 'base',
      listRule: authed,
      viewRule: authed,
      createRule: authed,
      updateRule: authed,
      deleteRule: ownerOnly,
      fields: [
        {
          name: 'key',
          type: 'select',
          values: ['greeting', 'menu'],
          maxSelect: 1,
          required: true,
        },
        { name: 'body', type: 'text', required: true, maxSize: 4000 },
        { name: 'active', type: 'bool', required: false },
        {
          name: 'updated_by',
          type: 'relation',
          collectionId: usersCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_watpl_key ON whatsapp_templates (key)'],
    })
    app.save(templates)

    // Seed com os textos atuais (que estavam fixos no hook) como padrão.
    const existing = app.findRecordsByFilter('whatsapp_templates', '', '', 500, 0)
    if (existing.length === 0) {
      const seed = [
        {
          key: 'greeting',
          body: '{{saudacao}}{{nome}}! Aqui é da equipe de atendimento. Recebemos sua mensagem e já estamos te respondendo. Em que podemos ajudar?',
        },
        {
          key: 'menu',
          body: 'Digite o número da opção desejada:\n\n1 - Falar com um atendente\n2 - Solicitar um orçamento\n3 - Horários de atendimento\n4 - Outros assuntos',
        },
      ]
      for (const item of seed) {
        const record = new Record(templates)
        record.set('key', item.key)
        record.set('body', item.body)
        record.set('active', true)
        app.save(record)
      }
    }
  },
  (app) => {
    for (const name of ['whatsapp_templates', 'service_orders']) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }
  },
)
