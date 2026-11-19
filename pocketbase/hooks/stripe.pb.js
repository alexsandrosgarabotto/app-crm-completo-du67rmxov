/**
 * Integração de cobranças via Stripe + WhatsApp.
 *
 * Rotas (todas em /backend/v1/stripe/...):
 *  - POST /backend/v1/stripe/charge   — gera Checkout Session e salva o link na conta a receber
 *  - POST /backend/v1/stripe/webhook  — público (sem auth): auditoria + baixa automática
 *  - POST /backend/v1/stripe/notify   — envia o link de pagamento por WhatsApp (envio MANUAL do dono)
 *
 * A chave secreta do Stripe vive em app_config (key 'stripe_secret_key') e NUNCA
 * sai do backend — o frontend só recebe o link de pagamento e um status mascarado.
 *
 * O envio por WhatsApp é MANUAL (iniciado pelo dono) e NÃO passa pelo fail-safe
 * do modo de validação do bot — pode ir a qualquer cliente.
 */

const CHARGE_ROUTE = 'POST /backend/v1/stripe/charge'
const WEBHOOK_ROUTE = 'POST /backend/v1/stripe/webhook'
const NOTIFY_ROUTE = 'POST /backend/v1/stripe/notify'

/** Chaves reconhecidas como válidas para cobrança real. */
const SK_RE = /^sk_(live|test)_/

function getAppConfig(key) {
  try {
    const rec = app.findFirstRecordByFilter('app_config', `key = "${key}"`)
    return rec ? String(rec.getString('value') || '') : ''
  } catch (err) {
    return ''
  }
}

function jsonError(e, code, message) {
  return e.json(code, { error: message })
}

/** Formata valor em centavos para "R$ 1.234,56" (mensagens de WhatsApp). */
function formatBRL(cents) {
  const value = (Number(cents) || 0) / 100
  return (
    'R$ ' +
    value
      .toFixed(2)
      .replace('.', ',')
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  )
}

/** Normaliza telefone para o formato internacional exigido pela Meta (55DDN...). */
function normalizePhone(raw) {
  let p = String(raw || '').replace(/\D/g, '')
  if (!p) return ''
  if (p.length <= 11 && !p.startsWith('55')) p = '55' + p
  return p
}

// ---------------------------------------------------------------------------
// Envio de WhatsApp (cópia do mecanismo do whatsapp.pb.js / service_orders:
// Meta Graph API primária com token próprio, Zenvia como fallback).
// ---------------------------------------------------------------------------
function getTemplateValue(key) {
  try {
    const rec = app.findFirstRecordByFilter('whatsapp_templates', `key = "${key}"`)
    return rec ? String(rec.getString('value') || '') : ''
  } catch (err) {
    return ''
  }
}

