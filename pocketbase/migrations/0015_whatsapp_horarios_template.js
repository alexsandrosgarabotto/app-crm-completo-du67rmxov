/// <reference path="../pb_data/types.d.ts" />

/**
 * Texto fixo dos horários de atendimento usado pela opção "3" do menu
 * automático de WhatsApp. Guardado como key 'horarios' em whatsapp_templates
 * (mesma coleção das demais configurações) para ficar editável em
 * Configurações do CRM sem mexer no código do hook.
 */
migrate(
  (app) => {
    const templates = app.findCollectionByNameOrId('whatsapp_templates')
    const keyField = templates.fields.getByName('key')
    if (keyField && !keyField.values.includes('horarios')) {
      keyField.values = [...keyField.values, 'horarios']
      app.save(templates)
    }

    // Seed idempotente: grava o valor inicial somente se a key não existir,
    // para nunca sobrescrever uma edição feita pelo usuário nas Configurações.
    const found = app.findRecordsByFilter('whatsapp_templates', "key = 'horarios'", '', 1, 0)
    if (found.length === 0) {
      const record = new Record(templates)
      record.set('key', 'horarios')
      record.set(
        'body',
        'Horários de atendimento: Segunda a Sexta, 7h às 18h. Sábado, 8h às 12h. Emergências 24h pelo telefone (66) 9973-3422.',
      )
      record.set('active', true)
      app.save(record)
    }

    // Máquina de estados do menu: guarda em cada conversa a data em que a
    // saudação + menu foi enviada — assim ela sai UMA vez por conversa e as
    // mensagens seguintes são interpretadas como opções (1-4) ou texto livre.
    const conversations = app.findCollectionByNameOrId('whatsapp_conversations')
    if (!conversations.fields.getByName('menu_sent_at')) {
      conversations.fields.add(new DateField({ name: 'menu_sent_at' }))
      app.save(conversations)
    }
  },
  (app) => {
    // Não remove o seed nem a opção do select: dados de configuração são preservados.
  },
)
