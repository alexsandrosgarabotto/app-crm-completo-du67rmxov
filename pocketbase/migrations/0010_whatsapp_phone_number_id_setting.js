migrate(
  (app) => {
    // Phone Number ID do WhatsApp (Meta Cloud API) guardado na mesma coleção
    // de configurações do WhatsApp (whatsapp_templates), editável em Configurações.
    const templates = app.findCollectionByNameOrId('whatsapp_templates')
    const keyField = templates.fields.getByName('key')
    if (keyField && !keyField.values.includes('phone_number_id')) {
      keyField.values = [...keyField.values, 'phone_number_id']
      app.save(templates)
    }

    // Seed idempotente: grava o valor inicial somente se o campo estiver vazio.
    const found = app.findRecordsByFilter('whatsapp_templates', "key = 'phone_number_id'", '', 1, 0)
    if (found.length === 0) {
      const record = new Record(templates)
      record.set('key', 'phone_number_id')
      record.set('body', '1433277493204874')
      record.set('active', true)
      app.save(record)
    } else if (!String(found[0].get('body') || '').trim()) {
      found[0].set('body', '1433277493204874')
      app.save(found[0])
    }
  },
  (app) => {
    // Não remove o seed nem a opção do select: dados de configuração são preservados.
  },
)
