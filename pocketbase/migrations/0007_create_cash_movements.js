migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId('_pb_users_auth_')
    const invoicesCollection = app.findCollectionByNameOrId('invoices')

    const cashMovements = new Collection({
      name: 'cash_movements',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'owner' || created_by = @request.auth.id)",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'owner' || created_by = @request.auth.id)",
      createRule: "@request.auth.id != ''",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'owner' || created_by = @request.auth.id)",
      deleteRule:
        "@request.auth.id != '' && (@request.auth.role = 'owner' || created_by = @request.auth.id)",
      fields: [
        { name: 'date', type: 'text', required: true }, // YYYY-MM-DD
        {
          name: 'type',
          type: 'select',
          values: ['entry', 'exit'],
          maxSelect: 1,
          required: true,
        },
        { name: 'description', type: 'text', required: true },
        { name: 'category', type: 'text', required: false },
        { name: 'amount', type: 'number', required: false, min: 0 },
        {
          name: 'payment_method',
          type: 'select',
          values: ['dinheiro', 'pix', 'cartao', 'transferencia', 'boleto', 'outros'],
          maxSelect: 1,
          required: true,
        },
        {
          name: 'invoice_id',
          type: 'relation',
          collectionId: invoicesCollection.id,
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
        { name: 'notes', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_cash_movements_date ON cash_movements (date)',
        'CREATE INDEX idx_cash_movements_type ON cash_movements (type)',
        'CREATE INDEX idx_cash_movements_invoice ON cash_movements (invoice_id)',
      ],
    })
    app.save(cashMovements)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('cash_movements')
      app.delete(col)
    } catch (_) {}
  },
)
