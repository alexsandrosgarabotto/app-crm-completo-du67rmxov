migrate(
  (app) => {
    // Campo msg_type em whatsapp_messages: tipo da mídia recebida
    // (audio/image/video/document/location/contacts/order). Usado pelo
    // circuit-breaker POR TIPO do aviso de "mídia sem texto": um aviso enviado
    // para um documento não pode mais consumir o cooldown de um ÁUDIO real
    // (bug 18/11 v2 — o áudio real das 13:22 ficou mudo porque o aviso das
    // 13:21 consumiu o breaker global de 30 min).
    const col = app.findCollectionByNameOrId('whatsapp_messages')
    if (!col.fields.getByName('msg_type')) {
      col.fields.add(new TextField({ name: 'msg_type', max: 40 }))
    }
    // Índice do circuit-breaker: outbound por conversa + tipo + texto (o filtro
    // do breaker roda a cada mídia recebida).
    const indexes = []
    col.indexes.forEach((idx) => {
      if (idx.indexOf('idx_wa_msg_breaker') === -1) indexes.push(idx)
    })
    indexes.push(
      'CREATE INDEX idx_wa_msg_breaker ON whatsapp_messages (conversation_id, direction, msg_type, created)',
    )
    col.indexes = indexes
    app.save(col)
  },
  (app) => {
    // down: o campo é aditivo e inofensivo; mantê-lo na reversão evita
    // depender de APIs de remoção de campos do JSVM.
  },
)
