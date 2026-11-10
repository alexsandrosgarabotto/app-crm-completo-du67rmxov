migrate(
  (app) => {
    // Remove a integração Zenvia: o envio de WhatsApp passa a usar somente a
    // Meta (conector Skip). Apaga os registros órfãos de zenvia_api_token /
    // zenvia_sender em whatsapp_templates e tira as chaves do select.
    // Idempotente: em banco sem esses registros só ajusta o select.
    const orphans = app.findRecordsByFilter(
      'whatsapp_templates',
      "key = 'zenvia_api_token' || key = 'zenvia_sender'",
      '',
      100,
      0,
    )
    for (const rec of orphans) {
      app.delete(rec)
    }

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
  (app) => {
    // Reverte: volta as chaves ao select (os registros apagados não são recriados).
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
)
