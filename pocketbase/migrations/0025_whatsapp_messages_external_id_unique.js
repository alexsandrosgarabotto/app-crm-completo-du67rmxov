/// Idempotência do webhook da Meta: a Cloud API reentrega o mesmo evento
/// (mesmo message id) — a checagem do hook é apenas de aplicação e duas
/// entregas simultâneas passam juntas, respondendo DUAS VEZES ao cliente
/// (o "erro de notificação aleatória": duas respostas idênticas às 11:17 e
/// 11:32). O índice UNIQUE abaixo faz o segundo INSERT falhar no próprio
/// banco; o hook trata esse erro ignorando a entrega.
migrate(
  (app) => {
    const messages = app.findCollectionByNameOrId('whatsapp_messages')
    const indexes = []
    messages.indexes.forEach((idx) => {
      if (idx.indexOf('idx_wa_msg_external') === -1) indexes.push(idx)
    })
    indexes.push(
      "CREATE UNIQUE INDEX idx_wa_msg_external_unique ON whatsapp_messages (external_id) WHERE external_id != ''",
    )
    messages.indexes = indexes
    app.save(messages)
  },
  (app) => {
    const messages = app.findCollectionByNameOrId('whatsapp_messages')
    const indexes = []
    messages.indexes.forEach((idx) => {
      if (idx.indexOf('idx_wa_msg_external_unique') === -1) indexes.push(idx)
    })
    indexes.push('CREATE INDEX idx_wa_msg_external ON whatsapp_messages (external_id)')
    messages.indexes = indexes
    app.save(messages)
  },
)
