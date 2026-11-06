/// <reference path="../pb_data/types.d.ts" />

/**
 * Automação de WhatsApp Business
 * --------------------------------
 * 1. O WhatsApp da empresa é conectado nos conectores do builder.
 * 2. Quando chega uma mensagem de cliente, gravamos o atendimento
 *    (whatsapp_conversations / whatsapp_messages) vinculado ao cliente do CRM
 *    pelo telefone e respondemos automaticamente como atendente humano.
 * 3. Números ainda não cadastrados no CRM geram um cliente automático
 *    (status padrão igual ao dos clientes criados via UI) antes de seguir
 *    o fluxo normal.
 * 4. O atendente também pode responder manualmente pelo mesmo canal.
 *
 * Não usamos OAuth manual nem chaves de API: todo envio vai via
 * $connectors.executeAsOwner com o toolkit "whatsapp".
 *
 * IMPORTANTE: a JSVM do PocketBase roda os callbacks em um pool de VMs
 * separado — funções de top-level não são visíveis dentro dos callbacks.
 * Toda a lógica fica inline nos próprios callbacks.
 */

routerAdd(
  'POST',
  '/backend/v1/crm/whatsapp/inbound',
  (e) => {
    const app = e.app
    const body = e.requestInfo().body || {}

    const normalizePhone = (raw) => {
      let digits = String(raw || '').replace(/\D/g, '')
      if (!digits) return ''
      if (digits.startsWith('55') && digits.length > 11) {
        digits = digits.slice(2)
      }
      return digits
    }

    const rawPhone = String(
      body.phone || body.from || body.wa_id || (body.contact && body.contact.wa_id) || '',
    )
    const text = String(body.body || body.text || body.message || '')
    const externalId = String(body.external_id || body.message_id || body.id || '')
    const contactName = String(body.contact_name || body.name || body.pushname || '')

    if (!rawPhone || !text) {
      throw new BadRequestError('Campos obrigatórios ausentes: phone/from e body/text/message')
    }

    // --- Localiza o cliente do CRM pelo telefone -------------------------------
    const target = normalizePhone(rawPhone)
    const candidates = [rawPhone, '+' + target, '55' + target]
    const seen = {}
    let clientRecord = null
    for (const candidate of candidates) {
      if (!candidate || seen[candidate]) continue
      seen[candidate] = true
      try {
        const found = app.findRecordsByFilter('clients', 'phone = {:phone}', '-created', 1, 0, {
          phone: candidate,
        })
        if (found.length > 0) {
          clientRecord = found[0]
          break
        }
      } catch (_) {}
    }
    if (!clientRecord && target) {
      try {
        const all = app.findRecordsByFilter('clients', "phone != ''", '-created', 500, 0)
        for (const record of all) {
          if (normalizePhone(record.get('phone')) === target) {
            clientRecord = record
            break
          }
        }
      } catch (_) {}
    }

    if (!clientRecord && target) {
      // Cliente desconhecido: criamos o cliente automaticamente (status padrão
      // igual ao dos clientes criados via UI) e seguimos o fluxo normal.
      const digitsOnly = target
      const lastDigits = digitsOnly.slice(-4)
      let autoName = String(contactName || '').trim()
      if (!autoName) {
        autoName = 'Contato WhatsApp ' + lastDigits
      }

      // Dupla checagem de duplicidade (mesma normalização da busca acima).
      let duplicate = null
      try {
        const all = app.findRecordsByFilter('clients', "phone != ''", '-created', 500, 0)
        for (const record of all) {
          if (normalizePhone(record.get('phone')) === digitsOnly) {
            duplicate = record
            break
          }
        }
      } catch (_) {}

      if (duplicate) {
        clientRecord = duplicate
        console.log(
          '[whatsapp] cliente com telefone equivalente já existe, reutilizando:',
          duplicate.id,
        )
      } else {
        try {
          const clientsCollection = app.findCollectionByNameOrId('clients')
          clientRecord = new Record(clientsCollection)
          clientRecord.set('name', autoName)
          clientRecord.set('phone', rawPhone)
          clientRecord.set('status', 'active')
          app.save(clientRecord)
          console.log('[whatsapp] cliente criado automaticamente:', clientRecord.id, rawPhone)
        } catch (err) {
          console.log('[whatsapp] falha ao criar cliente automático:', err)
        }
      }
    }

    if (!clientRecord) {
      console.log('[whatsapp] mensagem de número não vinculado a nenhum cliente:', rawPhone)
      return e.json(200, { ok: true, ignored: 'cliente não encontrado para o telefone informado' })
    }

    // --- Encontra ou cria a conversa ------------------------------------------
    const normalized = target
    let conversation = null
    try {
      const found = app.findRecordsByFilter(
        'whatsapp_conversations',
        'client_id = {:clientId} && phone = {:phone}',
        '-created',
        1,
        0,
        { clientId: clientRecord.id, phone: rawPhone },
      )
      if (found.length > 0) conversation = found[0]
    } catch (_) {}
    if (!conversation && normalized) {
      try {
        const all = app.findRecordsByFilter(
          'whatsapp_conversations',
          'client_id = {:clientId}',
          '-created',
          50,
          0,
          { clientId: clientRecord.id },
        )
        for (const record of all) {
          if (normalizePhone(record.get('phone')) === normalized) {
            conversation = record
            break
          }
        }
      } catch (_) {}
    }
    if (conversation && conversation.get('status') === 'finalizado') {
      conversation.set('status', 'aberto')
      app.save(conversation)
    }
    if (!conversation) {
      conversation = new Record(app.findCollectionByNameOrId('whatsapp_conversations'))
      conversation.set('client_id', clientRecord.id)
      conversation.set('phone', rawPhone)
      conversation.set('contact_name', contactName || clientRecord.get('name') || '')
      conversation.set('status', 'aberto')
      conversation.set('unread_count', 0)
    }

    // --- Evita processar a mesma mensagem duas vezes --------------------------
    if (externalId) {
      try {
        const dup = app.findRecordsByFilter(
          'whatsapp_messages',
          'external_id = {:externalId}',
          '-created',
          1,
          0,
          { externalId: externalId },
        )
        if (dup.length > 0) {
          return e.json(200, { ok: true, ignored: 'mensagem duplicada' })
        }
      } catch (_) {}
    }

    // --- Registra a mensagem recebida -----------------------------------------
    const messagesCollection = app.findCollectionByNameOrId('whatsapp_messages')
    const inboundRecord = new Record(messagesCollection)
    inboundRecord.set('conversation_id', conversation.id)
    inboundRecord.set('direction', 'inbound')
    inboundRecord.set('origin', 'auto')
    inboundRecord.set('body', text)
    if (externalId) {
      inboundRecord.set('external_id', externalId)
    }
    app.save(inboundRecord)

    conversation.set('last_message', text)
    conversation.set('last_message_at', new Date().toISOString())
    conversation.set('last_inbound_at', new Date().toISOString())
    conversation.set('unread_count', (conversation.get('unread_count') || 0) + 1)
    app.save(conversation)

    // --- Resposta automática como atendente humano ----------------------------
    // Os textos vêm da coleção whatsapp_templates (editáveis em Configurações).
    // Placeholders: {{nome}}, {{nome_completo}}, {{saudacao}}, {{telefone}}
    const hour = new Date().getHours()
    let greetingWord = 'Boa noite'
    if (hour >= 5 && hour < 12) greetingWord = 'Bom dia'
    else if (hour >= 12 && hour < 18) greetingWord = 'Boa tarde'

    let templateBody = ''
    try {
      const tpl = app.findRecordsByFilter('whatsapp_templates', "key = 'greeting'", '', 1, 0)
      if (tpl.length > 0) templateBody = String(tpl[0].get('body') || '')
    } catch (_) {}
    if (!templateBody) {
      templateBody =
        '{{saudacao}}{{nome}}! Aqui é da equipe de atendimento. Recebemos sua mensagem e já estamos te respondendo. Em que podemos ajudar?'
    }

    let menuBody = ''
    try {
      const tpl = app.findRecordsByFilter('whatsapp_templates', "key = 'menu'", '', 1, 0)
      if (tpl.length > 0) menuBody = String(tpl[0].get('body') || '')
    } catch (_) {}

    const clientName = String(clientRecord.get('name') || contactName || '').trim()
    const firstName = clientName.split(' ')[0] || ''
    const digits = normalizePhone(rawPhone)
    const prettyPhone =
      digits.length >= 10
        ? '(' + digits.slice(0, 2) + ') ' + digits.slice(2, -4) + '-' + digits.slice(-4)
        : rawPhone

    const applyPlaceholders = (raw) => {
      return String(raw || '')
        .replace(/\{\{\s*saudacao\s*\}\}/g, greetingWord)
        .replace(/\{\{\s*nome_completo\s*\}\}/g, clientName || 'cliente')
        .replace(/\{\{\s*nome\s*\}\}/g, firstName ? ', ' + firstName : '')
        .replace(/\{\{\s*telefone\s*\}\}/g, prettyPhone)
    }

    const reply = applyPlaceholders(templateBody)

    try {
      const result = $connectors.executeAsOwner('whatsapp', 'send_message', {
        to: rawPhone,
        body: reply,
      })
      if (result && result.error) {
        throw new Error(result.error)
      }

      const outboundRecord = new Record(messagesCollection)
      outboundRecord.set('conversation_id', conversation.id)
      outboundRecord.set('direction', 'outbound')
      outboundRecord.set('origin', 'auto')
      outboundRecord.set('body', reply)
      app.save(outboundRecord)

      conversation.set('last_message', reply)
      conversation.set('last_message_at', new Date().toISOString())
      app.save(conversation)

      // Menu de opções logo após a saudação (se estiver configurado)
      if (menuBody) {
        const menuText = applyPlaceholders(menuBody)
        const menuResult = $connectors.executeAsOwner('whatsapp', 'send_message', {
          to: rawPhone,
          body: menuText,
        })
        if (menuResult && !menuResult.error) {
          const menuRecord = new Record(messagesCollection)
          menuRecord.set('conversation_id', conversation.id)
          menuRecord.set('direction', 'outbound')
          menuRecord.set('origin', 'auto')
          menuRecord.set('body', menuText)
          app.save(menuRecord)
        }
      }
    } catch (err) {
      console.log('[whatsapp] falha ao enviar resposta automática:', err)
    }

    return e.json(200, { ok: true, conversation_id: conversation.id })
  } /* middlewares */,
)

