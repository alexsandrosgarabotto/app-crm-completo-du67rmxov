migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. Clientes
    // Dono vê e edita tudo; vendedor vê seus clientes atribuídos ou criados por ele
    const clients = new Collection({
      name: 'clients',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'owner' || assigned_to = @request.auth.id || created_by = @request.auth.id || assigned_to = '')",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'owner' || assigned_to = @request.auth.id || created_by = @request.auth.id || assigned_to = '')",
      createRule: "@request.auth.id != ''",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'owner' || assigned_to = @request.auth.id || created_by = @request.auth.id)",
      deleteRule:
        "@request.auth.id != '' && (@request.auth.role = 'owner' || created_by = @request.auth.id)",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'email', type: 'text', required: false },
        { name: 'phone', type: 'text', required: false },
        { name: 'document', type: 'text', required: false }, // CPF ou CNPJ
        { name: 'company', type: 'text', required: false },
        { name: 'address', type: 'text', required: false },
        { name: 'city', type: 'text', required: false },
        { name: 'state', type: 'text', required: false },
        { name: 'notes', type: 'text', required: false },
        {
          name: 'status',
          type: 'select',
          values: ['lead', 'active', 'inactive'],
          maxSelect: 1,
          required: false,
        },
        {
          name: 'assigned_to',
          type: 'relation',
          collectionId: usersCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        },
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
        'CREATE INDEX idx_clients_assigned ON clients (assigned_to)',
        'CREATE INDEX idx_clients_status ON clients (status)',
      ],
    })
    app.save(clients)

    // 2. Vendas / Negócios (Pipeline)
    const deals = new Collection({
      name: 'deals',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'owner' || user_id = @request.auth.id || created_by = @request.auth.id)",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'owner' || user_id = @request.auth.id || created_by = @request.auth.id)",
      createRule: "@request.auth.id != ''",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'owner' || user_id = @request.auth.id || created_by = @request.auth.id)",
      deleteRule:
        "@request.auth.id != '' && (@request.auth.role = 'owner' || created_by = @request.auth.id)",
      fields: [
        { name: 'title', type: 'text', required: true },
        {
          name: 'client_id',
          type: 'relation',
          collectionId: clients.id,
          cascadeDelete: true,
          maxSelect: 1,
          required: true,
        },
        { name: 'value', type: 'number', required: false, min: 0 },
        {
          name: 'stage',
          type: 'select',
          values: ['lead', 'in_progress', 'won', 'lost'],
          maxSelect: 1,
          required: true,
        },
        { name: 'expected_close_date', type: 'text', required: false },
        { name: 'closed_date', type: 'text', required: false },
        {
          name: 'user_id',
          type: 'relation',
          collectionId: usersCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        }, // Responsável
        {
          name: 'created_by',
          type: 'relation',
          collectionId: usersCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        },
        { name: 'notes', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_deals_stage ON deals (stage)',
        'CREATE INDEX idx_deals_client ON deals (client_id)',
        'CREATE INDEX idx_deals_user ON deals (user_id)',
      ],
    })
    app.save(deals)

    // 3. Tarefas & Compromissos
    const tasks = new Collection({
      name: 'tasks',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'owner' || user_id = @request.auth.id || created_by = @request.auth.id)",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'owner' || user_id = @request.auth.id || created_by = @request.auth.id)",
      createRule: "@request.auth.id != ''",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'owner' || user_id = @request.auth.id || created_by = @request.auth.id)",
      deleteRule:
        "@request.auth.id != '' && (@request.auth.role = 'owner' || created_by = @request.auth.id)",
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'description', type: 'text', required: false },
        { name: 'due_date', type: 'text', required: true }, // Formato YYYY-MM-DD
        { name: 'due_time', type: 'text', required: false }, // Formato HH:MM
        {
          name: 'client_id',
          type: 'relation',
          collectionId: clients.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        },
        {
          name: 'deal_id',
          type: 'relation',
          collectionId: deals.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        },
        {
          name: 'user_id',
          type: 'relation',
          collectionId: usersCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        }, // Responsável
        {
          name: 'created_by',
          type: 'relation',
          collectionId: usersCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        },
        {
          name: 'priority',
          type: 'select',
          values: ['low', 'medium', 'high'],
          maxSelect: 1,
          required: false,
        },
        {
          name: 'status',
          type: 'select',
          values: ['pending', 'completed', 'cancelled'],
          maxSelect: 1,
          required: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_tasks_due ON tasks (due_date)',
        'CREATE INDEX idx_tasks_user ON tasks (user_id)',
        'CREATE INDEX idx_tasks_status ON tasks (status)',
      ],
    })
    app.save(tasks)

    // 4. Faturas e Contas (Receber / Pagar)
    const invoices = new Collection({
      name: 'invoices',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'owner' || created_by = @request.auth.id)",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'owner' || created_by = @request.auth.id)",
      createRule: "@request.auth.id != ''",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'owner' || created_by = @request.auth.id)",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'owner'",
      fields: [
        { name: 'description', type: 'text', required: true },
        {
          name: 'type',
          type: 'select',
          values: ['receivable', 'payable'],
          maxSelect: 1,
          required: true,
        },
        { name: 'amount', type: 'number', required: false, min: 0 },
        {
          name: 'status',
          type: 'select',
          values: ['pending', 'paid', 'cancelled'],
          maxSelect: 1,
          required: true,
        },
        { name: 'due_date', type: 'text', required: true }, // YYYY-MM-DD
        { name: 'paid_date', type: 'text', required: false },
        {
          name: 'client_id',
          type: 'relation',
          collectionId: clients.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        },
        {
          name: 'deal_id',
          type: 'relation',
          collectionId: deals.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        },
        { name: 'category', type: 'text', required: false },
        {
          name: 'created_by',
          type: 'relation',
          collectionId: usersCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        },
        { name: 'notes', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_invoices_due ON invoices (due_date)',
        'CREATE INDEX idx_invoices_status ON invoices (status)',
        'CREATE INDEX idx_invoices_type ON invoices (type)',
      ],
    })
    app.save(invoices)

    // 5. Configurações da Empresa
    const companySettings = new Collection({
      name: 'company_settings',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.role = 'owner'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'owner'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'owner'",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'trade_name', type: 'text', required: false },
        { name: 'document', type: 'text', required: false }, // CNPJ
        { name: 'email', type: 'text', required: false },
        { name: 'phone', type: 'text', required: false },
        { name: 'address', type: 'text', required: false },
        { name: 'currency', type: 'text', required: false },
        { name: 'website', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(companySettings)
  },
  (app) => {
    const toDelete = ['company_settings', 'invoices', 'tasks', 'deals', 'clients']
    for (const name of toDelete) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }
  },
)
