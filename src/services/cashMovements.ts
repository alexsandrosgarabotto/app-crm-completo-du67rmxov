import pb from '@/lib/pocketbase/client'
import type { CashMovement } from '@/types/crm'

export const cashMovementsService = {
  async getAll(): Promise<CashMovement[]> {
    return await pb.collection('cash_movements').getFullList<CashMovement>({
      sort: '-date,-created',
      expand: 'invoice_id,created_by',
    })
  },

  async getById(id: string): Promise<CashMovement> {
    return await pb.collection('cash_movements').getOne<CashMovement>(id, {
      expand: 'invoice_id,created_by',
    })
  },

  async getByInvoiceId(invoiceId: string): Promise<CashMovement | null> {
    try {
      return await pb
        .collection('cash_movements')
        .getFirstListItem<CashMovement>(`invoice_id = "${invoiceId}"`, {
          expand: 'invoice_id,created_by',
        })
    } catch {
      return null
    }
  },

  async create(data: Partial<CashMovement>): Promise<CashMovement> {
    return await pb.collection('cash_movements').create<CashMovement>(data, {
      expand: 'invoice_id,created_by',
    })
  },

  async update(id: string, data: Partial<CashMovement>): Promise<CashMovement> {
    return await pb.collection('cash_movements').update<CashMovement>(id, data, {
      expand: 'invoice_id,created_by',
    })
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('cash_movements').delete(id)
  },

  async deleteByInvoiceId(invoiceId: string): Promise<boolean> {
    try {
      const records = await pb.collection('cash_movements').getFullList<CashMovement>({
        filter: `invoice_id = "${invoiceId}"`,
      })
      for (const rec of records) {
        await pb.collection('cash_movements').delete(rec.id)
      }
      return true
    } catch (err) {
      console.error('Erro ao excluir movimento vinculado à fatura:', err)
      return false
    }
  },
}
