//
// Migração 0029 — idempotência do webhook Stripe.
// A coleção stripe_webhook_events (criada na 0028) tinha apenas event_type/
// payload. O hook stripe.pb.js precisa de event_id (id do evento no Stripe)
// e processed para ignorar reentregas — idempotência exigida pelo Stripe.
// Aditivo: cria os campos só se ainda não existirem + índice único.
//
migrate(
  (app) => {
    const events = app.findCollectionByNameOrId('stripe_webhook_events')

    if (!events.fields.getByName('event_id')) {
      events.fields.add(new TextField({ name: 'event_id', max: 255 }))
    }
    if (!events.fields.getByName('processed')) {
      events.fields.add(new BoolField({ name: 'processed' }))
    }

    // Índice único parcial: só restringe quando event_id está preenchido.
    const indexes = (events.indexes || []).filter(
      (sql) => typeof sql === 'string' && !sql.includes('idx_stripe_events_event'),
    )
    indexes.push(
      "CREATE UNIQUE INDEX idx_stripe_events_event ON stripe_webhook_events (event_id) WHERE event_id != ''",
    )
    events.indexes = indexes

    app.save(events)
  },
  (app) => {
    // down: aditivo — nada a reverter.
  },
)
