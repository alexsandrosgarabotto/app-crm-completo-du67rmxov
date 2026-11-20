/**
 * 0030 — Meio termo da cobrança: remove o que o fluxo Stripe usava e não
 * serve mais (coleção de auditoria do webhook Stripe e app_config).
 *
 * O usuário decidiu NÃO seguir com cobrança Stripe por enquanto: a cobrança
 * é manual pelo Financeiro (marcar a conta a receber como paga lança no
 * caixa, sem Stripe, sem link de pagamento, sem WhatsApp de cobrança).
 * As coleções estão vazias (nenhuma referência restante no código).
 */
migrate(
  (app) => {
    const removeIfExists = (name) => {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch {
        // já não existe — nada a fazer
      }
    }
    removeIfExists('stripe_webhook_events')
    removeIfExists('app_config')
  },
  (app) => {
    // Reverso: recria as coleções do fluxo Stripe abandonado.
    const events = new Collection({
      name: 'stripe_webhook_events',
      type: 'base',
      fields: [
        { name: 'event_type', type: 'text' },
        { name: 'payload', type: 'json' },
        { name: 'event_id', type: 'text' },
        { name: 'processed', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_stripe_events_event ON stripe_webhook_events (event_id) WHERE event_id != ''",
      ],
    })
    app.save(events)

    const config = new Collection({
      name: 'app_config',
      type: 'base',
      fields: [
        { name: 'key', type: 'text', required: true },
        { name: 'value', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_app_config_key ON app_config (key)'],
    })
    app.save(config)
  },
)
