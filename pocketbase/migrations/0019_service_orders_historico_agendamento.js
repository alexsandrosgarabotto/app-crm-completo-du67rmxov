/// <reference path="../pb_data/types.d.ts" />

/**
 * Campos da Ordem de Serviço para o ciclo completo (v0.0.36).
 * --------------------------------------------------------
 * - agendamento_para: data/hora da visita agendada ao cliente.
 * - historico: JSON com o registro de cada mudança de status
 *   [{ de, para, por, por_nome, quando, aviso_whatsapp }].
 *
 * Idempotente: só adiciona os campos se ainda não existirem.
 */
migrate(
  (app) => {
    const orders = app.findCollectionByNameOrId('service_orders')
    let changed = false
    if (!orders.fields.getByName('agendamento_para')) {
      orders.fields.add(new DateField({ name: 'agendamento_para' }))
      changed = true
    }
    if (!orders.fields.getByName('historico')) {
      orders.fields.add(new JSONField({ name: 'historico', maxSize: 2000000 }))
      changed = true
    }
    if (changed) {
      app.save(orders)
    }
  },
  (app) => {
    // Mantém os campos: remover apagaria o histórico das OS existentes.
  },
)
