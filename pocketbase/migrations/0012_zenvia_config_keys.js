migrate(
  (app) => {
    // Integração Zenvia: novas chaves de configuração na coleção
    // whatsapp_templates (mesmo padrão key/body das demais), editáveis em
    // Configurações > Mensagens Automáticas > Integração Zenvia.
    // O envio só usa a Zenvia quando AMBAS estiverem preenchidas; caso
    // contrário o hook mantém o fluxo atual via conector Skip WhatsApp.
    const col = app.findCollectionByNameOrId('whatsapp_templates')
    const field = col.fields.getByName('key')
    const current = field.values || []
    const next = []
    for (let i = 0; i < current.length; i++) next.push(String(current[i]))
    for (const key of ['zenvia_api_token', 'zenvia_sender']) {
      if (next.indexOf(key) === -1) next.push(key)
    }
    field.values = next
    app.save(col)
  },
  (app) => {
    // Reverte: remove as chaves da Zenvia do select (só quando nenhum
    // registro as utiliza).
    const inUse = app.findRecordsByFilter(
      'whatsapp_templates',
      "key = 'zenvia_api_token' || key = 'zenvia_sender'",
      '',
      1,
      0,
    )
    if (inUse.length > 0) return
    const col = app.findCollectionByNameOrId('whatsapp_templates')
    const field = col.fields.getByName('key')
    const current = field.values || []
    const next = []
    for (let i = 0; i < current.length; i++) {
      const s = String(current[i])
      if (s !== 'zenvia_api_token' && s !== 'zenvia_sender') next.push(s)
    }
    field.values = next
    app.save(col)
  },
)
