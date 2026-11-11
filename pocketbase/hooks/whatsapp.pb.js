/// <reference path="../pb_data/types.d.ts" />

/**
 * Automação de WhatsApp Business (inbound via Meta + envio via Meta)
 * ------------------------------------------------------------------
 * 1. ENVIO (outbound): ÚNICO CANAL = META.
 *    - Caminho primário: Graph API da Meta diretamente ($http.send,
 *      POST https://graph.facebook.com/v25.0/{phoneNumberId}/messages),
 *      usado quando existe um token próprio configurado (key
 *      'meta_access_token' em whatsapp_templates — gerado em
 *      developers.facebook.com > WhatsApp > API Setup).
 *    - Fallback (sem token configurado): conector Skip WhatsApp
 *      (toolkit "whatsapp", $connectors.executeAsOwner
 *      'WHATSAPP_SEND_MESSAGE').
 *    Se o envio falhar, o erro é apenas registrado nos logs (rota de
 *    resposta automática) ou devolvido ao atendente (rota /send).
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
 *   key = 'phone_number_id' (usado pelo canal primário da Meta).
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

    // Compara dois números brasileiros cobrindo a variação do nono dígito:
    // a Meta entrega o MESMO celular às vezes como 55+DDD+8 dígitos (12 no
    // total, ex. 556699830114) e às vezes como 55+DDD+9 dígitos (13, ex.
    // 5566999830114). Depois de normalizePhone (sem DDI), o 9 extra fica no
    // MEIO (6699830114 vs 66999830114), então endsWith sozinho não cobre.
    // Critério: mesmo DDD (2 primeiros dígitos) + mesmos últimos 8 dígitos
    // (parte local sem o nono dígito), exigindo pelo menos 10 dígitos em cada
    // lado para evitar falsos positivos com números curtos/truncados.
    const samePhone = (a, b) => {
      const da = String(a || '')
      const db = String(b || '')
      if (!da || !db) return false
      if (da === db) return true
      if (da.length < 10 || db.length < 10) return false
      if (da.slice(0, 2) !== db.slice(0, 2)) return false
      return da.slice(-8) === db.slice(-8)
    }

    // Número no formato com código do país, só dígitos (usado pelo
    // conector Skip): ex. 5565999998888.
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
    const readMetaAccessToken = () => readConfig('meta_access_token')

    // Token identificado nos logs só pelos 4 últimos caracteres (nunca o valor
    // completo, que dá acesso à conta de WhatsApp Business da empresa).
    const maskToken = (token) => {
      const t = String(token || '')
      return t.length > 4 ? '...' + t.slice(-4) : '***'
    }

    // Envio via conector Skip WhatsApp (fallback, sem token próprio).
    // Assinatura correta: executeAsOwner(acao, args) — o
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

    // Envio direto pela Graph API da Meta usando o token próprio da empresa
    // (key 'meta_access_token' em whatsapp_templates). Mesmo payload de texto
    // do conector: messaging_product "whatsapp", to, type "text", text.body.
    const sendViaMetaGraphApi = (to, text) => {
      const phoneNumberId = readPhoneNumberId()
      const accessToken = readMetaAccessToken()
      if (!phoneNumberId) {
        throw new Error('Phone Number ID não configurado nas Configurações do CRM')
      }
      if (!accessToken) {
        throw new Error('Token de acesso Meta não configurado nas Configurações do CRM')
      }
      const url = 'https://graph.facebook.com/v25.0/' + phoneNumberId + '/messages'
      const payload = {
        messaging_product: 'whatsapp',
        to: toNumber(to),
        type: 'text',
        text: { body: String(text) },
      }
      const res = $http.send({
        url: url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + accessToken,
        },
        body: JSON.stringify(payload),
      })
      // $http.send devolve { statusCode, raw, json, body (bytes), headers }.
      // Sucesso: 2xx com o formato de sucesso da Graph API (contém "messages").
      // res.body é um array de bytes — use res.raw (texto) para inspeção.
      const status = res.statusCode || 0
      const rawBody = String(res.raw || '')
      if (status < 200 || status >= 300 || rawBody.indexOf('"messages"') === -1) {
        throw new Error('Graph API respondeu status ' + status + ': ' + (rawBody || 'sem corpo'))
      }
      return res
    }

    // Envio pelo canal Meta: token próprio (Graph API direta) quando
    // configurado; sem token, mantém o conector Skip. Falhas são apenas
    // registradas nos logs.
    const metaFailureHint = (err) => {
      const raw = String((err && err.message) || err || '')
      // 401 / code 190 = token de acesso da Meta inválido ou expirado
      // (validade ~60 dias): o dono precisa gerar um novo token.
      if (
        raw.indexOf('status 401') !== -1 ||
        raw.indexOf('code 190') !== -1 ||
        raw.indexOf('"code":190') !== -1
      ) {
        return 'Meta falhou: token inválido ou expirado — gere um novo token (Token de acesso Meta em Configurações)'
      }
      return ''
    }

    const sendWhatsApp = (to, text) => {
      const accessToken = readMetaAccessToken()
      const via = accessToken
        ? 'token próprio (' + maskToken(accessToken) + ')'
        : 'conector Skip (fallback, sem token configurado)'
      try {
        const result = accessToken ? sendViaMetaGraphApi(to, text) : sendViaConnector(to, text)
        console.log(
          '[whatsapp] Meta: envio OK (destinatário ' + toNumber(to) + ', via ' + via + ')',
        )
        return result
      } catch (metaErr) {
        const hint = metaFailureHint(metaErr)
        if (hint) {
          console.log('[whatsapp] ' + hint + ' (via ' + via + ')')
        } else {
          console.log('[whatsapp] Meta falhou (' + metaErr + ', via ' + via + ')')
        }
        throw metaErr
      }
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
              if (samePhone(normalizePhone(record.get('phone')), target)) {
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
              if (samePhone(normalizePhone(record.get('phone')), target)) {
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
              if (samePhone(normalizePhone(record.get('phone')), normalized)) {
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

        // --- Pedido de orçamento (opção 2) -> chamado (ordem de serviço) ---------
        // A opção "2" deixa a conversa "aguardando dados do orçamento". A próxima
        // mensagem de texto livre vira um chamado em service_orders (vinculado ao
        // cliente e à conversa) e o estado é consumido, para que mensagens
        // seguintes não dupliquem o chamado. Vale para qualquer cliente que siga
        // o fluxo; o envio de respostas automáticas continua sujeito ao modo de
        // validação (abaixo), que não é alterado aqui.
        const awaitingBudgetData = conversation.get('awaiting_budget_data') === true
        const setAwaitingBudgetData = (value) => {
          conversation.set('awaiting_budget_data', value)
          app.save(conversation)
        }
        const budgetOption = /^[1-4]$/.test(text.trim()) ? text.trim() : ''
        if (budgetOption === '2') {
          // Só vale se o menu já foi apresentado (a opção 2 foi de fato respondida).
          if (String(conversation.get('menu_sent_at') || '') !== '') setAwaitingBudgetData(true)
        } else if (budgetOption) {
          if (awaitingBudgetData) setAwaitingBudgetData(false)
        } else if (awaitingBudgetData) {
          try {
            // Próximo número sequencial: maior OS-NNNN existente + 1 (varre em
            // páginas para não depender de um limite fixo).
            let maxSeq = 0
            let page = 0
            while (true) {
              const batch = app.findRecordsByFilter(
                'service_orders',
                "number != ''",
                '-created',
                500,
                page * 500,
              )
              for (const order of batch) {
                const m = /(\d+)$/.exec(String(order.get('number') || ''))
                if (m && parseInt(m[1], 10) > maxSeq) maxSeq = parseInt(m[1], 10)
              }
              if (batch.length < 500) break
              page++
            }
            const orderNumber = 'OS-' + String(maxSeq + 1).padStart(4, '0')
            const orderRecord = new Record(app.findCollectionByNameOrId('service_orders'))
            orderRecord.set('number', orderNumber)
            orderRecord.set('client_id', clientRecord.id)
            orderRecord.set('conversation_id', conversation.id)
            orderRecord.set('status', 'aberta')
            orderRecord.set('opened_at', nowIso)
            orderRecord.set('problem_description', text)
            orderRecord.set('stock_released', false)
            app.save(orderRecord)
            console.log(
              '[whatsapp] Chamado ' +
                orderNumber +
                ' aberto via WhatsApp para cliente ' +
                clientRecord.get('name') +
                ' (' +
                clientRecord.id +
                ')',
            )
            setAwaitingBudgetData(false)
          } catch (orderErr) {
            console.log('[whatsapp] falha ao abrir chamado a partir do WhatsApp:', orderErr)
          }
        }

        // --- Modo de validação ---------------------------------------------------
        // Quando 'validacao_apenas' = true, SOMENTE o número autorizado (key
        // 'validacao_numero') recebe as respostas automáticas. Mensagens de
        // qualquer outro número já foram gravadas acima (cliente, conversa e
        // mensagem inbound) e ficam para o atendente responder manualmente —
        // nem menu nem texto automático sai para elas.
        const validacaoApenas = readConfig('validacao_apenas').toLowerCase() === 'true'
        const validacaoNumero = String(readConfig('validacao_numero') || '').replace(/\D/g, '')
        let autoReplyAllowed = true
        if (validacaoApenas) {
          // Ambos normalizados sem DDI (+55) e sem formatação, cobrindo
          // variações com/sem código do país. samePhone também cobre a
          // variação do nono dígito (celular com 8 ou 9 dígitos locais):
          // 556699830114 e 5566999830114 são o MESMO contato.
          const senderDigits = normalizePhone(rawPhone)
          const allowedDigits = normalizePhone(validacaoNumero)
          const senderMatches = samePhone(senderDigits, allowedDigits)
          autoReplyAllowed = senderMatches
          if (!senderMatches) {
            console.log(
              '[whatsapp] Modo validação: mensagem de ' +
                rawPhone +
                ' registrada sem resposta automática',
            )
          }
        }

        // --- Máquina de estados do menu por conversa ---------------------------
        // A saudação + menu sai UMA vez por conversa; depois, cada mensagem do
        // cliente recebe a resposta da opção escolhida (1-4) ou fica para o
        // atendente responder manualmente (texto livre).
        const menuPresented = String(conversation.get('menu_sent_at') || '') !== ''
        const trimmed = text.trim()
        const option = /^[1-4]$/.test(trimmed) ? trimmed : ''

        // Textos da resposta automática: vem da coleção whatsapp_templates
        // (editáveis em Configurações). Placeholders: {{nome}},
        // {{nome_completo}}, {{saudacao}}, {{telefone}}
        const hour = new Date().getHours()
        let greetingWord = 'Boa noite'
        if (hour >= 5 && hour < 12) greetingWord = 'Bom dia'
        else if (hour >= 12 && hour < 18) greetingWord = 'Boa tarde'

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

        const readTemplate = (key, fallback) => {
          let body = ''
          try {
            const tpl = app.findRecordsByFilter('whatsapp_templates', 'key = {:key}', '', 1, 0, {
              key: key,
            })
            if (tpl.length > 0) body = String(tpl[0].get('body') || '').trim()
          } catch (_) {}
          return body || fallback
        }

        // Envia um texto pelo canal Meta e grava a mensagem outbound na conversa.
        const sendAutoReply = (body) => {
          sendWhatsApp(rawPhone, body)
          const outboundRecord = new Record(messagesCollection)
          outboundRecord.set('conversation_id', conversation.id)
          outboundRecord.set('direction', 'outbound')
          outboundRecord.set('origin', 'auto')
          outboundRecord.set('body', body)
          app.save(outboundRecord)
          conversation.set('last_message', body)
          conversation.set('last_message_at', new Date().toISOString())
          app.save(conversation)
        }

        // Cumprimento simples do cliente ("bom dia", "boa tarde", "olá", "oi" e
        // variações curtas tipo "Oi bom dia") REABRE o atendimento: responde de
        // novo com saudação + menu, mesmo que o menu já tenha sido apresentado
        // antes. Mensagem inbound, acionada pelo webhook — sem risco de loop.
        // Aceita mensagens curtas formadas só por palavras de cumprimento
        // ("Bom dia", "Olá", "Oi", "Oi bom dia", "Olá, tudo bem?").
        const greetingWords = new Set([
          'oi',
          'oii',
          'oiii',
          'ola',
          'olá',
          'bom',
          'boa',
          'dia',
          'tarde',
          'noite',
          'madrugada',
          'opa',
          'salve',
          'ea',
          'eae',
          'eai',
          'e',
          'aí',
          'ai',
          'tudo',
          'bem',
          'td',
          'beleza',
          'blz',
          'amigo',
          'bomdia',
        ])
        const words = trimmed
          .toLowerCase()
          .replace(/[!?.,;:]/g, ' ')
          .split(/\s+/)
          .filter(Boolean)
        const isGreeting =
          option === '' &&
          trimmed.length <= 60 &&
          words.length > 0 &&
          words.every((w) => greetingWords.has(w))

        // Envia saudação + menu (textos de whatsapp_templates) e marca o estado.
        const sendGreetingAndMenu = () => {
          const greetingText = applyPlaceholders(
            readTemplate(
              'greeting',
              '{{saudacao}}{{nome}}! Aqui é da equipe de atendimento. Recebemos sua mensagem e já estamos te respondendo. Em que podemos ajudar?',
            ),
          )
          const menuText = applyPlaceholders(
            readTemplate(
              'menu',
              'Digite o número da opção desejada:\n1 - Falar com um atendente\n2 - Solicitar um orçamento\n3 - Horários de atendimento\n4 - Outros assuntos',
            ),
          )
          sendAutoReply(greetingText)
          if (menuText) {
            sendAutoReply(menuText)
          }
          conversation.set('menu_sent_at', new Date().toISOString())
          app.save(conversation)
        }

        let sentOk = false
        let sendError = ''

        if (!autoReplyAllowed) {
          // Modo validação: remetente fora da lista de teste — nada sai.
          // A mensagem já foi gravada; fica para atendimento manual.
        } else if (isGreeting) {
          // Cumprimento do cliente (em conversa nova ou já com menu
          // apresentado): reabre o atendimento com saudação + menu.
          try {
            sendGreetingAndMenu()
            sentOk = true
            if (menuPresented) {
              console.log(
                '[whatsapp] cumprimento do cliente reabriu o atendimento — saudação + menu reenviados:',
                trimmed,
              )
            }
          } catch (sendErr) {
            sendError = String(sendErr)
            console.log(
              '[whatsapp] aviso: saudação/menu não enviados (o menu será reenviado na próxima mensagem, verifique o canal Meta nas Configurações do CRM):',
              sendErr,
            )
          }
        } else if (!menuPresented && !option) {
          // Primeira mensagem da conversa com texto livre que NÃO é
          // cumprimento: manda saudação + menu e marca o estado.
          try {
            sendGreetingAndMenu()
            sentOk = true
          } catch (sendErr) {
            sendError = String(sendErr)
            console.log(
              '[whatsapp] aviso: saudação/menu não enviados (o menu será reenviado na próxima mensagem, verifique o canal Meta nas Configurações do CRM):',
              sendErr,
            )
          }
        } else {
          // Menu já apresentado (ou o cliente já digitou uma opção): responde
          // conforme a opção, sem reenviar saudação + menu.
          const replies = {
            1: 'Obrigado{{nome}}! Um atendente já foi acionado e vai te responder em instantes. Pode descrever sua necessidade aqui mesmo.',
            2: 'Perfeito{{nome}}! Para preparar seu orçamento, me diga: qual serviço você precisa, o endereço e o melhor horário para visita?',
            3: readTemplate(
              'horarios',
              'Horários de atendimento: Segunda a Sexta, 7h às 18h. Sábado, 8h às 12h. Emergências 24h pelo telefone (66) 9973-3422.',
            ),
            4: 'Sem problemas{{nome}}! Escreva sua mensagem que nossa equipe responde assim que possível.',
          }
          const replyText = option ? applyPlaceholders(replies[option]) : ''
          if (replyText) {
            try {
              sendAutoReply(replyText)
              sentOk = true
            } catch (sendErr) {
              sendError = String(sendErr)
              console.log('[whatsapp] aviso: resposta automática da opção não enviada:', sendErr)
            }
          } else {
            console.log(
              '[whatsapp] texto livre do cliente em conversa com menu já apresentado — registrando para atendimento manual:',
              trimmed,
            )
          }
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

  // Canal único: Meta. Token próprio (Graph API direta) quando configurado
  // (key 'meta_access_token'); sem token, conector Skip. Phone Number ID
  // oficial lido das Configurações do CRM (whatsapp_templates).
  const phoneNumberId = readConfig('phone_number_id')
  const accessToken = readConfig('meta_access_token')
  const via = accessToken
    ? 'token próprio (...' + String(accessToken).slice(-4) + ')'
    : 'conector Skip (fallback, sem token configurado)'
  const metaFailureHint = (err) => {
    const raw = String((err && err.message) || err || '')
    // 401 / code 190 = token de acesso da Meta inválido ou expirado
    // (validade ~60 dias): o dono precisa gerar um novo token.
    if (
      raw.indexOf('status 401') !== -1 ||
      raw.indexOf('code 190') !== -1 ||
      raw.indexOf('"code":190') !== -1
    ) {
      return 'Meta falhou: token inválido ou expirado — gere um novo token (Token de acesso Meta em Configurações)'
    }
    return ''
  }
  try {
    if (!phoneNumberId) {
      throw new Error('Phone Number ID não configurado nas Configurações do CRM')
    }
    if (accessToken) {
      const url = 'https://graph.facebook.com/v25.0/' + phoneNumberId + '/messages'
      const payload = {
        messaging_product: 'whatsapp',
        to: digits,
        type: 'text',
        text: { body: String(text) },
      }
      const res = $http.send({
        url: url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + accessToken,
        },
        body: JSON.stringify(payload),
      })
      // $http.send devolve { statusCode, raw, json, body (bytes), headers }.
      // Sucesso: 2xx com o formato de sucesso da Graph API (contém "messages").
      // res.body é um array de bytes — use res.raw (texto) para inspeção.
      const status = res.statusCode || 0
      const rawBody = String(res.raw || '')
      if (status < 200 || status >= 300 || rawBody.indexOf('"messages"') === -1) {
        throw new Error('Graph API respondeu status ' + status + ': ' + (rawBody || 'sem corpo'))
      }
    } else {
      const result = $connectors.executeAsOwner('WHATSAPP_SEND_MESSAGE', {
        text: String(text),
        to_number: digits,
        phone_number_id: phoneNumberId,
      })
      if (!result || result.successful === false || (result.error && !result.data)) {
        throw new Error(
          String((result && result.error) || 'erro desconhecido no conector WhatsApp'),
        )
      }
    }
    console.log('[whatsapp] Meta: envio OK (destinatário ' + digits + ', via ' + via + ')')
  } catch (metaErr) {
    const hint = metaFailureHint(metaErr)
    if (hint) {
      console.log('[whatsapp] ' + hint + ' (via ' + via + ')')
      throw new BadRequestError(hint)
    }
    console.log('[whatsapp] Meta falhou (' + metaErr + ', via ' + via + ')')
    throw new BadRequestError('Falha ao enviar mensagem via Meta: ' + metaErr)
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
    channel: 'meta',
  })
})
