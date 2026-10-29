migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId('_pb_users_auth_')
    const clientsCollection = app.findCollectionByNameOrId('clients')
    const dealsCollection = app.findCollectionByNameOrId('deals')

    // 1. Coleção: products (Estoque)
    const products = new Collection({
      name: 'products',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule:
        "@request.auth.id != '' && (@request.auth.role = 'owner' || created_by = @request.auth.id)",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'sku', type: 'text', required: false },
        { name: 'description', type: 'text', required: false },
        { name: 'category', type: 'text', required: false },
        { name: 'unit', type: 'text', required: false }, // UN, KG, CX, PC, M
        { name: 'sale_price', type: 'number', required: false, min: 0 },
        { name: 'cost_price', type: 'number', required: false, min: 0 },
        { name: 'stock_quantity', type: 'number', required: false },
        { name: 'min_stock', type: 'number', required: false, min: 0 },
        { name: 'active', type: 'bool', required: false },
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
        'CREATE INDEX idx_products_sku ON products (sku)',
        'CREATE INDEX idx_products_category ON products (category)',
      ],
    })
    app.save(products)

    // 2. Coleção: stock_movements (Movimentações de Estoque)
    const stockMovements = new Collection({
      name: 'stock_movements',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'owner'",
      fields: [
        {
          name: 'product_id',
          type: 'relation',
          collectionId: products.id,
          cascadeDelete: true,
          maxSelect: 1,
          required: true,
        },
        {
          name: 'type',
          type: 'select',
          values: ['entry', 'exit', 'adjustment'],
          maxSelect: 1,
          required: true,
        },
        { name: 'quantity', type: 'number', required: true },
        { name: 'reason', type: 'text', required: false },
        {
          name: 'deal_id',
          type: 'relation',
          collectionId: dealsCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        },
        { name: 'date', type: 'text', required: false }, // YYYY-MM-DD
        {
          name: 'user_id',
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
        'CREATE INDEX idx_stock_movements_product ON stock_movements (product_id)',
        'CREATE INDEX idx_stock_movements_deal ON stock_movements (deal_id)',
        'CREATE INDEX idx_stock_movements_type ON stock_movements (type)',
      ],
    })
    app.save(stockMovements)

    // 3. Coleção: services (Catálogo de Serviços)
    const services = new Collection({
      name: 'services',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule:
        "@request.auth.id != '' && (@request.auth.role = 'owner' || created_by = @request.auth.id)",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'description', type: 'text', required: false },
        { name: 'price', type: 'number', required: false, min: 0 },
        { name: 'duration_minutes', type: 'number', required: false, min: 0 },
        { name: 'category', type: 'text', required: false },
        { name: 'iss_rate', type: 'number', required: false, min: 0 }, // % Alíquota ISS
        { name: 'active', type: 'bool', required: false },
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
      indexes: ['CREATE INDEX idx_services_category ON services (category)'],
    })
    app.save(services)

    // 4. Coleção: deal_items (Itens de Produtos e Serviços da Venda)
    const dealItems = new Collection({
      name: 'deal_items',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'deal_id',
          type: 'relation',
          collectionId: dealsCollection.id,
          cascadeDelete: true,
          maxSelect: 1,
          required: true,
        },
        {
          name: 'item_type',
          type: 'select',
          values: ['product', 'service'],
          maxSelect: 1,
          required: true,
        },
        {
          name: 'product_id',
          type: 'relation',
          collectionId: products.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        },
        {
          name: 'service_id',
          type: 'relation',
          collectionId: services.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        },
        { name: 'name_snapshot', type: 'text', required: true },
        { name: 'quantity', type: 'number', required: false, min: 0 },
        { name: 'unit_price', type: 'number', required: false, min: 0 },
        { name: 'total_price', type: 'number', required: false, min: 0 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_deal_items_deal ON deal_items (deal_id)'],
    })
    app.save(dealItems)

    // 5. Coleção: fiscal_documents (Notas Fiscais NF-e / NFS-e)
    const fiscalDocuments = new Collection({
      name: 'fiscal_documents',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'owner'",
      fields: [
        {
          name: 'doc_type',
          type: 'select',
          values: ['NFE', 'NFSE'],
          maxSelect: 1,
          required: true,
        },
        {
          name: 'deal_id',
          type: 'relation',
          collectionId: dealsCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        },
        {
          name: 'client_id',
          type: 'relation',
          collectionId: clientsCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        },
        { name: 'nature_operation', type: 'text', required: false },
        { name: 'total_amount', type: 'number', required: false, min: 0 },
        {
          name: 'status',
          type: 'select',
          values: ['pending', 'to_transmit', 'transmitted', 'authorized', 'rejected', 'cancelled'],
          maxSelect: 1,
          required: true,
        },
        { name: 'number', type: 'text', required: false },
        { name: 'series', type: 'text', required: false },
        { name: 'access_key', type: 'text', required: false },
        { name: 'provider_message', type: 'text', required: false },
        { name: 'issue_date', type: 'text', required: false }, // YYYY-MM-DD
        { name: 'xml_payload', type: 'text', required: false },
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
        'CREATE INDEX idx_fiscal_docs_type ON fiscal_documents (doc_type)',
        'CREATE INDEX idx_fiscal_docs_status ON fiscal_documents (status)',
        'CREATE INDEX idx_fiscal_docs_deal ON fiscal_documents (deal_id)',
        'CREATE INDEX idx_fiscal_docs_client ON fiscal_documents (client_id)',
      ],
    })
    app.save(fiscalDocuments)

    // 6. Coleção: fiscal_settings (Configurações Fiscais e Provedor NF-e/NFS-e)
    const fiscalSettings = new Collection({
      name: 'fiscal_settings',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.role = 'owner'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'owner'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'owner'",
      fields: [
        {
          name: 'provider',
          type: 'select',
          values: ['focus_nfe', 'nfe_io', 'plugnotas', 'custom'],
          maxSelect: 1,
          required: false,
        },
        { name: 'api_token', type: 'text', required: false },
        {
          name: 'environment',
          type: 'select',
          values: ['homologation', 'production'],
          maxSelect: 1,
          required: false,
        },
        { name: 'nfe_series', type: 'text', required: false },
        { name: 'nfse_series', type: 'text', required: false },
        { name: 'cnpj', type: 'text', required: false },
        { name: 'state_registration', type: 'text', required: false }, // Inscrição Estadual
        { name: 'municipal_registration', type: 'text', required: false }, // Inscrição Municipal
        {
          name: 'tax_regime',
          type: 'select',
          values: ['simples_nacional', 'lucro_presumido', 'lucro_real', 'mei'],
          maxSelect: 1,
          required: false,
        },
        { name: 'certificate_info', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(fiscalSettings)
  },
  (app) => {
    const toDelete = [
      'fiscal_settings',
      'fiscal_documents',
      'deal_items',
      'services',
      'stock_movements',
      'products',
    ]
    for (const name of toDelete) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }
  },
)
