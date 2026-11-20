// 0031_service_order_number_base_150.js
//
// Base da numeração de ordens de serviço em 150 (pedido do dono):
// a próxima OS criada recebe OS-0150, a seguinte OS-0151, e assim por diante.
//
// Como o número é calculado:
// - O backend (hook onRecordCreate em service_orders_whatsapp.pb.js) garante o
//   número em TODA criação (manual pelo CRM ou via bot do WhatsApp): maior
//   sufixo numérico existente + 1, com piso de OS-0150.
// - Esta migração cria o registro de configuração 'os_number_base' (padrão
//   150) usado pelo hook, tornando a base ajustável sem novo deploy.
//
// Idempotente: se a key já existe, nada é alterado. A criação do registro usa
// try/catch para convivência com conjuntos de dados que já o tenham.

migrate(
  (app) => {
    const templates = app.findCollectionByNameOrId('whatsapp_templates')

    // A key é um select com valores fixos: registra 'os_number_base' como
    // opção válida antes de gravar o registro (idempotente).
    const keyField = templates.fields.getByName('key')
    let valores = []
    try {
      const raw = keyField ? keyField.values : null
      valores = Array.isArray(raw) ? raw.slice() : JSON.parse(String(raw || '[]')) || []
    } catch (_) {}
    if (valores.indexOf('os_number_base') === -1) {
      valores.push('os_number_base')
      keyField.values = valores
      app.save(templates)
      console.log('[0031] opção os_number_base adicionada à key de whatsapp_templates')
    }

    // Já configurado? Não toca.
    const existing = app.findRecordsByFilter(
      'whatsapp_templates',
      "key = 'os_number_base'",
      '',
      1,
      0,
    )
    if (existing.length > 0) return

    const record = new Record(templates)
    record.set('key', 'os_number_base')
    record.set('body', '150')
    app.save(record)
    console.log('[0031] base da numeração de OS configurada em 150')
  },
  (app) => {
    // Reverter: remove apenas o registro desta migração.
    try {
      const records = app.findRecordsByFilter(
        'whatsapp_templates',
        "key = 'os_number_base'",
        '',
        1,
        0,
      )
      for (const record of records) app.delete(record)
    } catch (_) {}
  },
)
