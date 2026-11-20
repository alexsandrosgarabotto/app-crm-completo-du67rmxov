//
// Ordem de Serviço finalizada → LANÇAMENTOS DE CUSTO no Financeiro.
//
// A conta a receber do cliente continua sendo criada pelo frontend
// (serviceOrdersService.finalize). Este hook cria, uma única vez por OS,
// as despesas/custos do serviço em "invoices" (type=payable), que o módulo
// Financeiro já trata: total a pagar, marcação manual de pagamento e
// lançamento automático no Controle de Caixa (invoicesService.updateStatus).
//
// Custos criados:
//  - Materiais/produtos usados (itens da OS que dão baixa no estoque):
//    custo = cost_price do produto x quantidade (fallback: sale_price).
//  - Mão de obra/serviços: custo = total_price do item de serviço quando
//    a OS não é apenas orçamento, se houver campo de custo informado.
//
// Idempotência: procura por notes contendo [OSCost:<id da OS>]; se qualquer
// lançamento de custo desta OS já existir, não cria nenhum novo.
//
onRecordAfterUpdateSuccess((e) => {
  try {
    var order = e.record
    var before = order.original()

    // Reage só quando a OS ENTRA em 'finalizada' nesta atualização.
    if (order.getString('status') !== 'finalizada') return
    if (before.getString('status') === 'finalizada') return

    var orderId = order.id
    var marcador = '[OSCost:' + orderId + ']'

    // Idempotência: já existem os custos desta OS?
    var existentes = $app.findRecordsByFilter(
      'invoices',
      "notes ~ '" + marcador + "' && type = 'payable'",
      '-created',
      1,
      0,
    )
    if (existentes && existentes.length > 0) {
      logInfo('OS ' + orderId + ': lançamentos de custo já existem (ignorado)')
      return
    }

    // Itens da OS (JSONField chega como array de bytes UTF-8 no JSVM).
    var items = []
    var rawItems = order.get('items')
    if (rawItems) {
      try {
        var text = ''
        if (typeof rawItems === 'string') {
          text = rawItems
        } else {
          var bytes = new Uint8Array(rawItems)
          text = new TextDecoder('utf-8').decode(bytes)
        }
        var parsed = JSON.parse(text)
        if (Object.prototype.toString.call(parsed) === '[object Array]') items = parsed
      } catch (err) {
        logInfo('OS ' + orderId + ': itens ilegíveis, sem lançamento de custo — ' + err)
        return
      }
    }

    var hoje = new Date().toISOString().slice(0, 10)
    var col = $app.findCollectionByNameOrId('invoices')
    var totalCusto = 0

    var criarCusto = function (descricao, valor, categoria) {
      if (!(valor > 0)) return
      var inv = new Record(col)
      inv.set('description', descricao)
      inv.set('type', 'payable')
      inv.set('amount', valor)
      inv.set('status', 'pending')
      inv.set('due_date', hoje)
      inv.set('client_id', order.getString('client_id'))
      inv.set('category', categoria)
      inv.set(
        'notes',
        'Custo do serviço lançado automaticamente na finalização da OS ' +
          (order.getString('number') || orderId) +
          '. ' +
          marcador,
      )
      inv.set('created_by', order.getString('created_by'))
      $app.save(inv)
      totalCusto += valor
    }

    for (var i = 0; i < items.length; i++) {
      var item = items[i]
      var qtd = item.quantity || 0
      if (!(qtd > 0)) continue
      var nome = item.name_snapshot || 'Item'

      if (item.item_type === 'product' && item.product_id) {
        var custoUnitario = 0
        try {
          var prod = $app.findRecordById('products', item.product_id)
          custoUnitario = prod.getFloat('cost_price')
          if (!(custoUnitario > 0)) custoUnitario = prod.getFloat('sale_price')
        } catch (err) {
          logInfo('OS ' + orderId + ': produto ' + item.product_id + ' não encontrado — ' + err)
        }
        criarCusto(
          'Custo de material: ' + nome + ' (OS ' + (order.getString('number') || orderId) + ')',
          custoUnitario * qtd,
          'Materiais',
        )
      }

      if (item.item_type === 'service') {
        // Custo de mão de obra = custo do serviço cadastrado (cost_price),
        // quando informado; senão, ignora (serviço sem custo cadastrado).
        var custoServico = 0
        if (item.service_id) {
          try {
            var serv = $app.findRecordById('services', item.service_id)
            custoServico = serv.getFloat('cost_price') * qtd
          } catch (err) {
            logInfo('OS ' + orderId + ': serviço ' + item.service_id + ' não encontrado — ' + err)
          }
        }
        if (!(custoServico > 0) && item.unit_cost > 0) custoServico = item.unit_cost * qtd
        criarCusto(
          'Custo de mão de obra: ' + nome + ' (OS ' + (order.getString('number') || orderId) + ')',
          custoServico,
          'Mão de obra',
        )
      }
    }

    if (totalCusto <= 0) {
      logInfo('OS ' + orderId + ': finalizada sem custos a lançar')
      return
    }
    logInfo(
      'OS ' +
        orderId +
        ': ' +
        (totalCusto > 0 ? 'custos de serviço lançados no Financeiro' : 'nenhum custo aplicável'),
    )
  } finally {
    e.next()
  }
}, 'service_orders')
