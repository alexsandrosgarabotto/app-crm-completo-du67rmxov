/// <reference path="../pb_data/types.d.ts" />

/**
 * service_orders: campos de agendamento estruturado do bot de WhatsApp.
 * -----------------------------------------------------------------
 * O hook de agendamento conversacional (whatsapp.pb.js) grava
 * scheduled_date ('2025-11-24') e scheduled_time ('08:00') na OS, mas a
 * coleção só tinha o campo agendamento_para (date) — os valores eram
 * descartados silenciosamente e a OS nascia sem agenda. Esta migração cria
 * os dois campos de texto usados pelo bot e pelo painel de Agenda.
 */
migrate(
  (app) => {
    const orders = app.findCollectionByNameOrId('service_orders')
    let changed = false
    if (!orders.fields.getByName('scheduled_date')) {
      orders.fields.add(new TextField({ name: 'scheduled_date', max: 10 }))
      changed = true
    }
    if (!orders.fields.getByName('scheduled_time')) {
      orders.fields.add(new TextField({ name: 'scheduled_time', max: 5 }))
      changed = true
    }
    if (changed) {
      app.save(orders)
    }
  },
  (app) => {
    // Reversão: mantém os dados.
  },
)
