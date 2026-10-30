import pb from '@/lib/pocketbase/client'
import type { Invoice, InvoiceStatus, CashMovementType } from '@/types/crm'
import { cashMovementsService } from './cashMovements'

export const invoicesService = {
  async getAll(): Promise<Invoice[]> {
    return await pb.collection('invoices').getFullList<Invoice>({
      sort: '-due_date',
      expand: 'client_id,deal_id',
    })
  },

  async getById(id: string): Promise<Invoice> {
    return await pb.collection('invoices').getOne<Invoice>(id, {
      expand: 'client_id,deal_id',
    })
  },

  async create(data: Partial<Invoice>): Promise<Invoice> {
    return await pb.collection('invoices').create<Invoice>(data, {
      expand: 'client_id,deal_id',
    })
  },

  async update(id: string, data: Partial<Invoice>): Promise<Invoice> {
    return await pb.collection('invoices').update<Invoice>(id, data, {
      expand: 'client_id,deal_id',
    })
  },

  async updateStatus(id: string, status: InvoiceStatus): Promise<Invoice> {
    const patch: Partial<Invoice> = { status }
    const today = new Date().toISOString().split('T')[0]
    if (status === 'paid') {
      patch.paid_date = today
    } else {
      patch.paid_date = ''
    }
    const updated = await pb.collection('invoices').update<Invoice>(id, patch, {
      expand: 'client_id,deal_id',
    })

    // Sincronização automática com Controle de Caixa
    try {
      if (status === 'paid') {
        // Verifica se já existe um movimento de caixa vinculado para evitar duplicação
        const existing = await cashMovementsService.getByInvoiceId(id)
        if (!existing) {
          const moveType: CashMovementType = updated.type === 'receivable' ? 'entry' : 'exit'
          const prefix = updated.type === 'receivable' ? 'Recebimento' : 'Pagamento'
          await cashMovementsService.create({
            date: updated.paid_date || today,
            type: moveType,
            description: `${prefix}: ${updated.description}`,
            category:
              updated.category ||
              (updated.type === 'receivable' ? 'Vendas / Recebimento' : 'Despesas Operacionais'),
            amount: updated.amount,
            payment_method: 'pix',
            invoice_id: updated.id,
            created_by: pb.authStore.model?.id || updated.created_by,
            notes: `Gerado automaticamente da fatura (${updated.type === 'receivable' ? 'Receita' : 'Despesa'})`,
          })
        }
      } else {
        // Se voltou para pendente ou cancelado, remove o lançamento do caixa
        await cashMovementsService.deleteByInvoiceId(id)
      }
    } catch (err) {
      console.error('Erro ao sincronizar movimento de caixa com fatura:', err)
    }

    return updated
  },

  async delete(id: string): Promise<boolean> {
    try {
      await cashMovementsService.deleteByInvoiceId(id)
    } catch {
      /* intentionally ignored */
    }
    return await pb.collection('invoices').delete(id)
  },
}
