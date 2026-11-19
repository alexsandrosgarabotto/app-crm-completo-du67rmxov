//
// Cobranças Stripe do CRM (Skip Cloud, PocketBase JSVM).
//
// Fluxo:
//  1. POST /backend/v1/stripe/charge  (autenticado): cria uma Checkout Session
//     na CONTA STRIPE DO BUILDER via conector Skip ($connectors.executeAsOwner),
//     grava o link na conta a receber e envia o link por WhatsApp ao cliente
//     (Meta primária via token próprio, conector Skip como fallback).
//  2. POST /backend/v1/stripe/webhook (público, protegido por token): Stripe
//     avisa o pagamento; a conta a receber vira PAGA e o valor entra no Caixa.
//     Idempotente pela coleção stripe_webhook_events.
//  3. GET  /backend/v1/stripe/config  (autenticado): devolve a URL do webhook
//     (com token) para o card de Configurações exibir/copiar.
//
// Observações JSVM:
//  - record.id é propriedade simples (NUNCA .getId()).
//  - $http.send devolve { statusCode, raw, json, body(bytes) } — nunca status_code.
//  - $apis.requestInfo(e) dá acesso a { body, query, auth } nas rotas custom.
//

var STRIPE_CHECKOUT_ACTION = 'STRIPE_CREATE_CHECKOUT_SESSION'
var WHATSAPP_SEND_ACTION = 'WHATSAPP_SEND_MESSAGE'
var GRAPH_VERSION = 'v20.0'

function logInfo(msg) {
  console.log('[stripe] ' + msg)
}

function logErr(msg) {
  console.error('[stripe] ' + msg)
}

function slug(v) {
  return v === undefined || v === null ? '' : String(v)
}

// ---------------------------- utilitários de banco -------------------------

function findInvoice(id) {
  try {
    return $app.findFirstRecordByFilter('invoices', "id = '" + slug(id) + "'")
  } catch (err) {
    return null
  }
}

function getAppConfig(key) {
  try {
    var rec = $app.findFirstRecordByFilter('app_config', "key = '" + key + "'")
    return rec.getString('value')
  } catch (err) {
    return ''
  }
}

function setAppConfig(key, value) {
  var existing = null
  try {
    existing = $app.findFirstRecordByFilter('app_config', "key = '" + key + "'")
  } catch (err) {
    existing = null
  }
  if (existing) {
    existing.set('value', value)
    $app.save(existing)
    return existing
  }
  var col = $app.findCollectionByNameOrId('app_config')
  var rec = new Record(col)
  rec.set('key', key)
  rec.set('value', value)
  $app.save(rec)
  return rec
}

function ensureWebhookToken() {
  var token = getAppConfig('stripe_webhook_token')
  if (token) return token
  var generated = ''
  try {
    generated = $security.randomString(24)
  } catch (err) {
    generated = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  }
  setAppConfig('stripe_webhook_token', generated)
  logInfo('token de webhook gerado')
  return generated
}

function requestOrigin(e) {
  var url = slug(e && e.request && e.request.url)
  var m = url.match(/^https?:\/\/[^\/]+/)
  return m ? m[0] : ''
}

// ---------------------------- WhatsApp (envio do link) --------------------

function normalizePhone(raw) {
  var digits = slug(raw).replace(/[^0-9]/g, '')
  if (!digits) return ''
  // BR local (DDD + 8/9 dígitos) → prefixa 55
  if (digits.length === 10 || digits.length === 11) return '55' + digits
  return digits
}

function getWaTemplate(key) {
  try {
    var rec = $app.findFirstRecordByFilter('whatsapp_templates', "key = '" + key + "'")
    return rec.getString('body')
  } catch (err) {
    return ''
  }
}

function sendViaMeta(phone, body) {
  var token = getWaTemplate('meta_access_token')
  var phoneId = getWaTemplate('phone_number_id')
  if (!token || !phoneId) return null
  try {
    return $http.send({
      url: 'https://graph.facebook.com/' + GRAPH_VERSION + '/' + phoneId + '/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: body },
      }),
    })
  } catch (err) {
    logErr('falha Graph API: ' + err)
    return null
  }
}

