/// <reference path="../pb_data/types.d.ts" />

/**
 * Estado "aguardando dados do orçamento" do menu automático de WhatsApp.
 * --------------------------------------------------------
 * Quando o cliente responde "2" (solicitar orçamento), a conversa fica com
 * awaiting_budget_data = true. A próxima mensagem de texto livre vira um
 * chamado (service_orders) vinculado ao cliente e à conversa, e o estado é
 * consumido (volta para false), para não duplicar chamados.
 *
 * Idempotente: só adiciona o campo se ainda não existir.
 */
migrate(
  (app) => {
    const conversations = app.findCollectionByNameOrId('whatsapp_conversations')
    if (!conversations.fields.getByName('awaiting_budget_data')) {
      conversations.fields.add(new BoolField({ name: 'awaiting_budget_data' }))
      app.save(conversations)
    }
  },
  (app) => {
    // Mantém o campo: remover apagaria o estado das conversas em andamento.
  },
)
