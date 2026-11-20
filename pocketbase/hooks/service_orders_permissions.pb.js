/// <reference path="../pb_data/types.d.ts" />

/**
 * Permissões de EDIÇÃO da OS (service_orders).
 * ---------------------------------------------
 * Somente o DONO (role 'owner') pode alterar os dados da OS: cliente, itens,
 * valores, datas, status. O técnico (role 'tecnico') só pode:
 *   - preencher/editar o relatorio_tecnico;
 *   - enviar a assinatura (arquivo) e finalizar/cancelar (status finalizada/
 *     cancelada), que é o caminho do "finalizar com assinatura" da ficha.
 * Seller segue como estava (não mexe em OS de terceiros).
 *
 * O hook roda em onRecordUpdateRequest — DEPOIS da checagem da regra de API
 * (update: @request.auth.id != '') e antes do save, então protege também
 * chamadas diretas à API. Sem e.next() em nenhuma saída (padrão QA v0.23).
 */
onRecordUpdateRequest((e) => {
  try {
    const auth = e.auth
    const order = e.record

    // Usuário autenticado é garantido pela regra de API da coleção; se por
    // algum motivo não vier, bloqueia.
    if (!auth) {
      e.json(403, { error: 'Autenticação obrigatória.' })
      return
    }

    const role = String(auth.get('role') || '')
    if (role === 'owner') {
      // Dono: livre para editar tudo.
      e.next()
      return
    }

    // Fora do dono: o PATCH só pode tocar os campos de execução do técnico.
    const permitidos = ['relatorio_tecnico', 'signature']
    const modificados = order.modifiedFields()

    const original = order.original()
    const mudouStatusFinal =
      String(order.get('status') || '') !== String(original.get('status') || '') &&
      ['finalizada', 'cancelada'].includes(String(order.get('status') || ''))

    const foraDaPermitida = modificados.some((f) => !permitidos.includes(f))

    if (foraDaPermitida && !mudouStatusFinal) {
      e.json(403, {
        error: 'Apenas o dono pode alterar os dados da ordem de serviço.',
      })
      return
    }

    e.next()
  } catch (err) {
    console.log('[service-orders-perms] erro ao validar edição da OS:', err)
    e.json(500, { error: 'Erro ao validar a edição da OS.' })
  }
}, 'service_orders')
