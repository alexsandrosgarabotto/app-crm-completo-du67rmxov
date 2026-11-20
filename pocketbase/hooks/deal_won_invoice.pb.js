/**
 * Venda Ganha → conta a receber automática no Financeiro (sem duplicar).
 *
 * Quando o estágio de um deal muda para 'won', cria automaticamente uma
 * invoice do tipo 'receivable' vinculada à venda (idempotente: procura por
 * notes contendo o marcador [DealWonId:<id>] antes de criar).
 *
 * Regras:
 * - Só reage quando o estágio novo é 'won' e o antigo era diferente.
 * - Valor default = deal.value (pode ser ajustado manualmente no Financeiro).
 * - Vencimento = hoje + 30 dias (ajustável no Financeiro).
 */
onRecordAfterUpdateSuccess((e) => {
  try {
    var deal = e.record
    var before = e.record.original()

    var novo = deal.getString('stage')
    var antigo = before.getString('stage')
    if (novo !== 'won' || antigo === 'won') return

    var dealId = deal.id
    var marcador = '[DealWonId:' + dealId + ']'

    // Idempotência: já existe conta a receber desta venda?
    var existentes = $app.findRecordsByFilter(
      'invoices',
      "notes ~ '" + marcador + "' && type = 'receivable'",
      '-created',
      1,
      0,
    )
    if (existentes && existentes.length > 0) {
      logInfo('deal won ' + dealId + ': conta a receber já existe (ignorado)')
      return
    }

    var hoje = new Date()
    var venc = new Date(hoje.getTime() + 30 * 24 * 3600 * 1000)
    var iso = function (d) {
      return d.toISOString().slice(0, 10)
    }

    var col = $app.findCollectionByNameOrId('invoices')
    var inv = new Record(col)
    inv.set('description', 'Recebimento venda: ' + deal.getString('title'))
    inv.set('type', 'receivable')
    inv.set('amount', deal.getFloat('value') || 0)
    inv.set('status', 'pending')
    inv.set('due_date', iso(venc))
    inv.set('client_id', deal.getString('client_id'))
    inv.set('deal_id', dealId)
    inv.set('category', 'Vendas')
    inv.set(
      'notes',
      'Gerada automaticamente pela venda marcada como Ganha no pipeline. ' + marcador,
    )
    inv.set('created_by', deal.getString('user_id'))
    $app.save(inv)

    logInfo('conta a receber criada para deal won ' + dealId)
  } finally {
    e.next()
  }
}, 'deals')
