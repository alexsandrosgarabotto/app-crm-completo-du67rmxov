/// <reference path="../pb_data/types.d.ts" />

/**
 * Automação de WhatsApp Business (inbound via Meta + envio via Zenvia)
 * ------------------------------------------------------------------
 * 1. ENVIO (outbound): preferência pela API REST da Zenvia
 *    (POST https://api.zenvia.com/v2/channels/whatsapp/messages, header
 *    X-API-TOKEN). As credenciais ficam na coleção whatsapp_templates:
 *    key = 'zenvia_api_token' e key = 'zenvia_sender', editáveis em
 *    Configurações > Mensagens Automáticas > Integração Zenvia.
 *    Sem a Zenvia configurada, o envio cai no fluxo anterior (conector
 *    Skip WhatsApp, toolkit "whatsapp", $connectors.executeAsOwner).
 * 2. Inbound: o webhook da Meta WhatsApp Cloud API entrega as mensagens
 *    nesta rota. O GET faz o handshake de verificação do webhook
 *    (hub.challenge) e o POST aceita tanto o payload do Cloud API
 *    (entry/changes/value/messages) quanto o formato simples {phone, text}
 *    (retrocompatível e para testes). RECEBIMENTO: não alterado.
 * 3. Números ainda não cadastrados no CRM geram um cliente automático
 *    (status padrão igual ao dos clientes criados via UI) antes de
 *    seguir o fluxo normal.
 * 4. O atendente também responde manualmente pela tela de Atendimentos.
 *
 * Outras configurações:
 * - Phone Number ID do número no Meta: coleção whatsapp_templates,
 *   key = 'phone_number_id' (usado apenas pelo fallback do conector).
 * - WHATSAPP_WEBHOOK_VERIFY_TOKEN: token de verificação do webhook
 *   (opcional; padrão "skip-crm" — precisa ser o mesmo cadastrado no Meta).
 *
 * IMPORTANTE: a JSVM do PocketBase roda os callbacks em um pool de VMs
 * separado — funções de top-level não são visíveis dentro dos callbacks.
 * Toda a lógica fica inline nos próprios callbacks.
 */