function ensureConversation(phone, clientId) {
  var conv = null
  try {
    conv = $app.findFirstRecordByFilter('whatsapp_conversations', "phone = '" + phone + "'")
  } catch (err) {
    conv = null
  }
  if (conv) return conv
  var col = $app.findCollectionByNameOrId('whatsapp_conversations')
  conv = new Record(col)
  conv.set('phone', phone)
  conv.set('status', 'aberto')
  if (clientId) conv.set('client_id', clientId)
  try {
    $app.save(conv)
  } catch (err) {
    logErr('falha ao criar conversa: ' + err)
    return null
  }
  return conv
}

function registerOutbound(phone, body, clientId, userId) {
  try {
    var conv = ensureConversation(phone, clientId)
    if (!conv) return
    var col = $app.findCollectionByNameOrId('whatsapp_messages')
    var rec = new Record(col)
    rec.set('conversation_id', conv.id)
    rec.set('direction', 'outbound')
    rec.set('origin', 'auto')
    rec.set('body', body)
    rec.set('msg_type', 'text')
    if (userId) rec.set('sent_by', userId)
    $app.save(rec)
    conv.set('last_message', body)
    conv.set('last_message_at', new Date().toISOString())
    $app.save(conv)
  } catch (err) {
    logErr('falha ao registrar mensagem outbound: ' + err)
  }
}

function sendPaymentLink(phone, clientName, description, amount, linkUrl, userId) {
  var valor = 'R$ ' + amount.toFixed(2).replace('.', ',')
  var primeiro = clientName ? clientName.split(' ')[0] + ', ' : ''
  var body =
    '*Cobrança* - ' +
    slug(description).slice(0, 80) +
    '\n' +
    'Valor: *' +
    valor +
    '*\n\n' +
    primeiro +
    'segue o link seguro de pagamento (Pix, boleto ou cartão):\n' +
    linkUrl +
    '\n\n' +
    'Assim que o pagamento for confirmado, já damos baixa por aqui. Obrigado!'

  var meta = sendViaMeta(phone, body)
  if (meta && meta.statusCode >= 200 && meta.statusCode < 300) {
    logInfo('Meta: envio OK para ' + phone)
    registerOutbound(phone, body, '', userId)
    return true
  }
  if (meta) {
    logInfo('Meta falhou (status ' + meta.statusCode + '), tentando conector Skip')
  }
  try {
    // Conector Skip é fallback; chaves redundantes cobrem variações do toolkit.
    var res = $connectors.executeAsOwner(WHATSAPP_SEND_ACTION, {
      phone_number: phone,
      phone: phone,
      to: phone,
      message: body,
      text: body,
    })
    if (res && res.successful) {
      logInfo('Conector Skip: envio OK para ' + phone)
      registerOutbound(phone, body, '', userId)
      return true
    }
    logErr('conector Skip falhou: ' + slug(res && res.error))
  } catch (err) {
    logErr('exceção no conector Skip: ' + err)
  }
  return false
}

// ---------------------------- Stripe (conector Skip) ----------------------

function extractData(res) {
  var d = res && res.data
  if (d && d.data && typeof d.data === 'object') d = d.data
  return d || {}
}

function publicInvoice(inv) {
  return {
    id: inv.id,
    description: inv.getString('description'),
    type: inv.getString('type'),
    amount: inv.getFloat('amount'),
    status: inv.getString('status'),
    due_date: inv.getString('due_date'),
    paid_date: inv.getString('paid_date'),
    client_id: inv.getString('client_id'),
    deal_id: inv.getString('deal_id'),
    payment_provider: inv.getString('payment_provider'),
    payment_link_url: inv.getString('payment_link_url'),
    payment_intent_id: inv.getString('payment_intent_id'),
    paid_at: inv.getString('paid_at'),
  }
}

// ---------------------------- rotas ---------------------------------------

