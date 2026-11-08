migrate(
  (app) => {
    // Troca do Phone Number ID do WhatsApp do número de TESTE da Meta para o
    // número OFICIAL da empresa (+55 66 9973-3422), conforme exibido no painel
    // da Meta Business. Editável em Configurações > Mensagens Automáticas.
    const found = app.findRecordsByFilter('whatsapp_templates', "key = 'phone_number_id'", '', 1, 0)
    if (found.length === 0) {
      const templates = app.findCollectionByNameOrId('whatsapp_templates')
      const record = new Record(templates)
      record.set('key', 'phone_number_id')
      record.set('body', '890703801638329')
      record.set('active', true)
      app.save(record)
    } else if (String(found[0].get('body') || '').trim() !== '890703801638329') {
      found[0].set('body', '890703801638329')
      app.save(found[0])
    }
  },
  (app) => {
    // Reverte para o número de teste anterior (dados de configuração).
    const found = app.findRecordsByFilter('whatsapp_templates', "key = 'phone_number_id'", '', 1, 0)
    if (found.length > 0 && String(found[0].get('body') || '').trim() !== '1433277493204874') {
      found[0].set('body', '1433277493204874')
      app.save(found[0])
    }
  },
)
