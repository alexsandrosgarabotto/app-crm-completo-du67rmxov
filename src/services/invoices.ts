import pb from '@/lib/pocketbase/client'
import type { Invoice, InvoiceStatus } from '@/types/crm'

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
    if (status === 'paid') {
      patch.paid_date = new Date().toISOString().split('T')[0]
    } else {
      patch.paid_date = ''
    }
    return await pb.collection('invoices').update<Invoice>(id, patch, {
      expand: 'client_id,deal_id',
    })
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('invoices').delete(id)
  },
}