// Cria a cobrança (Checkout Pix/boleto/cartão) e envia o link por WhatsApp.
routerAdd(
  'POST',
  '/backend/v1/stripe/charge',
  (e) => {
    var info = $apis.requestInfo(e)
    var data = info.body || {}
    var auth = info.auth
    var invoiceId = slug(data.invoice_id).trim()
    if (!invoiceId) {
      return e.json(400, { error: 'invoice_id é obrigatório' })
    }

    var inv = findInvoice(invoiceId)
    if (!inv) {
      return e.json(404, { error: 'Conta a receber não encontrada' })
    }
    if (inv.getString('type') !== 'receivable') {
      return e.json(400, { error: 'Somente contas a receber podem ser cobradas via Stripe' })
    }
    if (inv.getString('status') === 'paid') {
      return e.json(400, { error: 'Esta conta já está paga' })
    }

    var clientId = inv.getString('client_id')
    var phone = normalizePhone(data.phone)
    var clientName = ''
    if (clientId) {
      try {
        var c = $app.findRecordById('clients', clientId)
        clientName = c.getString('name')
        if (!phone) phone = normalizePhone(c.getString('phone'))
      } catch (err) {
        logErr('cliente ' + clientId + ' não encontrado: ' + err)
      }
    }
    if (!phone) {
      return e.json(400, {
        error:
          'Cliente sem telefone para enviar o WhatsApp. Cadastre um número ou informe um telefone válido.',
      })
    }

    var amount = inv.getFloat('amount')
    if (amount <= 0) {
      return e.json(400, { error: 'Valor da conta inválido para cobrança' })
    }
    var description = inv.getString('description') || 'Cobrança'
    var linkUrl = inv.getString('payment_link_url')
    var sessionId = inv.getString('payment_intent_id')

    if (!linkUrl) {
      var origin = requestOrigin(e)
      var args = {
        mode: 'payment',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'brl',
              unit_amount: Math.round(amount * 100),
              product_data: { name: description.slice(0, 120) },
            },
          },
        ],
        metadata: { invoice_id: invoiceId },
        client_reference_id: invoiceId,
        success_url: origin + '/?stripe=pago',
        cancel_url: origin + '/?stripe=cancelado',
      }
      var res = null
      try {
        res = $connectors.executeAsOwner(STRIPE_CHECKOUT_ACTION, args)
      } catch (err) {
        logErr('exceção criando checkout: ' + err)
        return e.json(502, { error: 'Falha ao falar com o Stripe: ' + err })
      }
      if (!res || !res.successful) {
        var msg = res && res.error ? res.error.message || slug(res.error) : 'erro desconhecido'
        logInfo('checkout falhou: ' + msg)
        return e.json(502, { error: 'Falha ao criar cobrança no Stripe: ' + msg })
      }
      var session = extractData(res)
      linkUrl = session.url || session.payment_url || ''
      sessionId = session.id || ''
      if (!linkUrl) {
        logInfo('checkout sem url: ' + JSON.stringify(session).slice(0, 300))
        return e.json(502, { error: 'Stripe não retornou URL de pagamento' })
      }
      inv.set('payment_provider', 'stripe')
      inv.set('payment_link_url', linkUrl)
      inv.set('payment_intent_id', sessionId)
      $app.save(inv)
      logInfo('checkout criado para invoice ' + invoiceId + ': ' + linkUrl)
    }

    var sent = sendPaymentLink(phone, clientName, description, amount, linkUrl, auth ? auth.id : '')
    return e.json(200, {
      invoice: publicInvoice(inv),
      checkout_url: linkUrl,
      whatsapp_to: phone,
      whatsapp_sent: sent,
    })
  },
  $apis.requireAuth(),
)

