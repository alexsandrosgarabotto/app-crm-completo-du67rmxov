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
    // Marcador para mensagens de mídia SEM texto (áudio, imagem, sticker,
    // documento): antes eram descartadas e a rota respondia 400 sem gravar
    // nem responder nada — silêncio total para o cliente. Agora viram um
    // evento com este marcador, são gravadas na conversa e recebem orientação
    // para reenviar em texto.
    const MEDIA_NO_TEXT = '[mídia sem texto]'
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
            if (!text) {
              // Mídia sem texto: registra com o marcador em vez de descartar.
              if (!String(msg.from || '')) continue
              events.push({
                phone: String(msg.from || ''),
                text: MEDIA_NO_TEXT,
                externalId: String(msg.id || ''),
                contactName: contactName,
              })
              continue
            }
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
      // Sem mensagens nem callbacks de status (ex.: webhook de teste da Meta,
      // mídia ininteligível): responde 200 — um 4xx fazia a Meta reentregar
      // em loop e nada era registrado.
      return e.json(200, { ok: true, ignored: 'nenhuma mensagem no payload' })
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
            // 'created' ascendente: se houver cadastros duplicados com o mesmo
            // telefone, o ORIGINAL vence — o duplicado criado pelo fluxo não
            // deve "roubar" a conversa (e o estado do agendamento) do cliente.
            const found = app.findRecordsByFilter('clients', 'phone = {:phone}', 'created', 1, 0, {
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
            const all = app.findRecordsByFilter('clients', "phone != ''", 'created', 500, 0)
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
        if (!conversation && normalized) {
          // Último recurso: conversa já existente pelo TELEFONE, mesmo que o
          // cliente resolvido deste inbound seja outro registro (duplicado).
          // Reaproveita a conversa — e o estado do fluxo de agendamento — em
          // vez de abrir uma conversa nova sem estado.
          try {
            const byPhone = app.findRecordsByFilter(
              'whatsapp_conversations',
              'phone = {:phone}',
              '-created',
              1,
              0,
              { phone: rawPhone },
            )
            if (byPhone.length > 0) {
              conversation = byPhone[0]
              if (String(conversation.get('client_id') || '') !== clientRecord.id) {
                conversation.set('client_id', clientRecord.id)
              }
              app.save(conversation)
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

        // --- Agendamento conversacional (opções 2 = orçamento, 3 = visita) -------
        // Opção 2 (orçamento): nome + telefone -> busca/confirmação de cadastro
        // -> slots de agenda (seg-sex, 08:00/09:00/10:00, sem sábados/domingos/
        // feriados/reservas, slots de 1h sem choque) -> criação da OS com o
        // técnico principal (primeiro technician ativo).
        // Opção 3 (visita técnica): nome completo -> telefone -> busca por nome +
        // telefone -> confirmação do cadastro OU escolha do endereço (vários
        // cadastros) OU endereço informado (não localizado) -> slots nos DOIS
        // turnos (manhã 08:00-11:00, tarde 13:30-17:30, 1h de intervalo).
        // Estado na conversa: schedule_state ('awaiting_name' |
        // 'awaiting_confirm' | 'awaiting_pick' | 'awaiting_known_confirm' |
        // 'awaiting_address' | 'awaiting_address_confirm' | 'awaiting_slot' |
        // 'awaiting_description' | 'vt_name' | 'vt_phone' | 'vt_confirm' |
        // 'vt_pick' | 'vt_address') + schedule_data (json) — migração 0023.
        // A OS SÓ é aberta depois do ENDEREÇO do atendimento confirmado pelo
        // cliente (pedido do dono: o endereço é o dado mais importante).
        // Depois do slot escolhido, o bot pede a DESCRIÇÃO do serviço em
        // texto livre ('awaiting_description') e só então abre a OS,
        // confirmando ao cliente o NÚMERO da OS e a data com horário.
        // Manhã das 08:00 às 11:00 (inclui 11:00) e tarde das 13:30 às 17:30,
        // com 1h de intervalo entre atendimentos — idêntico para orçamento e
        // visita técnica (pedido do dono: "faltaram as opções do período da
        // tarde e nem das 11:00").
        const SCHEDULE_SLOTS = [
          '08:00',
          '09:00',
          '10:00',
          '11:00',
          '13:30',
          '14:30',
          '15:30',
          '16:30',
        ]
        const VISITA_SLOTS = SCHEDULE_SLOTS
        const SCHEDULE_MAX_SLOTS = 10
        const WEEKDAY_NAMES = [
          'Domingo',
          'Segunda-feira',
          'Terça-feira',
          'Quarta-feira',
          'Quinta-feira',
          'Sexta-feira',
          'Sábado',
        ]

        // Estado atual do fluxo (let: os handlers avançam/limpam o estado).
        let scheduleState = String(conversation.get('schedule_state') || '')
        let scheduleData = {}
        // O JSVM (goja) devolve o campo JSONField de record.get() como BYTES
        // crus (array de números), NUNCA como objeto/strling JS. Fazer
        // JSON.stringify nele gera "[34,123,...]" e JSON.parse devolve um
        // ARRAY — era exatamente isso que ZERAVA o estado a cada mensagem:
        // o array era descartado pelo guard !Array.isArray e scheduleData
        // voltava {}, perdendo name/phone/order_type/address/client_id e a
        // lista de slots (o cliente ficava preso no loop da lista de
        // horários). Ler com getString e reconstruir SEMPRE um objeto plano.
        const readSchedDataAsString = (raw) => {
          if (raw === undefined || raw === null) return ''
          if (typeof raw === 'string') return raw
          if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'number') {
            try {
              return String.fromCharCode.apply(null, raw)
            } catch (_) {
              return ''
            }
          }
          if (raw && typeof raw === 'object') {
            try {
              return JSON.stringify(raw)
            } catch (_) {
              return ''
            }
          }
          return ''
        }
        const asString = readSchedDataAsString(conversation.get('schedule_data'))
        if (asString && asString.trim() !== '' && asString.trim() !== 'null') {
          try {
            const parsed = JSON.parse(asString)
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              scheduleData = parsed
            }
          } catch (_) {
            scheduleData = {}
          }
        }
        // Sanitiza valores "undefined"/"null" que gravações antigas corrompidas
        // do JSONField possam ter persistido (visto em produção: nome "undefined").
        for (const k of ['name', 'phone', 'order_type', 'address', 'client_id']) {
          const v = scheduleData[k]
          if (v === undefined || v === null || String(v) === 'undefined' || String(v) === 'null') {
            scheduleData[k] = ''
          }
        }
        // Nome de exibição com fallback: NUNCA "undefined" nem vazio em texto.
        const stateName = () => {
          const n = String(scheduleData.name || '').trim()
          if (n && n !== 'undefined' && n !== 'null') return n
          const c = String(contactName || '').trim()
          if (c && c !== 'undefined') return c
          return 'cliente'
        }
        // O estado carrega os dados mínimos para criar a OS: sem eles, não dá
        // para seguir de awaiting_slot — o cliente precisa recomeçar limpo.
        const scheduleDataComplete = () => {
          const name = String(scheduleData.name || '').trim()
          const phone = String(scheduleData.phone || '').trim()
          const orderType = String(scheduleData.order_type || '').trim()
          return name !== '' && phone !== '' && orderType !== ''
        }
        const saveScheduleState = () => {
          // Stringify a partir do objeto plano reconstruído acima (nunca do
          // objeto cru do JSVM) e guarda numa variável: passar a expressão
          // direta ao set() fez o JSVM gravar "undefined" no JSONField.
          const serialized = JSON.stringify(scheduleData) || '{}'
          conversation.set('schedule_state', scheduleState)
          conversation.set('schedule_data', serialized)
          app.save(conversation)
        }
        const clearScheduleState = () => {
          scheduleState = ''
          scheduleData = {}
          conversation.set('schedule_state', '')
          conversation.set('schedule_data', '')
          app.save(conversation)
        }

        // Extrai nome + telefone de texto livre: telefone é o primeiro número
        // de 10-13 dígitos (aceita (66) 99999-0000, 66 99999-0000 etc., com ou
        // sem DDI 55); nome é o resto do texto.
        const parseNameAndPhone = (raw) => {
          const clean = String(raw || '').trim()
          let phone = ''
          let name = clean
          const m = /(\d[\d\s().\-\/]{7,}\d)/.exec(clean)
          if (m) {
            let digits = m[1].replace(/\D/g, '')
            if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2)
            if (digits.length >= 10 && digits.length <= 13) phone = digits
            name = (clean.slice(0, m.index) + ' ' + clean.slice(m.index + m[1].length))
              .replace(/[\s,;:.()\-\/]+/g, ' ')
              .trim()
          }
          if (!phone) {
            const allDigits = clean.replace(/\D/g, '')
            let d = allDigits
            if (d.startsWith('55') && d.length > 11) d = d.slice(2)
            if (d.length >= 10 && d.length <= 13) {
              phone = d
              name = clean
                .replace(/[\d\s().\-\/]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
            }
          }
          return { name: name, phone: phone }
        }

        // "Segunda-feira, 24/11 às 08:00" a partir de '2025-11-24' + '08:00'.
        const slotKeyLabel = (dateKey, time) => {
          const parts = String(dateKey || '').split('-')
          if (parts.length !== 3) return dateKey + ' ' + time
          const d = new Date(
            parseInt(parts[0], 10),
            parseInt(parts[1], 10) - 1,
            parseInt(parts[2], 10),
          )
          const weekday = WEEKDAY_NAMES[d.getDay()]
          const dd = String(d.getDate()).padStart(2, '0')
          const mm = String(d.getMonth() + 1).padStart(2, '0')
          return weekday + ', ' + dd + '/' + mm + ' às ' + time
        }

        // Bloqueios de agenda: feriados, reservas (dia inteiro ou horário) e
        // slots já ocupados por outras OS (scheduled_date + scheduled_time).
        const loadScheduleBlockers = () => {
          const holidaySet = {}
          try {
            const list = app.findRecordsByFilter('holidays', '', '', 500, 0)
            for (const h of list) {
              holidaySet[String(h.get('date') || '').slice(0, 10)] = true
            }
          } catch (_) {}
          const reservedFull = {}
          const reservedTimes = {}
          try {
            const list = app.findRecordsByFilter('schedule_reservations', '', '', 500, 0)
            for (const r of list) {
              const key = String(r.get('date') || '').slice(0, 10)
              const time = String(r.get('time') || '').trim()
              if (!key) continue
              if (time) {
                if (!reservedTimes[key]) reservedTimes[key] = {}
                reservedTimes[key][time] = true
              } else {
                reservedFull[key] = true
              }
            }
          } catch (_) {}
          const busy = {}
          try {
            const list = app.findRecordsByFilter(
              'service_orders',
              "scheduled_date != ''",
              '-created',
              500,
              0,
            )
            for (const o of list) {
              if (String(o.get('status') || '') === 'cancelada') continue
              const key = String(o.get('scheduled_date') || '').slice(0, 10)
              const time = String(o.get('scheduled_time') || '').trim()
              if (!key || !time) continue
              if (!busy[key]) busy[key] = {}
              busy[key][time] = true
            }
          } catch (_) {}
          return {
            holidaySet: holidaySet,
            reservedFull: reservedFull,
            reservedTimes: reservedTimes,
            busy: busy,
          }
        }

        // Próximos slots livres: dias úteis (seg-sex) a partir de amanhã.
        // Orçamento (padrão): horários de ponto 08:00/09:00/10:00.
        // Visita técnica (isVisita): DOIS TURNOS — manhã das 08:00 às 11:00
        // (08:00/09:00/10:00) e tarde das 13:30 às 17:30 (13:30/14:30/15:30/
        // 16:30), com 1h de intervalo entre atendimentos (cada slot é de 1h e
        // um horário ocupado/reservado não é ofertado). Sem sábados, domingos,
        // feriados (coleção holidays) e reservas de dia inteiro.
        const buildScheduleSlots = (blockers, isVisita) => {
          const slots = []
          const day = new Date()
          day.setHours(0, 0, 0, 0)
          day.setDate(day.getDate() + 1)
          for (let i = 0; i < 60 && slots.length < SCHEDULE_MAX_SLOTS; i++) {
            const dow = day.getDay()
            const key =
              day.getFullYear() +
              '-' +
              String(day.getMonth() + 1).padStart(2, '0') +
              '-' +
              String(day.getDate()).padStart(2, '0')
            day.setDate(day.getDate() + 1)
            if (dow === 0 || dow === 6) continue
            if (blockers.holidaySet[key]) continue
            if (blockers.reservedFull[key]) continue
            const daySlots = isVisita ? VISITA_SLOTS : SCHEDULE_SLOTS
            for (const time of daySlots) {
              if (slots.length >= SCHEDULE_MAX_SLOTS) break
              if ((blockers.busy[key] || {})[time]) continue
              if ((blockers.reservedTimes[key] || {})[time]) continue
              slots.push({ date: key, time: time })
            }
          }
          return slots
        }

        // Próximo número sequencial de OS: maior OS-NNNN existente + 1.
        const nextOrderNumber = () => {
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
          return 'OS-' + String(maxSeq + 1).padStart(4, '0')
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
              'Digite o número da opção desejada:\n1 - Falar com um atendente\n2 - Solicitar um orçamento\n3 - Agendar visita técnica\n4 - Outros assuntos',
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

        // --- Fluxo conversacional de agendamento (opções 2 e 3) -----------------
        // 2 = orçamento. Estados em schedule_state:
        // awaiting_name -> awaiting_confirm (ou awaiting_pick) -> awaiting_slot.
        const ASK_NAME =
          'Ótimo! Para começar, me confirme seu nome completo e o telefone com DDD (ex.: (66) 99999-0000):'
        const GIVE_UP_TEXT =
          'Não consegui entender sua resposta. Vou transferir para um atendente humano — ele vai te responder por aqui mesmo.'
        const SCHEDULE_MAX_ATTEMPTS = 3

        // Visita técnica (opção 3): fluxo próprio, separado da opção 2.
        // Estados: vt_name -> vt_phone -> vt_confirm (1 cadastro) /
        // vt_pick (vários cadastros: escolha do ENDEREÇO) / vt_address
        // (cadastro não localizado: endereço informado) -> awaiting_slot.
        const VT_ASK_NAME =
          'Perfeito! Vamos agendar sua VISITA TÉCNICA. Primeiro, digite seu nome completo do cadastro:'

        const formatPhonePretty = (phoneDigits) => {
          const d = String(phoneDigits || '').replace(/\D/g, '')
          if (d.length >= 10) {
            return '(' + d.slice(0, 2) + ') ' + d.slice(2, -4) + '-' + d.slice(-4)
          }
          return String(phoneDigits || '')
        }

        const describeClient = (c) => {
          const n = String(c.get('name') || '').trim()
          const p = formatPhonePretty(String(c.get('phone') || '').trim())
          const addr = String(c.get('address') || '').trim()
          const city = String(c.get('city') || '').trim()
          const state = String(c.get('state') || '').trim()
          let fullAddr = addr
          if (city || state) {
            fullAddr = (addr ? addr + ' — ' : '') + [city, state].filter(Boolean).join('/')
          }
          return n + ', ' + (p || 'telefone não informado') + (fullAddr ? ', ' + fullAddr : '')
        }

        const matchesName = (clientName, typedName) => {
          const a = String(clientName || '').toLowerCase()
          const tokens = String(typedName || '')
            .toLowerCase()
            .split(/\s+/)
            .filter((t) => t.length >= 3)
          if (tokens.length === 0) return true
          return tokens.some((t) => a.indexOf(t) !== -1)
        }

        const findClientsByPhone = (phoneDigits) => {
          const norm = normalizePhone(phoneDigits)
          const matches = []
          try {
            const all = app.findRecordsByFilter('clients', "phone != ''", '-created', 500, 0)
            for (const record of all) {
              if (samePhone(normalizePhone(record.get('phone')), norm)) matches.push(record)
            }
          } catch (_) {}
          return matches
        }

        // Dedup por id — buscas diferentes podem devolver o mesmo cadastro.
        const dedupById = (records) => {
          const out = []
          const seen = {}
          for (const c of records || []) {
            if (!seen[c.id]) {
              seen[c.id] = true
              out.push(c)
            }
          }
          return out
        }

        // Busca tolerante de cadastros pelo nome (case-insensitive): cada token
        // (>= 3 letras) do nome digitado precisa existir no nome do cadastro.
        // Usada como FALLBACK quando a busca pelo telefone não encontra nada.
        const findClientsByName = (typedName) => {
          const tokens = String(typedName || '')
            .toLowerCase()
            .replace(/[^\p{L}\s]/gu, ' ')
            .split(/\s+/)
            .filter((t) => t.length >= 3)
          if (tokens.length === 0) return []
          const hits = []
          try {
            const all = app.findRecordsByFilter('clients', '', '-created', 500, 0)
            for (const record of all) {
              const nm = String(record.get('name') || '').toLowerCase()
              if (!nm) continue
              if (tokens.every((t) => nm.indexOf(t) !== -1)) hits.push(record)
            }
          } catch (_) {}
          return hits
        }

        // Cliente JÁ CADASTRADO: quando o telefone do remetente já existe no
        // cadastro de clientes com um nome real (pedido do dono: "já pelo
        // contato do cliente pode-se ver se já tem cadastro"), o fluxo pula
        // nome/telefone e vai direto para a escolha de data/horário — o bot
        // cumprimenta pelo nome e confirma se é ele. Cadastros automáticos
        // ("Contato WhatsApp NNNN") não contam: aí o fluxo pede os dados como
        // antes. O dono do CRM pode ter corrigido o nome do cadastro, então o
        // nome REAL do cadastro vence o que o estado antigo guardava.
        const isAutoClientName = (n) =>
          !String(n || '').trim() ||
          /^contato whatsapp \d+$/.test(String(n).trim().toLowerCase()) ||
          /^cliente whatsapp$/.test(String(n).trim().toLowerCase())

        const scheduleIntro = (tipo) => {
          const cadName = String(clientRecord.get('name') || '').trim()
          const knownClient = !isAutoClientName(cadName) && findClientsByPhone(rawPhone).length > 0
          if (knownClient) {
            scheduleState = 'awaiting_known_confirm'
            scheduleData = {
              order_type: tipo,
              name: cadName,
              phone: String(clientRecord.get('phone') || '').trim() || normalizePhone(rawPhone),
              client_id: clientRecord.id,
              attempts: 0,
            }
            saveScheduleState()
            console.log(
              '[whatsapp] fluxo (' +
                (tipo === 'visita_tecnica' ? 'opção 3' : 'opção 2') +
                '): cliente JÁ CADASTRADO reconhecido pelo telefone — client_id=' +
                clientRecord.id +
                ', confirmando identidade e ENDEREÇO antes dos horários',
            )
            sendAutoReply(
              'Olá' +
                (cadName.split(' ')[0] ? ', ' + cadName.split(' ')[0] : '') +
                '! Encontrei seu cadastro aqui. É você mesmo?' +
                '\n\n' +
                describeClient(clientRecord) +
                '\n\nResponda 1 para SIM (aí confirmamos o ENDEREÇO do atendimento) ou 2 para NÃO (aí eu confiro seus dados com você).',
            )
            return
          }
          if (tipo === 'visita_tecnica') {
            // Visita técnica: primeiro o nome completo do cadastro...
            scheduleState = 'vt_name'
            scheduleData = { order_type: tipo, attempts: 0 }
            saveScheduleState()
            console.log('[whatsapp] fluxo de VISITA TÉCNICA iniciado (opção 3) para ' + rawPhone)
            sendAutoReply(VT_ASK_NAME)
            return
          }
          scheduleState = 'awaiting_name'
          scheduleData = { order_type: tipo, attempts: 0 }
          saveScheduleState()
          console.log('[whatsapp] fluxo de agendamento iniciado (opção 2) para ' + rawPhone)
          sendAutoReply(ASK_NAME)
        }

        const sendSlotList = () => {
          const blockers = loadScheduleBlockers()
          const isVisita = String(scheduleData.order_type || '') === 'visita_tecnica'
          const slots = buildScheduleSlots(blockers, isVisita)
          if (slots.length === 0) {
            sendAutoReply(
              'No momento não tenho horários disponíveis nos próximos dias úteis. Registrei seu pedido e um atendente entrará em contato para combinar a melhor data.',
            )
            console.log('[whatsapp] agendamento: nenhum slot livre para ofertar')
            return
          }
          scheduleData.slots = slots
          scheduleData.attempts = 0
          scheduleState = 'awaiting_slot'
          saveScheduleState()
          let list = 'Horários disponíveis:\n'
          slots.forEach((s, i) => {
            list += i + 1 + ') ' + slotKeyLabel(s.date, s.time) + '\n'
          })
          list += '\nResponda com o número da opção desejada:'
          console.log(
            '[whatsapp] agendamento: slots ofertados (' +
              (isVisita ? 'visita técnica' : 'orçamento') +
              '): ' +
              slots.map((s) => s.date + ' ' + s.time).join(' | '),
          )
          sendAutoReply(list)
        }

        // Endereço completo de um cadastro de cliente (rua + cidade/UF).
        const clientFullAddress = (c) => {
          const addr = String(c.get('address') || '').trim()
          const city = String(c.get('city') || '').trim()
          const state = String(c.get('state') || '').trim()
          const district = String(c.get('neighborhood') || '').trim()
          const parts = [addr, district].filter(Boolean).join(', ')
          const cityState = [city, state].filter(Boolean).join('/')
          if (parts && cityState) return parts + ' — ' + cityState
          if (parts || cityState) return parts || cityState
          return ''
        }

        // Passo de ENDEREÇO — obrigatório antes de ofertar horários. Mostra o
        // endereço que será usado na OS (o digitado no fluxo tem prioridade;
        // sem ele, o do cadastro) e pede confirmação. Cadastro sem endereço
        // nenhum pede para digitar. Só depois de confirmado vêm os horários.
        const startAddressStep = (clientRec) => {
          const typed = String(scheduleData.address || '').trim()
          const addr = typed || (clientRec ? clientFullAddress(clientRec) : '')
          if (clientRec) scheduleData.client_id = clientRec.id
          scheduleData.attempts = 0
          if (!addr) {
            scheduleState = 'awaiting_address'
            saveScheduleState()
            console.log('[whatsapp] agendamento: cadastro sem endereço — pedindo o endereço')
            sendAutoReply(
              'Agora me confirme o ENDEREÇO do atendimento (rua, número, bairro e cidade):',
            )
            return
          }
          scheduleState = 'awaiting_address_confirm'
          saveScheduleState()
          console.log(
            '[whatsapp] agendamento: confirmando o endereço (' + addr + ') antes dos horários',
          )
          sendAutoReply(
            'O atendimento será no endereço: ' +
              addr +
              '\n\nEstá correto? Responda 1 para SIM ou 2 para informar outro endereço.',
          )
        }

        const createScheduledOrder = (clientRec, slot, description) => {
          const orderNumber = nextOrderNumber()
          const orderRecord = new Record(app.findCollectionByNameOrId('service_orders'))
          orderRecord.set('number', orderNumber)
          orderRecord.set('client_id', clientRec.id)
          orderRecord.set('conversation_id', conversation.id)
          orderRecord.set('status', 'aberta')
          orderRecord.set('opened_at', new Date().toISOString())
          orderRecord.set('order_type', String(scheduleData.order_type || 'orcamento'))
          // Descrição ditada pelo cliente no fluxo; sem ela, o rótulo padrão
          // por tipo de agendamento.
          const desc = String(description || '').trim()
          orderRecord.set(
            'problem_description',
            desc ||
              (String(scheduleData.order_type) === 'visita_tecnica'
                ? 'Visita técnica agendada via WhatsApp'
                : 'Orçamento agendado via WhatsApp'),
          )
          orderRecord.set('scheduled_date', slot.date)
          orderRecord.set('scheduled_time', slot.time)
          // agendamento_para (date) — é o campo que o calendário da Agenda usa
          // para posicionar a OS no dia/hora. PocketBase grava datas em UTC e
          // o servidor roda em UTC: interpretar o horário de parede com
          // new Date(...) local do servidor gravava 08:00 como 08:00Z e o
          // navegador exibia 04:00 (Bug 2). Gravamos a HORA DE PAREDE LITERAL
          // ('2026-11-19 08:00:00.000Z' = 08:00 LOCAIS do negócio) e o
          // frontend lê a string SEM converter fuso (agendaUtils e ficha de
          // OS) — o horário mostrado, ofertado e gravado é sempre o escolhido,
          // independente do fuso do navegador de quem acessa o CRM.
          orderRecord.set('agendamento_para', slot.date + ' ' + slot.time + ':00.000Z')
          orderRecord.set('stock_released', false)
          // Técnico principal: o primeiro técnico ativo cadastrado.
          try {
            const techs = app.findRecordsByFilter('technicians', 'active = true', 'created', 1, 0)
            if (techs.length > 0) orderRecord.set('technician_id', techs[0].id)
          } catch (_) {}
          // Snapshot dos dados do cliente na OS.
          const cNome = String(clientRec.get('name') || scheduleData.name || '').trim()
          const cTelefone = String(clientRec.get('phone') || scheduleData.phone || '').trim()
          // Visita técnica: o cliente pode ter informado o endereço em texto
          // livre (cadastro não localizado); ele tem prioridade, pois é o
          // endereço do atendimento combinado.
          const typedAddress = String(scheduleData.address || '').trim()
          const cEndereco = typedAddress || String(clientRec.get('address') || '').trim()
          const cCidade = String(clientRec.get('city') || '').trim()
          const cEstado = String(clientRec.get('state') || '').trim()
          let enderecoOs = cEndereco
          if (typedAddress) {
            if (cCidade || cEstado) {
              enderecoOs = cEndereco + ' — ' + [cCidade, cEstado].filter(Boolean).join('/')
            }
          } else if (cCidade || cEstado) {
            enderecoOs =
              (cEndereco ? cEndereco + ' — ' : '') + [cCidade, cEstado].filter(Boolean).join('/')
          }
          if (cNome) orderRecord.set('client_name', cNome)
          if (cTelefone) orderRecord.set('client_phone', cTelefone)
          if (enderecoOs) orderRecord.set('client_address', enderecoOs)
          app.save(orderRecord)
          console.log(
            '[whatsapp] OS criada via agendamento WhatsApp: id=' +
              orderRecord.id +
              ' ' +
              orderNumber +
              ' tipo=' +
              (scheduleData.order_type || 'orcamento') +
              ' slot=' +
              slot.date +
              ' ' +
              slot.time +
              ' cliente=' +
              clientRec.id,
          )
          return orderRecord
        }

        const bumpAttempts = () => {
          scheduleData.attempts = (scheduleData.attempts || 0) + 1
          saveScheduleState()
          return (scheduleData.attempts || 0) >= SCHEDULE_MAX_ATTEMPTS
        }

        const handleScheduleFlow = () => {
          if (scheduleState === 'awaiting_known_confirm') {
            // Confirmação do cliente reconhecido pelo telefone do cadastro.
            if (trimmed === '1') {
              let c = null
              if (scheduleData.client_id) {
                try {
                  c = app.findRecordById('clients', scheduleData.client_id)
                } catch (_) {}
              }
              if (!c) c = clientRecord
              scheduleData.attempts = 0
              console.log(
                '[whatsapp] cliente confirmou o cadastro (' +
                  (scheduleData.order_type === 'visita_tecnica' ? 'opção 3' : 'opção 2') +
                  ') — confirmando o ENDEREÇO antes dos horários',
              )
              startAddressStep(c)
              return
            }
            if (trimmed === '2') {
              // Não é ele: refaz o fluxo pedindo os dados do começo.
              const tipo = scheduleData.order_type
              scheduleData = { order_type: tipo, attempts: 0 }
              if (tipo === 'visita_tecnica') {
                scheduleState = 'vt_name'
                saveScheduleState()
                sendAutoReply('Sem problemas. ' + VT_ASK_NAME)
              } else {
                scheduleState = 'awaiting_name'
                saveScheduleState()
                sendAutoReply('Sem problemas. ' + ASK_NAME)
              }
              return
            }
            if (bumpAttempts()) {
              clearScheduleState()
              sendAutoReply(GIVE_UP_TEXT)
              return
            }
            sendAutoReply('Por favor, responda 1 para SIM ou 2 para NÃO.')
            return
          }

          if (scheduleState === 'awaiting_name') {
            const parsed = parseNameAndPhone(trimmed)
            if (!parsed.phone || parsed.name.length < 3) {
              if (bumpAttempts()) {
                clearScheduleState()
                sendAutoReply(GIVE_UP_TEXT)
                return
              }
              sendAutoReply(
                'Não entendi. Por favor, envie seu nome completo e o telefone com DDD (ex.: Maria Silva (66) 99999-0000):',
              )
              return
            }
            scheduleData.name = parsed.name
            scheduleData.phone = parsed.phone
            // Prioridade TELEFONE > NOME: cadastro achado pelo telefone é usado
            // mesmo que o nome digitado difira (o cadastro pode ter razão
            // social/apelido diferente do nome informado). Só busca pelo nome
            // quando o telefone não encontra nenhum cadastro.
            let matches = findClientsByPhone(parsed.phone)
            if (matches.length === 0) {
              matches = findClientsByName(parsed.name)
              console.log(
                '[whatsapp] agendamento: telefone ' +
                  parsed.phone +
                  ' sem cadastro — buscando pelo nome "' +
                  parsed.name +
                  '"',
              )
            } else if (matches.length > 1) {
              // Vários com o mesmo telefone: tenta desambiguar pelo nome.
              const byName = matches.filter((c) => matchesName(c.get('name'), parsed.name))
              if (byName.length > 0) matches = byName
            }
            if (matches.length === 1) {
              const c = matches[0]
              scheduleState = 'awaiting_confirm'
              scheduleData.client_id = c.id
              scheduleData.attempts = 0
              saveScheduleState()
              console.log(
                '[whatsapp] agendamento: cadastro encontrado para ' +
                  parsed.phone +
                  ': client_id=' +
                  c.id,
              )
              sendAutoReply(
                'Encontrei o cadastro: ' +
                  describeClient(c) +
                  '. É você? Responda 1 para SIM ou 2 para NÃO.',
              )
            } else if (matches.length > 1) {
              scheduleState = 'awaiting_pick'
              scheduleData.candidate_ids = matches.map((c) => c.id)
              scheduleData.attempts = 0
              saveScheduleState()
              console.log(
                '[whatsapp] agendamento: vários cadastros encontrados (' +
                  matches.length +
                  ') para ' +
                  parsed.phone,
              )
              let msg = 'Encontrei mais de um cadastro com esse telefone. Qual é você?\n'
              matches.forEach((c, i) => {
                msg += i + 1 + ') ' + describeClient(c) + '\n'
              })
              msg += '\nResponda com o número:'
              sendAutoReply(msg)
            } else {
              // Nem telefone nem nome localizaram: segue como novo cliente.
              scheduleState = 'awaiting_confirm'
              scheduleData.client_id = ''
              scheduleData.attempts = 0
              saveScheduleState()
              console.log(
                '[whatsapp] agendamento: nenhum cadastro encontrado para ' +
                  parsed.phone +
                  ' / "' +
                  parsed.name +
                  '" — seguirá como novo cliente',
              )
              sendAutoReply(
                'Não encontrei cadastro com esse telefone. Vou atender como novo cliente — confirme: ' +
                  parsed.name +
                  ', ' +
                  formatPhonePretty(parsed.phone) +
                  '? Responda 1 para SIM ou 2 para NÃO.',
              )
            }
            return
          }

          if (scheduleState === 'awaiting_pick') {
            const candidates = Array.isArray(scheduleData.candidate_ids)
              ? scheduleData.candidate_ids
              : []
            const idx = parseInt(trimmed, 10)
            if (idx >= 1 && idx <= candidates.length) {
              let c = null
              try {
                c = app.findRecordById('clients', candidates[idx - 1])
              } catch (_) {}
              if (c) {
                scheduleState = 'awaiting_confirm'
                scheduleData.client_id = c.id
                scheduleData.attempts = 0
                saveScheduleState()
                sendAutoReply(
                  'Encontrei o cadastro: ' +
                    describeClient(c) +
                    '. É você? Responda 1 para SIM ou 2 para NÃO.',
                )
                return
              }
            }
            if (bumpAttempts()) {
              clearScheduleState()
              sendAutoReply(GIVE_UP_TEXT)
              return
            }
            sendAutoReply('Responda com o número de uma das opções da lista acima.')
            return
          }

          if (scheduleState === 'awaiting_confirm') {
            if (trimmed === '1') {
              let c = null
              if (scheduleData.client_id) {
                try {
                  c = app.findRecordById('clients', scheduleData.client_id)
                } catch (_) {}
              }
              if (!c) {
                // Cadastro confirmado como novo cliente: se o telefone já tem
                // cadastro (ex.: criado automaticamente no primeiro inbound),
                // REUSA em vez de duplicar.
                try {
                  const existing = findClientsByPhone(scheduleData.phone || rawPhone)
                  if (existing.length > 0) c = existing[0]
                } catch (_) {}
              }
              if (!c) {
                // Cadastro confirmado como novo cliente: cria agora.
                try {
                  c = new Record(app.findCollectionByNameOrId('clients'))
                  c.set('name', String(scheduleData.name || '').trim() || 'Cliente WhatsApp')
                  c.set('phone', String(scheduleData.phone || rawPhone).trim())
                  c.set('status', 'active')
                  app.save(c)
                  console.log('[whatsapp] agendamento: novo cliente criado:', c.id)
                } catch (err) {
                  console.log('[whatsapp] agendamento: falha ao criar cliente:', err)
                }
              }
              if (!c) {
                clearScheduleState()
                sendAutoReply(
                  'Não consegui preparar o agendamento agora. Por favor, tente novamente mais tarde ou digite 1 para falar com um atendente.',
                )
                return
              }
              console.log(
                '[whatsapp] agendamento: cadastro confirmado — confirmando o ENDEREÇO antes dos horários',
              )
              scheduleData.attempts = 0
              startAddressStep(c)
              return
            }
            if (trimmed === '2') {
              scheduleState = 'awaiting_name'
              scheduleData.client_id = ''
              scheduleData.attempts = 0
              saveScheduleState()
              sendAutoReply('Sem problemas. ' + ASK_NAME)
              return
            }
            if (bumpAttempts()) {
              clearScheduleState()
              sendAutoReply(GIVE_UP_TEXT)
              return
            }
            sendAutoReply('Por favor, responda 1 para SIM ou 2 para NÃO.')
            return
          }

          if (scheduleState === 'awaiting_address_confirm') {
            // Endereço do atendimento (do cadastro ou digitado) confirmado:
            // só agora a lista de horários é oferecida e a OS poderá ser aberta.
            if (trimmed === '1') {
              scheduleState = 'awaiting_slot'
              scheduleData.attempts = 0
              saveScheduleState()
              console.log('[whatsapp] endereço confirmado pelo cliente — ofertando horários')
              sendSlotList()
              return
            }
            if (trimmed === '2') {
              scheduleState = 'awaiting_address'
              scheduleData.address = ''
              scheduleData.attempts = 0
              saveScheduleState()
              sendAutoReply(
                'Sem problemas. Me informe o ENDEREÇO correto do atendimento (rua, número, bairro e cidade):',
              )
              return
            }
            if (bumpAttempts()) {
              clearScheduleState()
              sendAutoReply(GIVE_UP_TEXT)
              return
            }
            sendAutoReply('Por favor, responda 1 para SIM ou 2 para informar outro endereço.')
            return
          }

          if (scheduleState === 'awaiting_address') {
            // Endereço digitado em texto livre; volta para a confirmação.
            const addr = trimmed.replace(/\s+/g, ' ').trim()
            if (addr.length < 5) {
              if (bumpAttempts()) {
                clearScheduleState()
                sendAutoReply(GIVE_UP_TEXT)
                return
              }
              sendAutoReply(
                'Não entendi. Por favor, informe o endereço completo do atendimento (rua, número, bairro e cidade):',
              )
              return
            }
            scheduleData.address = addr
            scheduleState = 'awaiting_address_confirm'
            scheduleData.attempts = 0
            saveScheduleState()
            sendAutoReply(
              'Confirme o endereço do atendimento: ' +
                addr +
                '\n\nEstá correto? Responda 1 para SIM ou 2 para NÃO.',
            )
            return
          }

          if (scheduleState === 'awaiting_slot') {
            const slots = Array.isArray(scheduleData.slots) ? scheduleData.slots : []
            if (slots.length === 0) {
              // Estado sem a lista (dados perdidos): reoferta os horários
              // em vez de travar o cliente num "responda com o número".
              sendSlotList()
              return
            }
            const idx = parseInt(trimmed, 10)
            if (!(idx >= 1 && idx <= slots.length)) {
              if (bumpAttempts()) {
                clearScheduleState()
                sendAutoReply(GIVE_UP_TEXT)
                return
              }
              sendAutoReply('Escolha o número de uma das opções da lista acima.')
              return
            }
            const chosen = slots[idx - 1]
            // Revalida na hora: o slot pode ter sido ocupado/reservado enquanto
            // o cliente escolhia.
            const blockers = loadScheduleBlockers()
            const stillFree =
              !blockers.holidaySet[chosen.date] &&
              !blockers.reservedFull[chosen.date] &&
              !(blockers.busy[chosen.date] || {})[chosen.time] &&
              !(blockers.reservedTimes[chosen.date] || {})[chosen.time]
            if (!stillFree) {
              sendAutoReply('Esse horário acabou de ser preenchido, veja as opções:')
              sendSlotList()
              return
            }
            // Escolha válida: guarda o slot e pede a DESCRICÃO do serviço
            // (pedido do dono) — a OS só é criada quando a descrição chegar.
            scheduleState = 'awaiting_description'
            scheduleData.chosen_date = chosen.date
            scheduleData.chosen_time = chosen.time
            scheduleData.slots = []
            scheduleData.attempts = 0
            saveScheduleState()
            sendAutoReply(
              'Horário reservado: ' +
                slotKeyLabel(chosen.date, chosen.time) +
                '.\nAgora, descreva em uma mensagem o serviço que você precisa (o que aconteceu, o que precisa ser feito):',
            )
            return
          }

          if (scheduleState === 'awaiting_description') {
            // Descrição do serviço em texto livre: abre a OS com ela gravada e
            // confirma ao cliente o NÚMERO da OS e a data com horário.
            const desc = trimmed.replace(/\s+/g, ' ').trim()
            if (desc.length < 3) {
              if (bumpAttempts()) {
                clearScheduleState()
                sendAutoReply(GIVE_UP_TEXT)
                return
              }
              sendAutoReply(
                'Não entendi. Descreva o serviço em uma mensagem (ex.: "instalação de cerca elétrica na garagem"):',
              )
              return
            }
            let clientRec = null
            if (scheduleData.client_id) {
              try {
                clientRec = app.findRecordById('clients', scheduleData.client_id)
              } catch (_) {}
            }
            if (!clientRec) {
              try {
                const matches = findClientsByPhone(scheduleData.phone || rawPhone)
                if (matches.length > 0) clientRec = matches[0]
              } catch (_) {}
            }
            if (!clientRec) {
              clearScheduleState()
              sendAutoReply(
                'Não consegui concluir o agendamento agora. Por favor, tente novamente mais tarde ou digite 1 para falar com um atendente.',
              )
              return
            }
            try {
              const order = createScheduledOrder(
                clientRec,
                {
                  date: scheduleData.chosen_date,
                  time: scheduleData.chosen_time,
                },
                desc,
              )
              // Mensagem FINAL do fluxo: sempre a CONFIRMAÇÃO do agendamento
              // com o número da OS e a data com horário escolhido (pedido do
              // dono) — sem aviso de "entraremos em contato".
              sendAutoReply(
                'Agendado! Sua ordem de serviço N° ' +
                  String(order.get('number') || '') +
                  ' está marcada para ' +
                  slotKeyLabel(
                    String(scheduleData.chosen_date || ''),
                    String(scheduleData.chosen_time || ''),
                  ) +
                  '. Obrigado pela confiança!',
              )
              clearScheduleState()
            } catch (orderErr) {
              console.log('[whatsapp] agendamento: falha ao criar a OS:', orderErr)
              clearScheduleState()
              sendAutoReply(
                'Tive um problema para registrar seu agendamento. Por favor, tente novamente em alguns minutos ou digite 1 para falar com um atendente.',
              )
            }
            return
          }

          if (scheduleState === 'vt_name') {
            // Visita técnica: o cliente digita o nome completo do cadastro.
            const typed = trimmed.replace(/\s+/g, ' ').trim()
            if (typed.length < 3 || /\d{4,}/.test(typed)) {
              if (bumpAttempts()) {
                clearScheduleState()
                sendAutoReply(GIVE_UP_TEXT)
                return
              }
              sendAutoReply('Não entendi. Por favor, digite seu NOME COMPLETO do cadastro:')
              return
            }
            scheduleData.name = typed
            scheduleState = 'vt_phone'
            scheduleData.attempts = 0
            saveScheduleState()
            sendAutoReply(
              'Obrigado! Agora me confirme seu TELEFONE com DDD (ex.: (66) 99999-0000):',
            )
            return
          }

          if (scheduleState === 'vt_phone') {
            // Telefone: busca cadastros no sistema (prioridade telefone > nome).
            const cleaned = trimmed.replace(/\D/g, '')
            if (cleaned.length < 10 || cleaned.length > 13) {
              if (bumpAttempts()) {
                clearScheduleState()
                sendAutoReply(GIVE_UP_TEXT)
                return
              }
              sendAutoReply('Não entendi. Envie o telefone com DDD (ex.: (66) 99999-0000):')
              return
            }
            let phoneDigits = cleaned
            if (phoneDigits.startsWith('55') && phoneDigits.length > 11) {
              phoneDigits = phoneDigits.slice(2)
            }
            scheduleData.phone = phoneDigits
            scheduleData.attempts = 0
            saveScheduleState()

            // Prioridade TELEFONE > NOME (pedido do dono): o telefone é o
            // identificador do cadastro — o nome digitado pode ser apelido ou
            // diferir da razão social (ex.: "Ana Paula Silva" vs "ANA
            // PERFUMARIA"). Achou pelo telefone, usa e IGNORA o nome; só busca
            // pelo nome quando o telefone não encontra nenhum cadastro.
            let unique = dedupById(findClientsByPhone(phoneDigits))
            let buscaBase = 'telefone'
            if (unique.length === 0) {
              unique = dedupById(findClientsByName(scheduleData.name))
              buscaBase = 'nome'
            }
            console.log(
              '[whatsapp] visita técnica: busca por "' +
                scheduleData.name +
                '" + ' +
                phoneDigits +
                ' (busca por ' +
                buscaBase +
                ') => ' +
                unique.length +
                ' cadastro(s)',
            )

            if (unique.length === 1) {
              // Cadastro único encontrado: mostra os dados e pede confirmação.
              const c = unique[0]
              scheduleState = 'vt_confirm'
              scheduleData.client_id = c.id
              scheduleData.attempts = 0
              saveScheduleState()
              sendAutoReply(
                'Encontrei o cadastro:\n' +
                  describeClient(c) +
                  '\n\nÉ você mesmo? Responda 1 para SIM ou 2 para NÃO.',
              )
              return
            }
            if (unique.length > 1) {
              // Mais de um cadastro: confirma qual ENDEREÇO precisa de atendimento.
              scheduleState = 'vt_pick'
              scheduleData.candidate_ids = unique.map((c) => c.id)
              scheduleData.attempts = 0
              saveScheduleState()
              // Pode ter vindo do telefone (vários cadastros) ou do nome.
              let msg =
                'Encontrei mais de um cadastro com esses dados. Qual endereço precisa de atendimento?\n'
              unique.forEach((c, i) => {
                const addr = clientFullAddress(c) || 'endereço não informado'
                msg += i + 1 + ') ' + addr + '\n'
              })
              msg += '\nResponda com o número do endereço:'
              sendAutoReply(msg)
              return
            }
            // Nem telefone nem nome localizaram: pede o endereço para a visita.
            scheduleState = 'vt_address'
            scheduleData.client_id = ''
            scheduleData.attempts = 0
            saveScheduleState()
            console.log(
              '[whatsapp] visita técnica: cadastro não localizado (telefone ' +
                phoneDigits +
                ' e nome "' +
                scheduleData.name +
                '" sem resultado) — pedindo endereço',
            )
            sendAutoReply(
              'Não encontrei seu cadastro no sistema. Para agendar a visita, me informe o ENDEREÇO completo do atendimento (rua, número, bairro e cidade):',
            )
            return
          }

          if (scheduleState === 'vt_address') {
            // Endereço informado em texto livre (cadastro não localizado).
            const addr = trimmed.replace(/\s+/g, ' ').trim()
            if (addr.length < 5) {
              if (bumpAttempts()) {
                clearScheduleState()
                sendAutoReply(GIVE_UP_TEXT)
                return
              }
              sendAutoReply(
                'Não entendi. Por favor, informe o endereço completo do atendimento (rua, número, bairro e cidade):',
              )
              return
            }
            scheduleData.address = addr
            scheduleState = 'vt_confirm'
            scheduleData.attempts = 0
            saveScheduleState()
            sendAutoReply(
              'Confirme os dados para a visita técnica:\n' +
                scheduleData.name +
                '\n' +
                formatPhonePretty(scheduleData.phone) +
                '\n' +
                addr +
                '\n\nEstá correto? Responda 1 para SIM ou 2 para NÃO.',
            )
            return
          }

          if (scheduleState === 'vt_confirm') {
            if (trimmed === '1') {
              let c = null
              if (scheduleData.client_id) {
                try {
                  c = app.findRecordById('clients', scheduleData.client_id)
                } catch (_) {}
              }
              if (!c) {
                // Telefone já tem cadastro (mesmo que por outro nome)? Reusa —
                // evita duplicar o cliente a cada fluxo.
                try {
                  const existing = findClientsByPhone(scheduleData.phone || rawPhone)
                  if (existing.length > 0) c = existing[0]
                } catch (_) {}
              }
              if (!c) {
                // Cadastro confirmado sem vínculo (endereço informado): cria um
                // novo cliente com os dados do fluxo, para a OS sair vinculada.
                try {
                  c = new Record(app.findCollectionByNameOrId('clients'))
                  c.set('name', String(scheduleData.name || '').trim() || 'Cliente WhatsApp')
                  c.set('phone', String(scheduleData.phone || rawPhone).trim())
                  if (String(scheduleData.address || '').trim()) {
                    c.set('address', String(scheduleData.address).trim())
                  }
                  c.set('status', 'active')
                  app.save(c)
                  console.log('[whatsapp] visita técnica: novo cliente criado:', c.id)
                } catch (err) {
                  console.log('[whatsapp] visita técnica: falha ao criar cliente:', err)
                }
              }
              if (!c) {
                clearScheduleState()
                sendAutoReply(
                  'Não consegui preparar o agendamento agora. Por favor, tente novamente mais tarde ou digite 1 para falar com um atendente.',
                )
                return
              }
              console.log(
                '[whatsapp] visita técnica: cadastro confirmado — confirmando o ENDEREÇO antes dos horários',
              )
              scheduleData.attempts = 0
              startAddressStep(c)
              return
            }
            if (trimmed === '2') {
              // Refaz o fluxo: nome completo primeiro.
              scheduleState = 'vt_name'
              scheduleData = { order_type: 'visita_tecnica', attempts: 0 }
              saveScheduleState()
              sendAutoReply('Sem problemas. ' + VT_ASK_NAME)
              return
            }
            if (bumpAttempts()) {
              clearScheduleState()
              sendAutoReply(GIVE_UP_TEXT)
              return
            }
            sendAutoReply('Por favor, responda 1 para SIM ou 2 para NÃO.')
            return
          }

          if (scheduleState === 'vt_pick') {
            // Cliente escolhe o ENDEREÇO (cadastro) que precisa de atendimento.
            const candidates = Array.isArray(scheduleData.candidate_ids)
              ? scheduleData.candidate_ids
              : []
            const idx = parseInt(trimmed, 10)
            if (idx >= 1 && idx <= candidates.length) {
              let c = null
              try {
                c = app.findRecordById('clients', candidates[idx - 1])
              } catch (_) {}
              if (c) {
                scheduleState = 'awaiting_slot'
                scheduleData.client_id = c.id
                scheduleData.attempts = 0
                saveScheduleState()
                sendAutoReply(
                  'Atendimento no endereço: ' +
                    (clientFullAddress(c) || 'endereço a confirmar com o técnico') +
                    '.\nAgora vou te oferecer as datas e horários disponíveis.',
                )
                sendSlotList()
                return
              }
            }
            if (bumpAttempts()) {
              clearScheduleState()
              sendAutoReply(GIVE_UP_TEXT)
              return
            }
            sendAutoReply('Responda com o número de um dos endereços da lista acima.')
            return
          }

          // Estado desconhecido ou pela metade (ex.: gravado por uma versão
          // anterior do fluxo): limpa e recomeça do menu — o cliente NUNCA
          // fica sem resposta por causa de um estado inválido.
          const staleState = scheduleState
          clearScheduleState()
          try {
            sendGreetingAndMenu()
            console.log(
              '[whatsapp] estado de agendamento inválido ("' +
                staleState +
                '") — fluxo limpo e menu reenviado',
            )
          } catch (menuErr) {
            console.log('[whatsapp] falha ao reenviar o menu após estado inválido:', menuErr)
          }
        }

        if (!autoReplyAllowed) {
          // Modo validação: remetente fora da lista de teste — nada sai.
          // A mensagem já foi gravada; fica para atendimento manual.
        } else if (text === MEDIA_NO_TEXT) {
          // Áudio/imagem/sticker sem texto: orienta o reenvio em texto SEM
          // alterar o estado do fluxo (antes: nada era gravado nem respondido).
          try {
            sendAutoReply(
              'Recebi um áudio/mídia, mas não consigo processar esse formato por aqui. Por favor, escreva sua mensagem em texto.',
            )
            sentOk = true
          } catch (sendErr) {
            sendError = String(sendErr)
            console.log('[whatsapp] aviso: orientação de mídia sem texto não enviada:', sendErr)
          }
        } else if (scheduleState && isGreeting) {
          // Cumprimento no meio do fluxo: Reinicia o atendimento do zero —
          // limpa o estado (inclusive listas de horários antigas gravadas
          // antes de um ajuste no fluxo) e manda saudação + menu de novo.
          clearScheduleState()
          try {
            sendGreetingAndMenu()
            sentOk = true
            console.log(
              '[whatsapp] cumprimento reiniciou o fluxo de agendamento — estado limpo, menu reenviado:',
              trimmed,
            )
          } catch (sendErr) {
            sendError = String(sendErr)
            console.log('[whatsapp] aviso: saudação/menu não enviados após reinício:', sendErr)
          }
        } else if (scheduleState) {
          // Cliente no meio do fluxo de agendamento: qualquer mensagem é
          // processada pelo fluxo (inclusive "1"/"2" como resposta de
          // confirmação, que não podem reabrir o menu).
          try {
            handleScheduleFlow()
            sentOk = true
          } catch (flowErr) {
            sendError = String(flowErr)
            console.log('[whatsapp] erro no fluxo de agendamento:', flowErr)
            // Recuperação: limpa o estado e responde — o cliente nunca fica
            // em silêncio total após um erro no meio do fluxo.
            try {
              clearScheduleState()
              sendAutoReply(
                'Tive um problema técnico no meio do nosso atendimento e perdi o fio da conversa. Responda com o número da opção desejada:\n1 - Falar com um atendente\n2 - Solicitar um orçamento\n3 - Abrir uma visita técnica\n4 - Outros assuntos',
              )
            } catch (recoverErr) {
              console.log('[whatsapp] falha também na recuperação do fluxo:', recoverErr)
            }
          }
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
        } else if (option === '2' || option === '3') {
          // Opção 2 = orçamento: abre o fluxo de agendamento de orçamento
          // (nome + telefone -> cadastro -> slots). Opção 3 = visita técnica:
          // abre o fluxo PRÓPRIO de visita técnica (nome -> telefone ->
          // cadastro/endereço -> slots com os dois turnos).
          scheduleIntro(option === '2' ? 'orcamento' : 'visita_tecnica')
          sentOk = true
        } else {
          // Menu já apresentado (ou o cliente já digitou uma opção): responde
          // conforme a opção, sem reenviar saudação + menu.
          const replies = {
            1: 'Obrigado{{nome}}! Um atendente já foi acionado e vai te responder em instantes. Pode descrever sua necessidade aqui mesmo.',
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