function sendViaMetaGraph(accessToken, phoneNumberId, to, text) {
  const res = $http.send({
    url: `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: true, body: text },
    }),
    timeout: 20,
  })
  if (res.statusCode >= 200 && res.statusCode < 300) {
    return { ok: true }
  }
  const detail = (() => {
    try {
      const j = JSON.parse(res.raw)
      return (j && j.error && (j.error.message || j.error.type)) || `HTTP ${res.statusCode}`
    } catch (err) {
      return `HTTP ${res.statusCode}`
    }
  })()
  return { ok: false, error: `Meta: ${detail}` }
}

function sendViaZenvia(to, text) {
  const token = $os.getenv('ZENVIA_API_TOKEN')
  if (!token) {
    return { ok: false, error: 'Zenvia não configurada' }
  }
  const res = $http.send({
    url: 'https://api.zenvia.com/v2/channels/whatsapp/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-TOKEN': token,
    },
    body: JSON.stringify({
      from: $os.getenv('ZENVIA_FROM') || '',
      to,
      contents: [{ type: 'text', text }],
    }),
    timeout: 20,
  })
  if (res.statusCode >= 200 && res.statusCode < 300) {
    return { ok: true }
  }
  return { ok: false, error: `Zenvia HTTP ${res.statusCode}` }
}

/**
 * Envia texto por WhatsApp para um número. Meta primária (token próprio da
 * empresa salvo em whatsapp_templates), Zenvia como fallback. NÃO consulta o
 * modo de validação — envios de cobrança são manuais e vão a qualquer cliente.
 */
function sendWhatsAppText(to, text) {
  const target = normalizePhone(to)
  if (!target) {
    return { ok: false, error: 'sem telefone' }
  }

  const accessToken = getTemplateValue('meta_access_token')
  const phoneNumberId = getTemplateValue('phone_number_id')

  if (accessToken && phoneNumberId) {
    const meta = sendViaMetaGraph(accessToken, phoneNumberId, target, text)
    if (meta.ok) {
      return { ok: true, channel: 'meta' }
    }
    console.log(`stripe.pb.js: Meta falhou (${meta.error}), tentando Zenvia`)
  }

  const zenvia = sendViaZenvia(target, text)
  if (zenvia.ok) {
    return { ok: true, channel: 'zenvia' }
  }
  return { ok: false, error: zenvia.error || 'falha no envio' }
}

/**
 * Garante uma conversa de WhatsApp para o cliente e grava a mensagem como
 * outbound (mesma pattern do service_orders_whatsapp.pb.js).
 */
function recordOutbound(client, conversationId, text) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19) + '.000Z'

  let conversation = null
  try {
    conversation = app.findRecordById('whatsapp_conversations', conversationId)
  } catch (err) {
    conversation = null
  }

  if (!conversation) {
    conversation = app.newRecord('whatsapp_conversations', {
      contact_phone: String(client.getString('phone') || ''),
      contact_name: String(client.getString('name') || 'Cliente'),
      client_id: client.getId(),
      last_message_at: now,
      unread_count: 0,
      status: 'active',
    })
    app.save(conversation)
  }

  const msg = app.newRecord('whatsapp_messages', {
    conversation_id: conversation.getId(),
    client_id: client.getId(),
    direction: 'outbound',
    msg_type: 'text',
    body: text,
    timestamp: now,
    status: 'sent',
  })
  app.save(msg)

  conversation.set('last_message_at', now)
  app.save(conversation)

  return conversation.getId()
}

// ---------------------------------------------------------------------------
// Baixa no caixa: mesmo comportamento do handleTogglePaid do Financeiro.
// ---------------------------------------------------------------------------
function createCashEntryForReceivable(receivable) {
  // Idempotente: não duplicar lançamento se o webhook chegar duas vezes.
  const existing = app.findFirstRecordByFilter(
    'cash_movements',
    `description = "${String(receivable.getString('description') || '').replace(/"/g, '\\"')}" && date = "${receivable.getString('paid_date') || ''}" && type = "income"`,
  )
  if (existing) {
    return null
  }

  return app.save(
    app.newRecord('cash_movements', {
      description: receivable.getString('description'),
      type: 'income',
      amount: Number(receivable.getString('amount') || 0),
      date: receivable.getString('paid_date'),
      category: receivable.getString('category') || 'Recebimento Stripe',
      notes: `Recebido via Stripe (link de pagamento). Referência: ${receivable.getId()}`,
      invoice_id: receivable.getId(),
      created_by: receivable.getString('created_by'),
    }),
  )
}

function markReceivablePaidByWebhook(event) {
  const session = (event.data && event.data.object) || {}
  const clientRef = String(session.client_reference_id || '')
  const paymentIntent = String(
    session.payment_intent || session.paymentIntentId || session.id || '',
  )

  let receivable = null
  if (clientRef) {
    try {
      receivable = app.findRecordById('invoices', clientRef)
    } catch (err) {
      receivable = null
    }
  }
  if (!receivable && paymentIntent) {
    try {
      receivable = app.findFirstRecordByFilter(
        'invoices',
        `payment_intent_id = "${paymentIntent}" && type = "receivable"`,
      )
    } catch (err) {
      receivable = null
    }
  }
  if (!receivable || String(receivable.getString('type')) !== 'receivable') {
    console.log('stripe.pb.js: evento de pagamento sem conta a receber correspondente')
    return
  }
  if (String(receivable.getString('status')) === 'paid') {
    return // já processado
  }

  const today = new Date().toISOString().split('T')[0]
  receivable.set('status', 'paid')
  receivable.set('paid_date', today)
  receivable.set('payment_intent_id', paymentIntent || receivable.getString('payment_intent_id'))
  app.save(receivable)

  const cash = createCashEntryForReceivable(receivable)
  console.log(
    `stripe.pb.js: conta a receber ${receivable.getId()} marcada como paga${cash ? ' + lançamento no caixa' : ' (caixa já lançado)'}`,
  )
}

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

