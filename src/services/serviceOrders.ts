import pb from '@/lib/pocketbase/client'
import type { ServiceOrder, ServiceOrderStatus, ServiceOrderStatusChange } from '@/types/crm'

export interface StockIssue {
  product: string
  message: string
}

export type AvisoWhatsapp =
  | 'enviado'
  | 'fora_da_janela'
  | 'modo_validacao'
  | 'sem_telefone'
  | 'sem_conversa'
  | 'falhou'

export interface StatusChangeResult {
  order: ServiceOrder
  whatsapp: AvisoWhatsapp
  whatsappErro?: string
}

export const serviceOrderStatusLabels: Record<ServiceOrderStatus, string> = {
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  aguardando_peca: 'Aguardando peça',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
}

export const OPEN_SERVICE_ORDER_STATUSES: ServiceOrderStatus[] = [
  'aberta',
  'em_andamento',
  'aguardando_peca',
]

/** URL pública de um arquivo da OS (fotos / assinatura) no storage do backend. */
export function serviceOrderFileUrl(orderId: string, filename: string, thumb?: string): string {
  const base = pb.files.getURL(
    { id: orderId, collectionId: 'service_orders', collectionName: 'service_orders' },
    filename,
  )
  return thumb ? `${base}?thumb=${thumb}` : base
}

