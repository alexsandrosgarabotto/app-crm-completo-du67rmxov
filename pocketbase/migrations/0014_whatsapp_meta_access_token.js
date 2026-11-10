migrate(
  (app) => {
    // Token de acesso da Meta (gerado em developers.facebook.com > WhatsApp >
    // API Setup > "Gerar token de acesso"), guardado na mesma coleção de
    // configurações do WhatsApp (whatsapp_templates), editável em Configurações.
    // Usado pelo envio direto via Graph API (sem passar pelo conector Skip).
    const templates = app.findCollectionByNameOrId('whatsapp_templates')
    const keyField = templates.fields.getByName('key')
    if (keyField && !keyField.values.includes('meta_access_token')) {
      keyField.values = [...keyField.values, 'meta_access_token']
      app.save(templates)
    }

    // Seed idempotente: grava o valor inicial somente se a key não existir,
    // para nunca sobrescrever uma edição feita pelo usuário nas Configurações.
    const found = app.findRecordsByFilter(
      'whatsapp_templates',
      "key = 'meta_access_token'",
      '',
      1,
      0,
    )
    if (found.length === 0) {
      const record = new Record(templates)
      record.set('key', 'meta_access_token')
      record.set(
        'body',
        'EAAXWZCW00IOsBS3jRXftm3RDRDj0ZBU032zNUxcCKZAYbS4ZA5ZAmufNEYzUaQHY6HpxOvK4oPTWnZCPtPrLTWWcSlzxBIDhPHOlMYZBB5NC23MvZCFtqDT6icX8j333IXhPbLHEahDZB1CRJ51Up7nRXqZA60QeXbttCQQKt9ZAL1jKJ9Ie9bJlmzmHRBi9ZA7WdacD42z1NRafrD2NeNjL6Yd6iNtDTQD1ZBKJZCekfXDvK0Jra5A6Y7wMsDa7rxIx7QhxMMzUwftraXDrloFFA3pX8wFjoG',
      )
      record.set('active', true)
      app.save(record)
    }
  },
  (app) => {
    // Não remove o seed nem a opção do select: dados de configuração são preservados.
  },
)