routerAdd(
  CHARGE_ROUTE,
  (e) => {
    const auth = e.auth
    if (!auth || String(auth.collection().name) !== 'users') {
      return jsonError(e, 401, 'Autenticação necessária')
    }

    let body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (err) {
      body = {}
    }
    const receivableId = String(body.receivableId || '')
    if (!receivableId) {
      return jsonError(e, 400, 'receivableId é obrigatório')
    }

    const secretKey = getAppConfig('stripe_secret_key')
    if (!secretKey) {
      return jsonError(
        e,
        401,
        'Chave secreta do Stripe não configurada. Cadastre-a em Configurações > Cobranças (Stripe).',
      )
    }
    if (!SK_RE.test(secretKey)) {
      return jsonError(
        e,
        400,
        'A chave salva não parece uma chave secreta do Stripe (sk_live_.../sk_test_...).',
      )
    }

    let receivable
    try {
      receivable = app.findRecordById('invoices', receivableId)
    } catch (err) {
      return jsonError(e, 404, 'Conta a receber não encontrada')
    }
    if (String(receivable.getString('type')) !== 'receivable') {
      return jsonError(e, 400, 'Só é possível cobrar contas a receber')
    }
    if (String(receivable.getString('status')) === 'paid') {
      return jsonError(e, 400, 'Esta conta já está paga')
    }

    const amountCents = Math.round(Number(receivable.getString('amount') || 0) * 100)
    if (amountCents <= 0) {
      return jsonError(e, 400, 'A conta precisa de um valor maior que zero')
    }

    const description = String(receivable.getString('description') || 'Pagamento')

    // Domínio do app (usado como success/cancel do checkout)
    const appUrl =
      $os.getenv('APP_PUBLIC_URL') ||
      (() => {
        const origin = e.request.header('origin') || ''
        if (origin) return origin
        const scheme = e.request.header('x-forwarded-proto') || 'http'
        const host = e.request.header('host') || ''
        return scheme + '://' + host
      })()

    let created = null
    try {
      const res = $http.send({
        url: 'https://api.stripe.com/v1/checkout/sessions',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new FormData({
          mode: 'payment',
          currency: 'brl',
          client_reference_id: receivableId,
          'line_items[0][quantity]': 1,
          'line_items[0][price_data][currency]': 'brl',
          'line_items[0][price_data][unit_amount]': String(amountCents),
          'line_items[0][price_data][product_data][name]': description.slice(0, 120),
          success_url: `${appUrl}/financeiro?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${appUrl}/financeiro?stripe=cancelado`,
        }),
        timeout: 25,
      })

      if (res.statusCode < 200 || res.statusCode >= 300) {
        const detail = (() => {
          try {
            const j = JSON.parse(res.raw)
            return (j && j.error && (j.error.message || j.error.type)) || `HTTP ${res.statusCode}`
          } catch (err) {
            return `HTTP ${res.statusCode}`
          }
        })()
        console.error(`stripe.pb.js: falha ao criar Checkout Session: ${detail}`)
        return jsonError(e, 502, `Stripe recusou a cobrança: ${detail}`)
      }

      created = JSON.parse(res.raw)
    } catch (err) {
      console.error('stripe.pb.js: erro ao chamar Stripe: ' + err)
      return jsonError(e, 502, 'Falha de comunicação com o Stripe')
    }

    const link = String(created.url || '')
    if (!link) {
      return jsonError(e, 502, 'Stripe não devolveu o link de pagamento')
    }

    try {
      receivable.set('payment_provider', 'stripe')
      receivable.set('payment_link_url', link)
      if (created.payment_intent) {
        receivable.set('payment_intent_id', String(created.payment_intent))
      }
      receivable.set('payment_status', 'Aguardando pagamento (Stripe)')
      app.save(receivable)
    } catch (err) {
      console.error('stripe.pb.js: erro ao salvar link na conta: ' + err)
      return jsonError(e, 500, 'Link gerado, mas não foi possível salvar na conta a receber')
    }

    return e.json(200, {
      id: created.id,
      url: link,
      paymentIntentId: String(created.payment_intent || ''),
      amountFormatted: formatBRL(amountCents),
    })
  },
  /* requiresAuth */ null,
)