// Webhook público do Stripe (registrar no painel Stripe com ?token=...).
routerAdd('POST', '/backend/v1/stripe/webhook', (e) => {
  var info = $apis.requestInfo(e)
  var token = getAppConfig('stripe_webhook_token')
  if (token) {
    var q = info.query || {}
    var given = typeof q.get === 'function' ? q.get('token') || '' : q['token'] || ''
    if (given !== token) {
      return e.json(401, { error: 'token do webhook inválido' })
    }
  } else {
    logInfo('atenção: webhook sem token configurado (acesse Configurações para gerar)')
  }

  var event = info.body || {}
  var eventId = slug(event.id)
  var type = slug(event.type)
  if (!eventId || !type) {
    return e.json(200, { ok: true, ignored: 'payload sem id/type' })
  }

  // Idempotência: eventos já processados são ignorados.
  var existing = null
  try {
    existing = $app.findFirstRecordByFilter('stripe_webhook_events', "event_id = '" + eventId + "'")
  } catch (err) {
    existing = null
  }
  if (existing) {
    return e.json(200, { ok: true, duplicate: true })
  }

  var evCol = $app.findCollectionByNameOrId('stripe_webhook_events')
  var evRec = new Record(evCol)
  evRec.set('event_id', eventId)
  evRec.set('event_type', type)
  evRec.set('processed', false)
  try {
    evRec.set('payload', JSON.stringify(event))
  } catch (err) {
    evRec.set('payload', '{}')
  }
  $app.save(evRec)

  if (
    type === 'checkout.session.completed' ||
    type === 'checkout.session.async_payment_succeeded'
  ) {
    var session = (event.data && event.data.object) || {}
    var invId =
      (session.metadata && session.metadata.invoice_id) || slug(session.client_reference_id)
    if (invId) {
      markInvoicePaid(invId, session)
    }
  }

  evRec.set('processed', true)
  $app.save(evRec)
  return e.json(200, { ok: true })
})

// ---------------------------- venda ganha → conta a receber ---------------
// (Definido em deals_won.pb.js — separado deste hook para manter arquivos pequenos.)

// Configurações: URL do webhook (com token) para exibir/copiar no card.
routerAdd(
  'GET',
  '/backend/v1/stripe/config',
  (e) => {
    var token = ensureWebhookToken()
    var origin = requestOrigin(e)
    if (!origin) {
      origin = $os.getenv('BACKEND_PUBLIC_URL') || ''
    }
    return e.json(200, {
      webhook_url: origin + '/backend/v1/stripe/webhook?token=' + token,
      token: token,
      ready: true,
    })
  },
  $apis.requireAuth(),
)

// ---------------------------- baixa no caixa -------------------------------

function methodFromSession(session) {
  var types = session && session.payment_method_types
  var first = types && types.length ? slug(types[0]) : ''
  if (first === 'pix') return 'pix'
  if (first === 'boleto') return 'boleto'
  if (first === 'card') return 'cartao'
  return 'outros'
}

function markInvoicePaid(invId, session) {
  var inv = findInvoice(invId)
  if (!inv) {
    logInfo('webhook: invoice ' + invId + ' não encontrada')
    return
  }
  if (inv.getString('status') === 'paid') {
    logInfo('webhook: invoice ' + invId + ' já estava paga (ignorado)')
    return
  }
  var hoje = new Date().toISOString().slice(0, 10)
  var amount = session.amount_total ? session.amount_total / 100 : inv.getFloat('amount')

  inv.set('status', 'paid')
  inv.set('paid_date', hoje)
  inv.set('paid_at', new Date().toISOString())
  $app.save(inv)

  try {
    var col = $app.findCollectionByNameOrId('cash_movements')
    var rec = new Record(col)
    rec.set('date', hoje)
    rec.set('type', 'entry')
    rec.set(
      'description',
      'Recebimento Stripe: ' + (inv.getString('description') || 'conta a receber'),
    )
    rec.set('amount', amount)
    rec.set('payment_method', methodFromSession(session))
    rec.set('invoice_id', inv.id)
    $app.save(rec)
    logInfo('entrada no caixa registrada: ' + amount)
  } catch (err) {
    logErr('falha ao lançar entrada no caixa: ' + err)
  }
  logInfo('invoice ' + invId + ' marcada como paga via Stripe')
}
