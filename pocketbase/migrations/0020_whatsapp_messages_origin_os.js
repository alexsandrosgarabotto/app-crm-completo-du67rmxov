/// <reference path="../pb_data/types.d.ts" />

/**
 * Aviso de WhatsApp da OS gravado na conversa precisa de origem própria
 * (select 'os' em whatsapp_messages.origin). Sem isso, o PocketBase rejeita
 * a gravação da mensagem outbound com "não corresponde aos valores permitidos"
 * e o aviso nunca aparece na conversa do cliente.
 *
 * Idempotente: só adiciona o valor se ainda não existir.
 */
migrate(
  (app) => {
    const messages = app.findCollectionByNameOrId('whatsapp_messages')
    const field = messages.fields.getByName('origin')
    if (!field) {
      throw new Error("campo 'origin' não encontrado em whatsapp_messages")
    }
    const values = field.values || []
    if (values.indexOf('os') !== -1) {
      return
    }
    field.values = values.concat(['os'])
    app.save(messages)
  },
  (app) => {
    // Mantém o valor 'os': apagar quebraria o aviso de OS já em operação.
  },
)
