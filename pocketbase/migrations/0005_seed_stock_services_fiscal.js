migrate(
  (app) => {
    const productsCol = app.findCollectionByNameOrId('products')
    const servicesCol = app.findCollectionByNameOrId('services')
    const stockMovCol = app.findCollectionByNameOrId('stock_movements')
    const fiscalSettingsCol = app.findCollectionByNameOrId('fiscal_settings')
    const fiscalDocsCol = app.findCollectionByNameOrId('fiscal_documents')
    const dealsCol = app.findCollectionByNameOrId('deals')
    const clientsCol = app.findCollectionByNameOrId('clients')
    const dealItemsCol = app.findCollectionByNameOrId('deal_items')

    let ownerUser
    try {
      ownerUser = app.findAuthRecordByEmail(
        '_pb_users_auth_',
        'administrativo@atomicsorriso.com.br',
      )
    } catch (_) {}

    // 1. Seed Produtos (se vazio)
    const existingProducts = app.findRecordsByFilter('products', '', '', 1, 0)
    let p1, p2, p3
    if (existingProducts.length === 0) {
      p1 = new Record(productsCol)
      p1.set('name', 'Licença de Software Atomic Pro (USB Dongle)')
      p1.set('sku', 'SW-PRO-001')
      p1.set('description', 'Dispositivo com licença física criptografada e suporte anual.')
      p1.set('category', 'Softwares & Licenças')
      p1.set('unit', 'UN')
      p1.set('sale_price', 1450)
      p1.set('cost_price', 450)
      p1.set('stock_quantity', 18)
      p1.set('min_stock', 5)
      p1.set('active', true)
      if (ownerUser) p1.set('created_by', ownerUser.id)
      app.save(p1)

      p2 = new Record(productsCol)
      p2.set('name', 'Terminal POS Integrado com TEF')
      p2.set('sku', 'HW-POS-010')
      p2.set('description', 'Terminal moderno para checkout, integração fiscal automática.')
      p2.set('category', 'Equipamentos & Hardware')
      p2.set('unit', 'UN')
      p2.set('sale_price', 2800)
      p2.set('cost_price', 1600)
      p2.set('stock_quantity', 2) // Estoque baixo! Menor que min_stock (4)
      p2.set('min_stock', 4)
      p2.set('active', true)
      if (ownerUser) p2.set('created_by', ownerUser.id)
      app.save(p2)

      p3 = new Record(productsCol)
      p3.set('name', 'Kit Bobinas Térmicas Fiscais 80mm (Caixa c/ 30un)')
      p3.set('sku', 'SUP-BOB-030')
      p3.set('description', 'Bobinas térmicas para emissão de cupom fiscal e comprovantes.')
      p3.set('category', 'Suprimentos')
      p3.set('unit', 'CX')
      p3.set('sale_price', 120)
      p3.set('cost_price', 65)
      p3.set('stock_quantity', 1) // Estoque crítico!
      p3.set('min_stock', 10)
      p3.set('active', true)
      if (ownerUser) p3.set('created_by', ownerUser.id)
      app.save(p3)

      // Movimentação inicial
      const mov1 = new Record(stockMovCol)
      mov1.set('product_id', p1.id)
      mov1.set('type', 'entry')
      mov1.set('quantity', 20)
      mov1.set('reason', 'Entrada de lote fornecedor Tech Distribuição')
      mov1.set('date', '2025-05-01')
      if (ownerUser) mov1.set('user_id', ownerUser.id)
      app.save(mov1)

      const mov2 = new Record(stockMovCol)
      mov2.set('product_id', p2.id)
      mov2.set('type', 'entry')
      mov2.set('quantity', 5)
      mov2.set('reason', 'Estoque inicial de implantação')
      mov2.set('date', '2025-05-01')
      if (ownerUser) mov2.set('user_id', ownerUser.id)
      app.save(mov2)
    }

    // 2. Seed Serviços (se vazio)
    const existingServices = app.findRecordsByFilter('services', '', '', 1, 0)
    let s1, s2, s3
    if (existingServices.length === 0) {
      s1 = new Record(servicesCol)
      s1.set('name', 'Implantação e Parametrização Fiscal')
      s1.set('description', 'Configuração de regras tributárias, NFe/NFSe e alíquotas.')
      s1.set('price', 3200)
      s1.set('duration_minutes', 480)
      s1.set('category', 'Implantação')
      s1.set('iss_rate', 5)
      s1.set('active', true)
      if (ownerUser) s1.set('created_by', ownerUser.id)
      app.save(s1)

      s2 = new Record(servicesCol)
      s2.set('name', 'Treinamento de Equipe Operacional')
      s2.set('description', 'Capacitação completa dos operadores e supervisores no CRM.')
      s2.set('price', 1500)
      s2.set('duration_minutes', 240)
      s2.set('category', 'Treinamento & Consultoria')
      s2.set('iss_rate', 2)
      s2.set('active', true)
      if (ownerUser) s2.set('created_by', ownerUser.id)
      app.save(s2)

      s3 = new Record(servicesCol)
      s3.set('name', 'Suporte Técnico Mensal & Manutenção')
      s3.set('description', 'Atendimento prioritário com SLA de 2 horas e backups diários.')
      s3.set('price', 890)
      s3.set('duration_minutes', 60)
      s3.set('category', 'Suporte & Manutenção')
      s3.set('iss_rate', 3)
      s3.set('active', true)
      if (ownerUser) s3.set('created_by', ownerUser.id)
      app.save(s3)
    }

    // 3. Seed Configurações Fiscais (se vazio)
    const existingFiscalSettings = app.findRecordsByFilter('fiscal_settings', '', '', 1, 0)
    if (existingFiscalSettings.length === 0) {
      const fSet = new Record(fiscalSettingsCol)
      fSet.set('provider', 'focus_nfe')
      fSet.set('api_token', '') // Sem credencial inicial para fluxo "pronto para conectar"
      fSet.set('environment', 'homologation')
      fSet.set('nfe_series', '1')
      fSet.set('nfse_series', '1')
      fSet.set('cnpj', '12.345.678/0001-90')
      fSet.set('state_registration', '112.233.444.555')
      fSet.set('municipal_registration', '987654-3')
      fSet.set('tax_regime', 'simples_nacional')
      fSet.set(
        'certificate_info',
        'Necessário conectar certificado A1 (e-CNPJ) e token de provedor fiscal para emissão junto à SEFAZ/Prefeitura.',
      )
      app.save(fSet)
    }

    // 4. Se houver deals e clients, adicionar itens de exemplo e uma nota fiscal pendente
    try {
      const deals = app.findRecordsByFilter('deals', '', '', 2, 0)
      const clients = app.findRecordsByFilter('clients', '', '', 1, 0)

      if (deals.length > 0 && p1 && s1) {
        const deal = deals[0]
        const existingItems = app.findRecordsByFilter(
          'deal_items',
          `deal_id = "${deal.id}"`,
          '',
          1,
          0,
        )
        if (existingItems.length === 0) {
          const item1 = new Record(dealItemsCol)
          item1.set('deal_id', deal.id)
          item1.set('item_type', 'product')
          item1.set('product_id', p1.id)
          item1.set('name_snapshot', p1.getString('name'))
          item1.set('quantity', 2)
          item1.set('unit_price', 1450)
          item1.set('total_price', 2900)
          app.save(item1)

          const item2 = new Record(dealItemsCol)
          item2.set('deal_id', deal.id)
          item2.set('item_type', 'service')
          item2.set('service_id', s1.id)
          item2.set('name_snapshot', s1.getString('name'))
          item2.set('quantity', 3)
          item2.set('unit_price', 3200)
          item2.set('total_price', 9600)
          app.save(item2)
        }
      }

      // Adicionar uma nota fiscal de exemplo pendente para visualização imediata
      const existingDocs = app.findRecordsByFilter('fiscal_documents', '', '', 1, 0)
      if (existingDocs.length === 0 && deals.length > 0 && clients.length > 0) {
        const fDoc = new Record(fiscalDocsCol)
        fDoc.set('doc_type', 'NFE')
        fDoc.set('deal_id', deals[0].id)
        fDoc.set('client_id', clients[0].id)
        fDoc.set('nature_operation', 'Venda de mercadorias e licenças')
        fDoc.set('total_amount', 12500)
        fDoc.set('status', 'to_transmit')
        fDoc.set('number', '000101')
        fDoc.set('series', '1')
        fDoc.set(
          'provider_message',
          'Documento pronto para transmissão. Aguardando configuração de credenciais da SEFAZ e certificado A1.',
        )
        fDoc.set('issue_date', '2025-05-10')
        if (ownerUser) fDoc.set('created_by', ownerUser.id)
        app.save(fDoc)

        const fDoc2 = new Record(fiscalDocsCol)
        fDoc2.set('doc_type', 'NFSE')
        fDoc2.set('deal_id', deals[0].id)
        fDoc2.set('client_id', clients[0].id)
        fDoc2.set('nature_operation', 'Prestação de serviços de implantação de software')
        fDoc2.set('total_amount', 3200)
        fDoc2.set('status', 'pending')
        fDoc2.set('number', '000045')
        fDoc2.set('series', 'E')
        fDoc2.set(
          'provider_message',
          'RPS gerado no sistema. Conecte o provedor de NFS-e municipal para envio e autorização da prefeitura.',
        )
        fDoc2.set('issue_date', '2025-05-12')
        if (ownerUser) fDoc2.set('created_by', ownerUser.id)
        app.save(fDoc2)
      }
    } catch (_) {}
  },
  (app) => {},
)
