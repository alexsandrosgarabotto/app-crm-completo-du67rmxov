//
// Notificação ao GESTOR — novo atendimento solicitado pelo bot do WhatsApp.
//
// Toda vez que um cliente solicita um atendimento pelo bot (opção 2 =
// orçamento, opção 3 = visita técnica), o número da EMPRESA envia uma
// mensagem ao gestor (key 'gestor_notify_number' em whatsapp_templates,
// default 66999830114) com cliente, telefone, tipo, data/horário e número
// da OS. Mesmo remetente e mesmo caminho de envio do bot (token próprio da
// Meta via Graph API; conector Skip como fallback, quando não há token).
//
// Regras:
// - GATILHO: somente OS criada pelo FLUXO DO BOT (conversation_id vinculado
//   à conversa + agenda gravada — createScheduledOrder do whatsapp.pb.js).
//   OS criada manualmente pela tela do CRM NÃO notifica (o frontend nunca
//   grava conversation_id; o gestor já vê a OS na Agenda).
// - FORA do modo de validação: a notificação é mensagem INTERNA ao gestor,
//   não é resposta automática ao cliente — não passa pelo filtro
//   validacao_apenas/validacao_numero. O destino é o gestor, não o cliente.
// - NÃO grava em whatsapp_messages: todo registro é obrigatoriamente
//   vinculado a uma conversa (conversation_id required) e aparecería na
//   conversa do cliente na tela de Atendimentos. A notificação fica apenas
//   no log do servidor ([gestor-notify]), com o texto completo enviado.
// - FAIL-SAFE: falha de envio (número inválido, erro da Meta) NÃO derruba
//   a criação da OS nem altera a resposta ao cliente — só loga.
// - IDEMPOTÊNCIA (reprocessamento de webhook): a reentrega do MESMO evento
//   já é barrada pelo índice único de mensagens (migração 0025). Se mesmo
//   assim uma OS duplicada for criada (mesma conversa + mesma agenda), a
//   notificação é pulada — checagem de OS existente antes de enviar.
//
// A JSVM roda os callbacks em um pool de VMs separado — funções de
// top-level não são visíveis dentro dos callbacks: toda a lógica é inline.
onRecordAfterCreateSuccess((e) => {
  const app = e.app
  const order = e.record

  try {
    // --- Gatilho: só OS do fluxo do bot do WhatsApp --------------------------
    const conversationId = String(order.get('conversation_id') || '')
    const scheduledDate = String(order.get('scheduled_date') || '')
    const agendamento = String(order.get('agendamento_para') || '')
    if (conversationId === '' || (scheduledDate === '' && agendamento === '')) return

    // --- Config (mesma leitura dos demais hooks) -----------------------------
    const logTag = String(order.get('number') || order.id)
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

    // Mesmo caminho de envio do bot: token próprio da Meta (Graph API) quando
    // configurado; sem token, conector Skip. Lança em caso de falha.
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
      // $http.send devolve { statusCode, raw, json, body (bytes) } — nunca
      // status_code; res.raw é o corpo. Sucesso: 2xx com "messages".
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

    // --- Dados da mensagem ----------------------------------------------------
    // Número do gestor: configurável (key 'gestor_notify_number'), com o
    // default pedido pelo dono.
    const gestorNumber = readConfig('gestor_notify_number') || '66999830114'
    if (!gestorNumber) {
      console.log(
        '[gestor-notify] OS ' + logTag + ': gestor_notify_number vazio — notificação pulada',
      )
      return
    }

    // Cliente: snapshot na OS, com fallback ao cadastro (mesma prioridade do bot).
    let clientRecord = null
    try {
      clientRecord = app.findRecordById('clients', order.get('client_id'))
    } catch (_) {}
    const clientName =
      String(order.get('client_name') || (clientRecord && clientRecord.get('name')) || '').trim() ||
      'não informado'
    const clientPhoneRaw = String(
      order.get('client_phone') || (clientRecord && clientRecord.get('phone')) || '',
    ).trim()
    const clientPhone = clientPhoneRaw || 'não informado'
    const tipo =
      String(order.get('order_type') || '') === 'visita_tecnica' ? 'Visita técnica' : 'Orçamento'

    // Agenda da OS: hora de parede LITERAL ('2026-11-19 08:00:00.000Z' =
    // 08:00 LOCAIS do negócio — convenção do bot desde a v0.0.49). Extrair
    // data/hora da string SEM converter fuso; fallback nos campos de texto
    // scheduled_date/scheduled_time gravados pelo bot.
    const formatAgendamentoLocal = (value) => {
      const raw = String(value || '')
      const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(raw)
      if (m) {
        return m[3] + '/' + m[2] + '/' + m[1] + ' às ' + m[4] + ':' + m[5]
      }
      return ''
    }
    let quando = formatAgendamentoLocal(agendamento)
    if (!quando && scheduledDate) {
      const d = scheduledDate.slice(0, 10)
      const t = String(order.get('scheduled_time') || '').trim()
      if (d.length === 10) {
        const parts = d.split('-')
        quando = parts[2] + '/' + parts[1] + '/' + parts[0] + (t ? ' às ' + t : '')
      }
    }
    if (!quando) quando = 'não informada'

    // --- Idempotência (reprocessamento) ---------------------------------------
    // OS duplicada = mesma conversa + mesma agenda (o bot nunca oferece duas
    // vezes o mesmo slot na mesma conversa). Se já existe outra OS igual, a
    // criação atual é reprocessamento: não notifica de novo.
    try {
      if (agendamento) {
        const duplicadas = app.findRecordsByFilter(
          'service_orders',
          'conversation_id = {:conv} && agendamento_para = {:ag} && id != {:id}',
          'created',
          1,
          0,
          { conv: conversationId, ag: agendamento, id: order.id },
        )
        if (duplicadas && duplicadas.length > 0) {
          console.log(
            '[gestor-notify] OS ' +
              logTag +
              ': OS duplicada da conversa (reprocessamento) — notificação ao gestor não reenviada',
          )
          return
        }
      }
    } catch (idemErr) {
      console.log('[gestor-notify] checagem de duplicidade falhou (segue com envio): ' + idemErr)
    }

    const texto =
      '🔔 Novo atendimento solicitado:\n' +
      'Cliente: ' +
      clientName +
      '\nTelefone: ' +
      clientPhone +
      '\nTipo: ' +
      tipo +
      '\nData: ' +
      quando +
      '\nOS: ' +
      String(order.get('number') || '—')

    // --- Envio fail-safe: a OS JÁ foi criada; nada aqui pode propagar erro ---
    try {
      const accessToken = readConfig('meta_access_token')
      const via = accessToken
        ? 'token próprio (' + maskToken(accessToken) + ')'
        : 'conector Skip (fallback, sem token configurado)'
      if (accessToken) {
        sendViaMetaGraphApi(gestorNumber, texto)
      } else {
        sendViaConnector(gestorNumber, texto)
      }
      console.log(
        '[gestor-notify] Meta: envio OK ao gestor (destinatário ' +
          toNumber(gestorNumber) +
          ', via ' +
          via +
          ')',
      )
    } catch (sendErr) {
      console.log(
        '[gestor-notify] envio ao gestor ' + toNumber(gestorNumber) + ' falhou: ' + sendErr,
      )
      return
    }

    // Registro da notificação apenas no log do servidor (o texto completo).
    console.log('[gestor-notify] notificação ao gestor:\n' + texto)
  } catch (err) {
    // A notificação ao gestor NUNCA derruba a criação da OS nem a resposta
    // ao cliente.
    console.log('[gestor-notify] notificação ao gestor não enviada:', err)
  } finally {
    // Todo caminho de saída (return precoce incluído) segue a cadeia de hooks.
    e.next()
  }
}, 'service_orders')
