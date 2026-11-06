migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId('_pb_users_auth_')
    const clientsCollection = app.findCollectionByNameOrId('clients')

    // Regra comum: qualquer usuário autenticado do CRM enxerga os atendimentos
    // (mesmo padrão das demais coleções do CRM, sem isolamento por vendedor).
    const authed = "@request.auth.id != ''"

    // 1. Conversas de WhatsApp
    const conversations = new Collection({
      name: 'whatsapp_conversations',
      type: 'base',
      listRule: authed,
      viewRule: authed,
      createRule: authed,
      updateRule: authed,
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'owner'",
      fields: [
        {
          name: 'client_id',
          type: 'relation',
          collectionId: clientsCollection.id,
          cascadeDelete: true,
          maxSelect: 1,
          required: true,
        },
        { name: 'contact_name', type: 'text', required: false },
        { name: 'phone', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          values: ['aberto', 'em_atendimento', 'finalizado'],
          maxSelect: 1,
          required: true,
        },
        {
          name: 'assigned_to',
          type: 'relation',
          collectionId: usersCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        },
        { name: 'last_message', type: 'text', required: false },
        { name: 'last_message_at', type: 'date', required: false },
        { name: 'last_inbound_at', type: 'date', required: false },
        { name: 'unread_count', type: 'number', required: false, min: 0 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_wa_conv_phone ON whatsapp_conversations (phone)',
        'CREATE INDEX idx_wa_conv_client ON whatsapp_conversations (client_id)',
        'CREATE INDEX idx_wa_conv_status ON whatsapp_conversations (status)',
      ],
    })
    app.save(conversations)

    // 2. Mensagens de WhatsApp
    const messages = new Collection({
      name: 'whatsapp_messages',
      type: 'base',
      listRule: authed,
      viewRule: authed,
      createRule: authed,
      updateRule: authed,
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'owner'",
      fields: [
        {
          name: 'conversation_id',
          type: 'relation',
          collectionId: conversations.id,
          cascadeDelete: true,
          maxSelect: 1,
          required: true,
        },
        {
          name: 'direction',
          type: 'select',
          values: ['inbound', 'outbound'],
          maxSelect: 1,
          required: true,
        },
        {
          name: 'origin',
          type: 'select',
          values: ['auto', 'manual'],
          maxSelect: 1,
          required: true,
        },
        { name: 'body', type: 'text', required: true },
        { name: 'external_id', type: 'text', required: false },
        {
          name: 'sent_by',
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
        'CREATE INDEX idx_wa_msg_conversation ON whatsapp_messages (conversation_id)',
        'CREATE INDEX idx_wa_msg_external ON whatsapp_messages (external_id)',
      ],
    })
    app.save(messages)
  },
  (app) => {
    for (const name of ['whatsapp_messages', 'whatsapp_conversations']) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }
  },
)