routerAdd(
  WEBHOOK_ROUTE,
  (e) => {
    // Rota PÚBLICA (sem auth) chamada pelo Stripe.
    const raw = e.request.body ? String(e.request.body) : ''
    let event = {}
    try {
      event = JSON.parse(raw)
    } catch (err) {
      // Mesmo sem JSON válido, responde 200 para não gerar retentativas inúteis.
      return e.json(200, { received: true })
    }

    const eventType = String(event.type || '')
    try {
      app.save(
        app.newRecord('stripe_webhook_events', {
          event_type: eventType,
          payload: raw,
        }),
      )
    } catch (err) {
      console.error('stripe.pb.js: falha ao gravar evento de webhook: ' + err)
    }

    if (eventType === 'checkout.session.completed' || eventType === 'payment_intent.succeeded') {
      try {
        markReceivablePaidByWebhook(event)
      } catch (err) {
        console.error('stripe.pb.js: erro ao processar pagamento: ' + err)
      }
    }

    return e.json(200, { received: true })
  },
  /* requiresAuth */ null,
)

routerAdd(
  NOTIFY_ROUTE,
  (e) => {
    const auth = e.auth
    if (!auth || String(auth.collection().name) !== 'users') {
      return jsonError(e, 401, 'Autenticação necessária')
    }

    let body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (err) {
      body = {}
    }
    const receivableId = String(body.receivableId || '')
    if (!receivableId) {
      return jsonError(e, 400, 'receivableId é obrigatório')
    }

    let receivable
    try {
      receivable = app.findRecordById('invoices', receivableId)
    } catch (err) {
      return jsonError(e, 404, 'Conta a receber não encontrada')
    }

    const link = String(receivable.getString('payment_link_url') || '')
    if (!link) {
      return jsonError(
        e,
        400,
        'Esta conta ainda não tem link de cobrança. Gere a cobrança primeiro.',
      )
    }

    let client = null
    try {
      client = app.findRecordById('clients', receivable.getString('client_id'))
    } catch (err) {
      client = null
    }
    if (!client) {
      return jsonError(
        e,
        400,
        'A conta não tem cliente vinculado — cadastre o cliente para enviar por WhatsApp',
      )
    }
    const phone = String(client.getString('phone') || '')
    if (!phone) {
      return jsonError(e, 400, 'O cliente não tem telefone cadastrado')
    }

    const clientName = String(client.getString('name') || '').split(' ')[0] || 'cliente'
    const amount = formatBRL(Math.round(Number(receivable.getString('amount') || 0) * 100))
    const description = String(receivable.getString('description') || 'serviço prestado')
    const message = `Olá ${clientName}! Segue o link para pagamento de ${amount} referente a ${description}: ${link}`

    const sent = sendWhatsAppText(phone, message)
    if (!sent.ok) {
      return jsonError(e, 502, `Falha ao enviar pelo WhatsApp: ${sent.error}`)
    }

    let conversationId = ''
    try {
      conversationId = String(
        recordOutbound(client, receivable.getString('conversation_id') || '', message),
      )
    } catch (err) {
      console.error('stripe.pb.js: mensagem enviada, mas falha ao gravar histórico: ' + err)
    }

    return e.json(200, {
      ok: true,
      channel: sent.channel,
      conversationId,
      message,
    })
  },
  /* requiresAuth */ null,
)
