migrate(
  (app) => {
    // ---------------------------------------------------------------
    // Integração de Cobranças (Stripe) — v0.0.59
    // 1. Campos de cobrança em invoices (contas a receber):
    //    payment_provider, payment_link_url, payment_intent_id, paid_at.
    // 2. stripe_webhook_events: auditoria dos eventos brutos do webhook
    //    (só superuser lê/escreve — regras nulas).
    // 3. app_config: chave/valor para segredos do app (ex. chave secreta
    //    Stripe). Regras nulas = só superuser/hooks — a chave NUNCA é
    //    exposta ao frontend, que usa rotas /backend/v1/stripe/*.
    // ---------------------------------------------------------------

    // 1. invoices: campos da cobrança Stripe
    const invoices = app.findCollectionByNameOrId('invoices')
    if (!invoices.fields.getByName('payment_provider')) {
      invoices.fields.add(new TextField({ name: 'payment_provider', max: 20 }))
    }
    if (!invoices.fields.getByName('payment_link_url')) {
      invoices.fields.add(new TextField({ name: 'payment_link_url', max: 500 }))
    }
    if (!invoices.fields.getByName('payment_intent_id')) {
      invoices.fields.add(new TextField({ name: 'payment_intent_id', max: 120 }))
    }
    if (!invoices.fields.getByName('paid_at')) {
      invoices.fields.add(new DateField({ name: 'paid_at' }))
    }
    app.save(invoices)

    // 2. stripe_webhook_events (auditoria do webhook)
    try {
      app.findCollectionByNameOrId('stripe_webhook_events')
    } catch (_) {
      const events = new Collection({
        name: 'stripe_webhook_events',
        type: 'base',
        // Sem regras (null) = acesso apenas de superuser/hooks.
        fields: [
          { name: 'event_type', type: 'text', max: 120 },
          { name: 'payload', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true },
        ],
      })
      events.indexes = ['CREATE INDEX idx_stripe_events_type ON stripe_webhook_events (event_type)']
      app.save(events)
    }

    // 3. app_config (key/value de segredos do app)
    try {
      app.findCollectionByNameOrId('app_config')
    } catch (_) {
      const config = new Collection({
        name: 'app_config',
        type: 'base',
        // Sem regras (null) = acesso apenas de superuser/hooks.
        fields: [
          { name: 'key', type: 'text', required: true, max: 100 },
          { name: 'value', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
      config.indexes = ['CREATE UNIQUE INDEX idx_app_config_key ON app_config (key)']
      app.save(config)
    }
  },
  (app) => {
    // down: aditivo — nada a reverter.
  },
)
