migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId('_pb_users_auth_')

    const fixedCosts = new Collection({
      name: 'fixed_costs',
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
        { name: 'name', type: 'text', required: true },
        {
          name: 'category',
          type: 'select',
          values: [
            'salarios',
            'aluguel',
            'energia',
            'agua',
            'internet',
            'telefone',
            'marketing',
            'contabilidade',
            'outros',
          ],
          maxSelect: 1,
          required: true,
        },
        { name: 'amount', type: 'number', required: false, min: 0 },
        { name: 'due_day', type: 'number', required: false, min: 1, max: 31, onlyInt: true },
        { name: 'active', type: 'bool', required: false },
        { name: 'notes', type: 'text', required: false },
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
        'CREATE INDEX idx_fixed_costs_active ON fixed_costs (active)',
        'CREATE INDEX idx_fixed_costs_category ON fixed_costs (category)',
      ],
    })
    app.save(fixedCosts)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('fixed_costs')
      app.delete(col)
    } catch (_) {}
  },
)
