/// <reference path="../pb_data/types.d.ts" />

/**
 * Dados do cliente direto na Ordem de Serviço.
 * --------------------------------------------------------
 * A OS criada pelo WhatsApp (opção 2) já nasce com nome, telefone e
 * endereço do cliente — preenchidos pelo hook a partir do cadastro e da
 * mensagem de orçamento. A ficha da OS mostra e edita esses dados
 * (edição persiste no cadastro de clientes).
 *
 * Idempotente: só adiciona os campos se ainda não existirem.
 */
migrate(
  (app) => {
    const orders = app.findCollectionByNameOrId('service_orders')
    let changed = false
    if (!orders.fields.getByName('client_name')) {
      orders.fields.add(new TextField({ name: 'client_name', max: 200 }))
      changed = true
    }
    if (!orders.fields.getByName('client_phone')) {
      orders.fields.add(new TextField({ name: 'client_phone', max: 40 }))
      changed = true
    }
    if (!orders.fields.getByName('client_address')) {
      orders.fields.add(new TextField({ name: 'client_address', max: 500 }))
      changed = true
    }
    if (changed) {
      app.save(orders)
    }
  },
  (app) => {
    // Mantém os campos: removê-los apagaria dados já coletados.
  },
)
