/// <reference path="../pb_data/types.d.ts" />

/**
 * Relatório fotográfico e assinatura do cliente na Ordem de Serviço.
 * --------------------------------------------------------
 * - photos: várias imagens do serviço (upload real, arquivos no storage do backend).
 * - signature: imagem PNG da assinatura do cliente (uma por OS).
 *
 * Idempotente: só adiciona os campos se ainda não existirem.
 */
migrate(
  (app) => {
    const orders = app.findCollectionByNameOrId('service_orders')
    let changed = false
    if (!orders.fields.getByName('photos')) {
      orders.fields.add(
        new FileField({
          name: 'photos',
          maxSelect: 50,
          maxSize: 10485760,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        }),
      )
      changed = true
    }
    if (!orders.fields.getByName('signature')) {
      orders.fields.add(
        new FileField({
          name: 'signature',
          maxSelect: 1,
          maxSize: 2097152,
          mimeTypes: ['image/png'],
        }),
      )
      changed = true
    }
    if (changed) {
      app.save(orders)
    }
  },
  (app) => {
    // Mantém os campos: remover apagaria as fotos e assinaturas já coletadas.
  },
)