// ---------------------------------------------------------------
// Envio manual do atendente (a partir da tela de Atendimentos)
// ---------------------------------------------------------------
routerAdd('POST', '/backend/v1/crm/whatsapp/send', (e) => {
  const app = e.app
  const info = e.requestInfo()
  if (!info.auth) {
    throw new UnauthorizedError('Faça login no CRM para enviar mensagens')
  }

  const body = info.body || {}
  const conversationId = String(body.conversation_id || '')
  const text = String(body.body || '')
  if (!conversationId || !text) {
    throw new BadRequestError('conversation_id e body são obrigatórios')
  }

  const conversation = app.findRecordById('whatsapp_conversations', conversationId)
  const clientRecord = app.findRecordById('clients', conversation.get('client_id'))
  const phone = String(conversation.get('phone') || clientRecord.get('phone') || '')
  if (!phone) {
    throw new BadRequestError('Conversa sem telefone válido para envio')
  }

  const result = $connectors.executeAsOwner('whatsapp', 'send_message', {
    to: phone,
    body: text,
  })
  if (result && result.error) {
    throw new BadRequestError('Falha ao enviar mensagem via WhatsApp: ' + result.error)
  }

  const message = new Record(app.findCollectionByNameOrId('whatsapp_messages'))
  message.set('conversation_id', conversation.id)
  message.set('direction', 'outbound')
  message.set('origin', 'manual')
  message.set('body', text)
  message.set('sent_by', info.auth.id)
  app.save(message)

  conversation.set('last_message', text)
  conversation.set('last_message_at', new Date().toISOString())
  conversation.set('unread_count', 0)
  app.save(conversation)

  return e.json(200, { ok: true, message_id: message.id })
})
