// 0039 — número do gestor para notificação de novo atendimento.
//
// Toda vez que um cliente solicita um atendimento pelo bot do WhatsApp
// (opção 2 = orçamento, opção 3 = visita técnica), o número da empresa
// envia uma mensagem ao GESTOR com cliente, telefone, tipo, data/horário e
// número da OS. O destinatário fica configurável na coleção
// whatsapp_templates (key 'gestor_notify_number'), com default 66999830114.
// Editável direto no banco (Painel/Collections) — não há card na UI ainda.
//
// Padrão da 0010/0014: adiciona o valor ao select 'key' e grava o seed
// idempotente somente se a key ainda não existir (nunca sobrescreve edição).
migrate(
  (app) => {
    const templates = app.findCollectionByNameOrId('whatsapp_templates')
    const keyField = templates.fields.getByName('key')
    if (keyField && !keyField.values.includes('gestor_notify_number')) {
      keyField.values = [...keyField.values, 'gestor_notify_number']
      app.save(templates)
    }

    const found = app.findRecordsByFilter(
      'whatsapp_templates',
      "key = 'gestor_notify_number'",
      '',
      1,
      0,
    )
    if (found.length === 0) {
      const record = new Record(templates)
      record.set('key', 'gestor_notify_number')
      record.set('body', '66999830114')
      record.set('active', true)
      app.save(record)
    } else if (!String(found[0].get('body') || '').trim()) {
      found[0].set('body', '66999830114')
      app.save(found[0])
    }
    console.log('0039: config gestor_notify_number garantida (default 66999830114)')
  },
  (app) => {
    // Não remove o seed nem a opção do select: dados de configuração são preservados.
  },
)
