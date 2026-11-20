/// <reference path="../pb_data/types.d.ts" />

/**
 * service_orders: campo de RELATÓRIO TÉCNICO.
 * -----------------------------------------------------------------
 * O técnico responsável descreve o que foi feito na OS (ficha da OS).
 * O texto vai para o PDF gerado pelo CRM e é obrigatório para a
 * finalização automática por assinatura. Migração idempotente.
 */
migrate(
  (app) => {
    const orders = app.findCollectionByNameOrId('service_orders')
    if (!orders.fields.getByName('relatorio_tecnico')) {
      orders.fields.add(new TextField({ name: 'relatorio_tecnico', max: 5000 }))
      app.save(orders)
    }
  },
  (app) => {
    // Reversão: mantém os dados.
  },
)