routerAdd(
  'GET',
  '/backend/v1/crm/whatsapp/inbound',
  (e) => {
    // Handshake de verificação do webhook (Meta Cloud API): GET com
    // hub.mode=subscribe, hub.verify_token e hub.challenge. Respondemos
    // com o challenge em texto puro quando o token bate.
    const q = e.requestInfo().query || {}
    const mode = String(q['hub.mode'] || '')
    const token = String(q['hub.verify_token'] || '')
    const challenge = String(q['hub.challenge'] || '')
    const expected = String($os.getenv('WHATSAPP_WEBHOOK_VERIFY_TOKEN') || 'skip-crm')

    if (mode === 'subscribe' && challenge && token === expected) {
      return e.html(200, challenge)
    }
    if (mode === 'subscribe' && challenge) {
      console.log('[whatsapp] webhook verify falhou: token inválido')
      return e.json(403, { ok: false, error: 'verify_token inválido' })
    }
    return e.json(200, { ok: true, service: 'crm-whatsapp-inbound' })
  } /* middlewares */,
)

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

    // Número no formato com código do país, só dígitos (usado pela Zenvia
    // e pelo conector Skip): ex. 5565999998888.
    const toNumber = (raw) => {
      let digits = String(raw || '').replace(/\D/g, '')
      if (digits && digits.length <= 11) {
        digits = '55' + digits
      }
      return digits
    }

    // Configurações salvas nas Configurações do CRM (coleção whatsapp_templates).
    const readConfig = (key) => {
      try {
        const cfg = app.findRecordsByFilter('whatsapp_templates', 'key = {:key}', '', 1, 0, {
          key: key,
        })
        if (cfg.length > 0) return String(cfg[0].get('body') || '').trim()
      } catch (_) {}
      return ''
    }
    const readPhoneNumberId = () => readConfig('phone_number_id')

    // Envio via API REST da Zenvia (WhatsApp usa a Cloud API da Meta por baixo).
    // Requer zenvia_api_token + zenvia_sender nas Configurações do CRM.
    const sendViaZenvia = (to, text) => {
      const apiToken = readConfig('zenvia_api_token')
      const sender = readConfig('zenvia_sender')
      if (!apiToken || !sender) {
        throw new Error('Zenvia não configurada (token/sender ausentes)')
      }

      const payload = {
        from: sender,
        to: toNumber(to),
        contents: [{ type: 'text', text: String(text) }],
      }

      const resp = $http.send({
        url: 'https://api.zenvia.com/v2/channels/whatsapp/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-TOKEN': apiToken,
        },
        body: JSON.stringify(payload),
      })

      const status = resp.status
      let responseText = ''
      try {
        responseText = String(resp.raw || resp.body || '')
      } catch (_) {
        responseText = ''
      }
      if (status < 200 || status >= 300) {
        console.log('[whatsapp] Zenvia: falhou — HTTP ' + status + ' — resposta: ' + responseText)
        throw new Error('Zenvia: falhou — HTTP ' + status + ' — ' + responseText)
      }
      console.log('[whatsapp] Zenvia: envio OK (destinatário ' + toNumber(to) + ')')
      return { status: status, response: responseText }
    }

    // Envio via conector Skip WhatsApp (fallback quando a Zenvia não está
    // configurada). Assinatura correta: executeAsOwner(acao, args) — o
    // toolkit é derivado da própria ação (prefixo WHATSAPP_).
    const sendViaConnector = (to, text) => {
      const phoneNumberId = readPhoneNumberId()
      if (!phoneNumberId) {
        throw new Error('Phone Number ID não configurado nas Configurações do CRM')
      }
      const result = $connectors.executeAsOwner('WHATSAPP_SEND_MESSAGE', {
        text: String(text),
        to_number: toNumber(to),
        phone_number_id: phoneNumberId,
      })
      if (!result || result.successful === false || (result.error && !result.data)) {
        throw new Error(
          String((result && result.error) || 'falha desconhecida no conector WhatsApp'),
        )
      }
      return result
    }

    // Se a Zenvia estiver configurada (token + sender preenchidos), envia
    // por ela; senão mantém o fluxo atual do conector Skip como fallback.
    const sendWhatsApp = (to, text) => {
      const zenviaToken = readConfig('zenvia_api_token')
      const zenviaSender = readConfig('zenvia_sender')
      if (zenviaToken && zenviaSender) {
        return sendViaZenvia(to, text)
      }
      console.log(
        '[whatsapp] Zenvia não configurada (zenvia_api_token/zenvia_sender), usando conector Skip',
      )
      return sendViaConnector(to, text)
    }

    // --- Extrai os eventos do payload ------------------------------------------
    // Formato da plataforma (Meta WhatsApp Cloud API):
    // { object, entry: [ { changes: [ { value: { contacts, messages, statuses } } ] } ] }
    // Formato simples (retrocompatível): { phone/from, body/text, external_id }
    let events = []
    if (Array.isArray(body.entry)) {
      for (const entry of body.entry || []) {
        for (const change of (entry && entry.changes) || []) {
          const value = (change && change.value) || {}
          const contact = (value.contacts && value.contacts[0]) || {}
          const contactName = String(
            (contact.profile && contact.profile.name) || contact.wa_id || '',
          )
          for (const msg of value.messages || []) {
            const text = String(
              (msg.text && msg.text.body) ||
                msg.caption ||
                (msg.button && msg.button.text) ||
                (msg.interactive &&
                  ((msg.interactive.button_reply && msg.interactive.button_reply.text) ||
                    (msg.interactive.list_reply && msg.interactive.list_reply.title))) ||
                '',
            )
            if (!text) continue // mídia sem legenda etc.: sem texto para registrar
            events.push({
              phone: String(msg.from || ''),
              text: text,
              externalId: String(msg.id || ''),
              contactName: contactName,
            })
          }
          // Callbacks de status (sent/delivered/read) não abrem atendimento.
          if ((value.statuses || []).length > 0 && events.length === 0) {
            return e.json(200, { ok: true, ignored: 'status update' })
          }
        }
      }
    } else {
      events.push({
        phone: String(
          body.phone || body.from || body.wa_id || (body.contact && body.contact.wa_id) || '',
        ),
        text: String(body.body || body.text || body.message || ''),
        externalId: String(body.external_id || body.message_id || body.id || ''),
        contactName: String(body.contact_name || body.name || body.pushname || ''),
      })
    }

    if (events.length === 0) {
      throw new BadRequestError('Payload sem mensagens para processar')
    }

    const results = []

    for (const ev of events) {
      // ---- Processamento inline (JSVM não expõe funções top-level) ----
      try {
        const rawPhone = String(ev.phone || '')
        const text = String(ev.text || '')
        const externalId = String(ev.externalId || '')
        const contactName = String(ev.contactName || '')

        if (!rawPhone || !text) {
          results.push({ ok: false, error: 'mensagem sem remetente ou texto' })
          continue
        }

        // Localiza o cliente do CRM pelo telefone (ou cria automaticamente).
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
          // Cliente desconhecido: cria o cliente automaticamente (status padrão
          // igual ao dos clientes criados via UI) e segue o fluxo normal.
          const lastDigits = target.slice(-4)
          let autoName = contactName.trim()
          if (!autoName) {
            autoName = 'Contato WhatsApp ' + lastDigits
          }

          // Dupla checagem de duplicidade (mesma normalização da busca acima).
          let duplicate = null
          try {
            const all = app.findRecordsByFilter('clients', "phone != ''", '-created', 500, 0)
            for (const record of all) {
              if (normalizePhone(record.get('phone')) === target) {
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
          results.push({ ok: true, ignored: 'cliente não encontrado para o telefone' })
          continue
        }

        // Encontra ou cria a conversa.
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
          // Persiste a conversa ANTES da mensagem: a mensagem precisa do id
          // real da conversa em conversation_id (senão fica "cannot be blank").
          app.save(conversation)
        }

        // Evita processar a mesma mensagem duas vezes.
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
              results.push({
                ok: true,
                ignored: 'mensagem duplicada',
                conversation_id: dup[0].get('conversation_id'),
              })
              continue
            }
          } catch (_) {}
        }

        // Registra a mensagem recebida.
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

        const nowIso = new Date().toISOString()
        conversation.set('last_message', text)
        conversation.set('last_message_at', nowIso)
        conversation.set('last_inbound_at', nowIso)
        conversation.set('unread_count', (conversation.get('unread_count') || 0) + 1)
        app.save(conversation)

        // Resposta automática como atendente humano: os textos vêm da coleção
        // whatsapp_templates (editáveis em Configurações).
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

        let sentOk = false
        let sendError = ''
        try {
          sendWhatsApp(rawPhone, reply)
          sentOk = true

          const outboundRecord = new Record(messagesCollection)
          outboundRecord.set('conversation_id', conversation.id)
          outboundRecord.set('direction', 'outbound')
          outboundRecord.set('origin', 'auto')
          outboundRecord.set('body', reply)
          app.save(outboundRecord)

          conversation.set('last_message', reply)
          conversation.set('last_message_at', new Date().toISOString())
          app.save(conversation)

          // Menu de opções logo após a saudação (se estiver configurado).
          if (menuBody) {
            const menuText = applyPlaceholders(menuBody)
            try {
              sendWhatsApp(rawPhone, menuText)
              const menuRecord = new Record(messagesCollection)
              menuRecord.set('conversation_id', conversation.id)
              menuRecord.set('direction', 'outbound')
              menuRecord.set('origin', 'auto')
              menuRecord.set('body', menuText)
              app.save(menuRecord)
            } catch (menuErr) {
              console.log('[whatsapp] falha ao enviar menu automático:', menuErr)
            }
          }
        } catch (sendErr) {
          sendError = String(sendErr)
          console.log(
            '[whatsapp] aviso: resposta automática não enviada (verifique a Integração Zenvia ou o Phone Number ID nas Configurações do CRM):',
            sendErr,
          )
        }

        results.push({
          ok: true,
          conversation_id: conversation.id,
          client_id: clientRecord.id,
          auto_reply_sent: sentOk,
          auto_reply_error: sendError,
        })
      } catch (err) {
        console.log('[whatsapp] erro ao processar mensagem inbound:', err)
        results.push({ ok: false, error: String(err) })
      }
    }

    return e.json(200, { ok: true, results })
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
  const text = String(body.body || body.text || body.message || '')
  if (!conversationId || !text) {
    throw new BadRequestError('conversation_id e body são obrigatórios')
  }

  const conversation = app.findRecordById('whatsapp_conversations', conversationId)
  let clientPhone = ''
  try {
    const clientRecord = app.findRecordById('clients', conversation.get('client_id'))
    clientPhone = String(clientRecord.get('phone') || '')
  } catch (_) {}
  const phone = String(conversation.get('phone') || clientPhone || '')
  if (!phone) {
    throw new BadRequestError('Conversa sem telefone válido para envio')
  }

  let digits = String(phone).replace(/\D/g, '')
  if (digits && digits.length <= 11) {
    digits = '55' + digits
  }

  const readConfig = (key) => {
    let value = ''
    try {
      const cfg = app.findRecordsByFilter('whatsapp_templates', 'key = {:key}', '', 1, 0, {
        key: key,
      })
      if (cfg.length > 0) value = String(cfg[0].get('body') || '').trim()
    } catch (_) {}
    return value
  }

  const zenviaToken = readConfig('zenvia_api_token')
  const zenviaSender = readConfig('zenvia_sender')
  const phoneNumberId = readConfig('phone_number_id')

  let result = null
  if (zenviaToken && zenviaSender) {
    // --- Envio via Zenvia (preferencial) ---
    const payload = {
      from: zenviaSender,
      to: digits,
      contents: [{ type: 'text', text: String(text) }],
    }
    try {
      const resp = $http.send({
        url: 'https://api.zenvia.com/v2/channels/whatsapp/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-TOKEN': zenviaToken,
        },
        body: JSON.stringify(payload),
      })
      const status = resp.status
      let responseText = ''
      try {
        responseText = String(resp.raw || resp.body || '')
      } catch (_) {
        responseText = ''
      }
      if (status < 200 || status >= 300) {
        console.log('[whatsapp] Zenvia: falhou — HTTP ' + status + ' — resposta: ' + responseText)
        throw new Error('HTTP ' + status + ' — ' + responseText)
      }
      console.log('[whatsapp] Zenvia: envio OK (destinatário ' + digits + ')')
      result = { status: status }
    } catch (err) {
      throw new BadRequestError('Falha ao enviar mensagem via Zenvia: ' + err)
    }
  } else {
    // --- Fallback: conector Skip WhatsApp ---
    console.log(
      '[whatsapp] Zenvia não configurada (zenvia_api_token/zenvia_sender), usando conector Skip',
    )
    if (!phoneNumberId) {
      throw new BadRequestError('Phone Number ID não configurado nas Configurações do CRM')
    }
    try {
      result = $connectors.executeAsOwner('WHATSAPP_SEND_MESSAGE', {
        text: String(text),
        to_number: digits,
        phone_number_id: phoneNumberId,
      })
    } catch (err) {
      throw new BadRequestError('Falha ao enviar mensagem via WhatsApp: ' + err)
    }
    if (!result || result.successful === false || (result.error && !result.data)) {
      throw new BadRequestError(
        'Falha ao enviar mensagem via WhatsApp: ' +
          String((result && result.error) || 'erro desconhecido no conector'),
      )
    }
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

  return e.json(200, {
    ok: true,
    message_id: message.id,
    channel: zenviaToken && zenviaSender ? 'zenvia' : 'skip-connector',
  })
})