export const serviceOrdersService = {
  async getAll(): Promise<ServiceOrder[]> {
    return await pb.collection('service_orders').getFullList<ServiceOrder>({
      sort: '-created',
      expand: 'client_id,responsible_id,created_by',
    })
  },

  async getByClientId(clientId: string): Promise<ServiceOrder[]> {
    return await pb.collection('service_orders').getFullList<ServiceOrder>({
      filter: `client_id = "${clientId}"`,
      sort: '-created',
      expand: 'client_id,responsible_id,created_by',
    })
  },

  async getById(id: string): Promise<ServiceOrder | null> {
    try {
      return await pb.collection('service_orders').getOne<ServiceOrder>(id, {
        expand: 'client_id,responsible_id,created_by',
      })
    } catch {
      return null
    }
  },

  async getByConversationId(conversationId: string): Promise<ServiceOrder[]> {
    try {
      return await pb.collection('service_orders').getFullList<ServiceOrder>({
        filter: `conversation_id = "${conversationId}"`,
        sort: '-created',
        expand: 'client_id,responsible_id,created_by',
      })
    } catch {
      return []
    }
  },

  async create(data: Partial<ServiceOrder>): Promise<ServiceOrder> {
    const nextNumber = await this.nextNumber()
    return await pb.collection('service_orders').create<ServiceOrder>({
      ...data,
      number: nextNumber,
      stock_released: false,
    })
  },

  async update(id: string, data: Partial<ServiceOrder>): Promise<ServiceOrder> {
    return await pb.collection('service_orders').update<ServiceOrder>(id, data)
  },

  async remove(id: string): Promise<void> {
    await pb.collection('service_orders').delete(id)
  },

  /** Gera o próximo número sequencial no formato OS-0001 (com base no total criado). */
  async nextNumber(): Promise<string> {
    try {
      const last = await pb.collection('service_orders').getList<ServiceOrder>(1, 1, {
        sort: '-created',
      })
      const total = last.totalItems || 0
      const seq = String(total + 1).padStart(4, '0')
      return `OS-${seq}`
    } catch {
      const fallback = Date.now().toString().slice(-6)
      return `OS-${fallback}`
    }
  },

  /**
   * Adiciona UMA foto ao relatório fotográfico da OS (upload real via
   * FormData — o arquivo vai para o storage do backend, nunca base64).
   */
  async addPhoto(order: ServiceOrder, file: File): Promise<ServiceOrder> {
    const formData = new FormData()
    formData.append('photos', file)
    const existing = (order.photos || []).filter((n) => n && n.length > 0)
    if (existing.length > 0) {
      formData.append('photos', JSON.stringify(existing))
    }
    return await pb.collection('service_orders').update<ServiceOrder>(order.id, formData)
  },

  /** Remove UMA foto do relatório fotográfico (pelo nome do arquivo). */
  async removePhoto(order: ServiceOrder, filename: string): Promise<ServiceOrder> {
    const remaining = (order.photos || []).filter((n) => n !== filename)
    return await pb.collection('service_orders').update<ServiceOrder>(order.id, {
      photos: remaining,
    })
  },

  /** Salva a assinatura do cliente (PNG gerado do canvas) na OS. */
  async saveSignature(order: ServiceOrder, dataUrl: string): Promise<ServiceOrder> {
    const blob = dataUrlToBlob(dataUrl)
    const formData = new FormData()
    formData.append('signature', blob, `assinatura-${order.id}.png`)
    return await pb.collection('service_orders').update<ServiceOrder>(order.id, formData)
  },

  /**
   * Mudança de status pelo CRM: grava no histórico (quem/quando/de-para) e
   * dispara o aviso de WhatsApp ao cliente pelo backend (canal Meta primário,
   * respeitando o modo de validação e a janela de 24h).
   */
  async changeStatus(
    order: ServiceOrder,
    novoStatus: ServiceOrderStatus,
    usuario?: { id?: string; name?: string },
  ): Promise<StatusChangeResult> {
    const statusAnterior = order.status
    if (statusAnterior === novoStatus) {
      return { order, whatsapp: 'enviado' }
    }

    const entrada: ServiceOrderStatusChange = {
      de: statusAnterior,
      para: novoStatus,
      por: usuario?.id,
      por_nome: usuario?.name || '',
      quando: new Date().toISOString(),
      aviso_whatsapp: undefined,
    }

    let aviso: AvisoWhatsapp = 'falhou'
    let avisoErro: string | undefined
    let historico = order.historico || []

    // A gravação (status + histórico + aviso de WhatsApp) é feita pelo hook
    // backend, que também manda a mensagem pelo canal Meta primário.
    try {
      const res = await pb.send(`/backend/v1/crm/service-orders/${order.id}/notice`, {
        method: 'POST',
        body: JSON.stringify({ status: novoStatus }),
      })
      const data = res as {
        status?: string
        historico?: ServiceOrderStatusChange[]
        motivo?: string
        enviado?: boolean
      }
      if (data.historico) historico = data.historico
      if (data.enviado) {
        aviso = 'enviado'
      } else if (data.motivo === 'Modo validação') {
        aviso = 'modo_validacao'
        avisoErro = data.motivo
      } else if (data.motivo === 'Fora da janela de 24h') {
        aviso = 'fora_da_janela'
        avisoErro = data.motivo
      } else if (String(data.motivo || '').includes('sem conversa')) {
        aviso = 'sem_conversa'
        avisoErro = data.motivo
      } else if (String(data.motivo || '').includes('sem telefone')) {
        aviso = 'sem_telefone'
        avisoErro = data.motivo
      } else if (data.motivo) {
        avisoErro = data.motivo
      }
    } catch (err: any) {
      avisoErro = err?.message || 'Falha ao avisar o cliente por WhatsApp'
    }

    entrada.aviso_whatsapp = aviso
    const updated = { ...order, status: novoStatus, historico }
    return { order: updated, whatsapp: aviso, whatsappErro: avisoErro }
  },

  /**
   * Finaliza a OS: baixa o estoque dos produtos (uma única vez) e gera a
   * conta a receber no financeiro com o valor total (sem duplicar).
   */
  async finalize(
    order: ServiceOrder,
    params: {
      userId?: string
      userName?: string
      onStockIssue?: (issue: StockIssue) => void
    },
  ): Promise<ServiceOrder> {
    // 1. Baixa de estoque (apenas na primeira finalização)
    if (!order.stock_released) {
      for (const item of order.items || []) {
        if (item.item_type !== 'product' || !item.product_id) continue
        try {
          const product = await pb.collection('products').getOne(item.product_id)
          const currentQty = product.stock_quantity || 0
          const newQty = Math.max(0, currentQty - item.quantity)
          await pb.collection('products').update(item.product_id, { stock_quantity: newQty })
          await pb.collection('stock_movements').create({
            product_id: item.product_id,
            type: 'exit',
            quantity: item.quantity,
            reason: `Ordem de Serviço ${order.number || order.id}: ${item.name_snapshot}`,
            user_id: params.userId,
            date: new Date().toISOString().split('T')[0],
          })
          if (currentQty < item.quantity) {
            params.onStockIssue?.({
              product: item.name_snapshot,
              message: `Estoque insuficiente para "${item.name_snapshot}": disponível ${currentQty}, necessário ${item.quantity}. A baixa foi feita até zerar.`,
            })
          }
        } catch (err) {
          console.error('Erro ao baixar estoque do produto:', item.name_snapshot, err)
          params.onStockIssue?.({
            product: item.name_snapshot,
            message: `Não foi possível dar baixa no estoque de "${item.name_snapshot}".`,
          })
        }
      }
    }

    // 2. Conta a receber no financeiro (sem duplicar se finalizar de novo)
    let invoiceId = order.invoice_id || ''
    if (!invoiceId && (order.total_value || 0) > 0) {
      try {
        const invoice = await pb.collection('invoices').create({
          description: `Ordem de Serviço ${order.number || order.id}`,
          type: 'receivable',
          amount: order.total_value || 0,
          status: 'pending',
          due_date: new Date().toISOString().split('T')[0],
          client_id: order.client_id,
          category: 'Ordens de Serviço',
          notes: `Gerada automaticamente pela OS ${order.number || order.id}.`,
          created_by: params.userId,
        })
        invoiceId = invoice.id
      } catch (err) {
        console.error('Erro ao gerar conta a receber da OS:', err)
      }
    }

    const saved = await this.update(order.id, {
      status: 'finalizada',
      finished_at: new Date().toISOString(),
      stock_released: true,
      invoice_id: invoiceId || undefined,
    })

    // Aviso ao cliente pelo WhatsApp (mesmo caminho das outras mudanças de
    // status: canal Meta primário, modo de validação e janela de 24h).
    const { order: avisada } = await this.changeStatus(
      saved,
      'finalizada',
      params.userId ? { id: params.userId, name: params.userName } : undefined,
    )
    return avisada
  },

  /** Cancelar OS desfaz a baixa de estoque, se ela ainda estiver aplicada. */
  async cancel(
    order: ServiceOrder,
    params?: { userId?: string; userName?: string },
  ): Promise<ServiceOrder> {
    if (order.stock_released) {
      for (const item of order.items || []) {
        if (item.item_type !== 'product' || !item.product_id) continue
        try {
          const product = await pb.collection('products').getOne(item.product_id)
          await pb.collection('products').update(item.product_id, {
            stock_quantity: (product.stock_quantity || 0) + item.quantity,
          })
          await pb.collection('stock_movements').create({
            product_id: item.product_id,
            type: 'entry',
            quantity: item.quantity,
            reason: `Estorno de OS cancelada ${order.number || order.id}: ${item.name_snapshot}`,
            user_id: undefined,
            date: new Date().toISOString().split('T')[0],
          })
        } catch (err) {
          console.error('Erro ao estornar estoque do produto:', item.name_snapshot, err)
        }
      }
    }

    const canceled = await this.update(order.id, { status: 'cancelada', stock_released: false })

    // Aviso ao cliente pelo WhatsApp (mesmo caminho das outras mudanças).
    const { order: avisada } = await this.changeStatus(
      canceled,
      'cancelada',
      params?.userId ? { id: params.userId, name: params.userName } : undefined,
    )
    return avisada
  },
}

/** Converte um data URL (canvas.toDataURL('image/png')) em Blob. */
function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(',')
  const mimeMatch = /data:([^;]+)/.exec(meta)
  const mime = mimeMatch ? mimeMatch[1] : 'image/png'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}
