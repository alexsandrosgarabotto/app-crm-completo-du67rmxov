/// <reference path="../pb_data/types.d.ts" />

/**
 * Aviso de Ordem de Serviço por WhatsApp (v0.0.36)
 * ------------------------------------------------
 * A cada CRIAÇÃO e CADA mudança de status de uma OS (service_orders), o
 * cliente recebe uma mensagem de texto simples pelo canal Meta já usado no
 * atendimento (token próprio da Meta, key 'meta_access_token' em
 * whatsapp_templates; Phone Number ID oficial na key 'phone_number_id' —
 * o mesmo caminho do hook whatsapp.pb.js; sem Zenvia).
 *
 * Regras:
 * - Mensagens de TEXTO dentro da janela de 24h (última mensagem inbound da
 *   conversa). Sem conversa recente: o aviso é pulado com log — a OS NÃO falha.
 * - RESPEITA O MODO DE VALIDAÇÃO: enquanto 'validacao_apenas' = 'true',
 *   só o número autorizado ('validacao_numero') recebe os avisos — mesma
 *   comparação do hook de atendimento (DDD + últimos 8 dígitos, helper
 *   samePhone). Outros clientes: OS atualizada normalmente, sem envio, com
 *   log "Modo validação: aviso de OS não enviado para {numero}".
 * - A mensagem enviada é gravada na conversa do cliente (outbound, origin
 *   'os') e no histórico da OS (historico[].aviso_whatsapp).
 *
 * IMPORTANTE: a JSVM do PocketBase roda os callbacks em um pool de VMs
 * separado — funções de top-level não são visíveis dentro dos callbacks.
 * Toda a lógica fica inline no próprio callback.
 */

