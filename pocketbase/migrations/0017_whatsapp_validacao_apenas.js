/// <reference path="../pb_data/types.d.ts" />

/**
 * Modo de validação do atendimento automático de WhatsApp.
 * --------------------------------------------------------
 * Durante a fase de validação, só o número de teste autorizado recebe as
 * respostas automáticas (saudação + menu e as respostas das opções 1-4).
 * Mensagens de qualquer outro número continuam sendo gravadas normalmente no
 * CRM (cliente, conversa, mensagem inbound), mas NÃO recebem resposta
 * automática nenhuma — ficam para o atendente responder manualmente.
 *
 * Configuração na coleção whatsapp_templates (editável em Configurações):
 * - key 'validacao_apenas': 'true' (padrão, validação LIGADO) ou 'false';
 * - key 'validacao_numero': número autorizado, só dígitos (5566999830114).
 *
 * Desligar o interruptor nas Configurações ('false') abre o atendimento
 * automático ao público geral.
 */
migrate(
  (app) => {
    const templates = app.findCollectionByNameOrId('whatsapp_templates')
    const keyField = templates.fields.getByName('key')

    // Adiciona as duas keys ao select 'key' (idempotente).
    let changed = false
    if (keyField) {
      if (!keyField.values.includes('validacao_apenas')) {
        keyField.values = [...keyField.values, 'validacao_apenas']
        changed = true
      }
      if (!keyField.values.includes('validacao_numero')) {
        keyField.values = [...keyField.values, 'validacao_numero']
        changed = true
      }
      if (changed) {
        app.save(templates)
      }
    }

    // Seed idempotente: grava o valor inicial somente se a key não existir,
    // para nunca sobrescrever uma edição feita pelo usuário nas Configurações.
    const seed = (key, body) => {
      const found = app.findRecordsByFilter('whatsapp_templates', "key = '" + key + "'", '', 1, 0)
      if (found.length === 0) {
        const record = new Record(templates)
        record.set('key', key)
        record.set('body', body)
        record.set('active', true)
        app.save(record)
        console.log('[migracao 0017] seed criado:', key, '=', body)
      }
    }
    seed('validacao_apenas', 'true')
    seed('validacao_numero', '5566999830114')
  },
  (app) => {
    // Não remove o seed nem as opções do select: dados de configuração são preservados.
  },
)