routerAdd(
  'POST',
  '/backend/v1/crm/service-orders/{id}/notice',
  (e) => {
    const app = e.app
    const info = e.requestInfo()
    if (!info.auth) {
      throw new UnauthorizedError('Faça login no CRM para atualizar a ordem de serviço')
    }

    const orderId = e.request.pathValue('id')
    const body = info.body || {}
    const novoStatus = String(body.status || '').trim()

    const order = app.findRecordById('service_orders', orderId)

    // --- Config (mesma leitura do hook de atendimento) -----------------------
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

    const normalizePhone = (raw) => {
      let digits = String(raw || '').replace(/\D/g, '')
      if (!digits) return ''
      if (digits.startsWith('55') && digits.length > 11) {
        digits = digits.slice(2)
      }
      return digits
    }

    // Mesmo critério do hook de atendimento: mesmo DDD + mesmos últimos 8
    // dígitos (cobre a variação do nono dígito da Meta, 12 vs 13 dígitos).
    const samePhone = (a, b) => {
      const da = String(a || '')
      const db = String(b || '')
      if (!da || !db) return false
      if (da === db) return true
      if (da.length < 10 || db.length < 10) return false
      if (da.slice(0, 2) !== db.slice(0, 2)) return false
      return da.slice(-8) === db.slice(-8)
    }

    const toNumber = (raw) => {
      let digits = String(raw || '').replace(/\D/g, '')
      if (digits && digits.length <= 11) {
        digits = '55' + digits
      }
      return digits
    }

    const maskToken = (token) => {
      const t = String(token || '')
      return t.length > 4 ? '...' + t.slice(-4) : '***'
    }

    // --- Envio pelo canal Meta (idêntico ao whatsapp.pb.js) ------------------
    const sendViaMetaGraphApi = (to, text) => {
      const phoneNumberId = readConfig('phone_number_id')
      const accessToken = readConfig('meta_access_token')
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
      const status = res.statusCode || 0
      const rawBody = String(res.raw || '')
      if (status < 200 || status >= 300 || rawBody.indexOf('"messages"') === -1) {
        throw new Error('Graph API respondeu status ' + status + ': ' + (rawBody || 'sem corpo'))
      }
      return res
    }

    const sendViaConnector = (to, text) => {
      const phoneNumberId = readConfig('phone_number_id')
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

    const sendWhatsApp = (to, text) => {
      const accessToken = readConfig('meta_access_token')
      const via = accessToken
        ? 'token próprio (' + maskToken(accessToken) + ')'
        : 'conector Skip (fallback, sem token configurado)'
      const result = accessToken ? sendViaMetaGraphApi(to, text) : sendViaConnector(to, text)
      console.log(
        '[os-whatsapp] Meta: envio OK (destinatário ' + toNumber(to) + ', via ' + via + ')',
      )
      return result
    }

    // --- Cliente e conversa --------------------------------------------------
    let clientRecord = null
    try {
      clientRecord = app.findRecordById('clients', order.get('client_id'))
    } catch (_) {}

    const rawPhone = String((clientRecord && clientRecord.get('phone')) || '')

    // Conversa do cliente (a mesma usada pelo atendimento automático).
    let conversation = null
    if (String(order.get('conversation_id') || '') !== '') {
      try {
        conversation = app.findRecordById('whatsapp_conversations', order.get('conversation_id'))
      } catch (_) {}
    }
    if (!conversation && rawPhone) {
      const target = normalizePhone(rawPhone)
      try {
        const found = app.findRecordsByFilter(
          'whatsapp_conversations',
          'client_id = {:clientId}',
          '-created',
          20,
          0,
          { clientId: clientRecord.id },
        )
        for (const record of found) {
          if (samePhone(normalizePhone(record.get('phone')), target)) {
            conversation = record
            break
          }
        }
      } catch (_) {}
    }

    // --- Texto do aviso ------------------------------------------------------
    const statusMessages = {
      aberta:
        'Recebemos seu pedido! Sua ordem de serviço {numero} foi aberta. Em breve entraremos em contato.',
      agendada:
        'Sua ordem de serviço {numero} foi AGENDADA{quando}. Nossa equipe comparecerá no horário combinado.',
      em_andamento:
        'Boa notícia, {primeiro_nome}! Sua ordem de serviço {numero} está EM ANDAMENTO. Nossa equipe já está trabalhando nela.',
      concluida:
        'Sua ordem de serviço {numero} foi CONCLUÍDA. Obrigado pela confiança! Qualquer dúvida, responda esta mensagem.',
      finalizada:
        'Sua ordem de serviço {numero} foi CONCLUÍDA. Obrigado pela confiança! Qualquer dúvida, responda esta mensagem.',
      aguardando_peca:
        'Sua ordem de serviço {numero} está AGUARDANDO PEÇA. Assim que chegar, retomamos o atendimento e avisamos você.',
      cancelada:
        'Sua ordem de serviço {numero} foi CANCELADA. Se não reconheceu esse cancelamento, fale com a nossa equipe.',
    }
    const fallbackMessage =
      'Atualização da sua ordem de serviço {numero}: novo status {status_label}.'

    const clientName = String((clientRecord && clientRecord.get('name')) || '').trim()
    const primeiroNome = clientName.split(' ')[0] || ''

    const buildMessage = (statusKey, orderNumber, agendamento) => {
      const statusLabels = {
        aberta: 'aberta',
        agendada: 'agendada',
        em_andamento: 'em andamento',
        aguardando_peca: 'aguardando peça',
        concluida: 'concluída',
        finalizada: 'concluída',
        cancelada: 'cancelada',
      }
      let text = statusMessages[statusKey] || fallbackMessage
      let quando = ''
      if (agendamento) {
        try {
          const d = new Date(agendamento)
          quando =
            ' para ' +
            d.toLocaleDateString('pt-BR') +
            ' às ' +
            d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        } catch (_) {}
      }
      return String(text)
        .replace(/\{\{\s*nome\s*\}\}/g, primeiroNome ? primeiroNome : 'cliente')
        .replace(/\{\{primeiro_nome\}\}/g, primeiroNome ? ', ' + primeiroNome : '')
        .replace(/\{\{numero\}\}/g, orderNumber)
        .replace(/\{\{quando\}\}/g, quando)
        .replace(/\{\{status_label\}\}/g, statusLabels[statusKey] || statusKey)
    }

    // --- Monta a resposta ----------------------------------------------------
    // 'aplicar' false: valida sem gravar (a gravação da OS fica por conta da UI).
    const aplicar = body.aplicar === false ? false : true
    const statusAtual = String(order.get('status') || '')
    const statusNovo = novoStatus || statusAtual
    const agendamento = body.agendamento_para || order.get('agendamento_para') || ''
    const orderNumber = String(order.get('number') || 'OS-0000')
    const avisoTexto = buildMessage(statusNovo, orderNumber, agendamento)

    const response = {
      ok: true,
      order_id: order.id,
      numero: orderNumber,
      aviso_texto: avisoTexto,
      enviado: false,
      motivo: '',
    }

    if (!aplicar) {
      return e.json(200, response)
    }

    // --- Grava a mudança no histórico da OS ----------------------------------
    const userName = String((info.auth && info.auth.get('name')) || '')
    const entry = {
      de: statusAtual,
      para: statusNovo,
      por: info.auth.id,
      por_nome: userName,
      quando: new Date().toISOString(),
      aviso_whatsapp: '',
    }

    // --- Envio (modo de validação + janela de 24h) ---------------------------
    let avisoStatus = 'não enviado'
    const validacaoApenas = readConfig('validacao_apenas').toLowerCase() === 'true'
    const validacaoNumero = String(readConfig('validacao_numero') || '').replace(/\D/g, '')

    if (!rawPhone) {
      response.motivo = 'Cliente sem telefone cadastrado — aviso não enviado.'
      console.log('[os-whatsapp] OS ' + orderNumber + ': cliente sem telefone — aviso não enviado')
    } else if (
      validacaoApenas &&
      !samePhone(normalizePhone(rawPhone), normalizePhone(validacaoNumero))
    ) {
      response.motivo = 'Modo validação'
      console.log(
        '[os-whatsapp] Modo validação: aviso de OS não enviado para ' + toNumber(rawPhone),
      )
    } else {
      // Janela de 24h: alguma mensagem inbound recente na conversa?
      let inboundRecente = false
      if (conversation) {
        const limite = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const lastInbound = String(conversation.get('last_inbound_at') || '')
        if (lastInbound) {
          try {
            inboundRecente = new Date(lastInbound) >= limite
          } catch (_) {}
        }
      }
      if (!conversation) {
        response.motivo = 'Sem conversa no WhatsApp para este cliente'
        console.log(
          '[os-whatsapp] OS ' + orderNumber + ': sem conversa no WhatsApp — aviso não enviado',
        )
      } else if (!inboundRecente) {
        response.motivo = 'Fora da janela de 24h'
        console.log(
          '[os-whatsapp] OS ' +
            orderNumber +
            ': fora da janela de 24h (última mensagem recebida há mais de 24h) — aviso de OS não enviado',
        )
      } else {
        try {
          sendWhatsApp(rawPhone, avisoTexto)

          // Grava a mensagem outbound na conversa do cliente.
          const messagesCollection = app.findCollectionByNameOrId('whatsapp_messages')
          const outboundRecord = new Record(messagesCollection)
          outboundRecord.set('conversation_id', conversation.id)
          outboundRecord.set('direction', 'outbound')
          outboundRecord.set('origin', 'os')
          outboundRecord.set('body', avisoTexto)
          outboundRecord.set('sent_by', info.auth.id)
          app.save(outboundRecord)

          conversation.set('last_message', avisoTexto)
          conversation.set('last_message_at', new Date().toISOString())
          conversation.set('unread_count', 0)
          app.save(conversation)

          avisoStatus = 'enviado'
          response.enviado = true
        } catch (sendErr) {
          response.motivo = 'Falha no envio: ' + String(sendErr)
          // O aviso NÃO derruba a operação: a OS segue atualizada.
          console.log('[os-whatsapp] aviso de OS não enviado (' + sendErr + ')')
        }
      }
    }

    entry.aviso_whatsapp = avisoStatus
    const historico = Array.isArray(order.get('historico')) ? order.get('historico') : []
    historico.push(entry)
    const payload = { historico: historico }
    if (statusNovo !== statusAtual) {
      payload.status = statusNovo
      if (statusNovo === 'concluida' || statusNovo === 'finalizada') {
        payload.finished_at = new Date().toISOString()
      }
    }
    if (agendamento) {
      payload.agendamento_para = agendamento
    }
    order.set('status', payload.status || statusAtual)
    if (payload.finished_at) order.set('finished_at', payload.finished_at)
    if (payload.agendamento_para) order.set('agendamento_para', payload.agendamento_para)
    order.set('historico', historico)
    app.save(order)

    response.historico = historico
    response.status = order.get('status')
    return e.json(200, response)
  } /* middlewares */,
)
