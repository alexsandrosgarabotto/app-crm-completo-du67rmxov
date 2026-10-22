import pb from '@/lib/pocketbase/client'
import type { Client } from '@/types/crm'

export const clientsService = {
  async getAll(): Promise<Client[]> {
    return await pb.collection('clients').getFullList<Client>({
      sort: '-created',
      expand: 'assigned_to,created_by',
    })
  },

  async getById(id: string): Promise<Client> {
    return await pb.collection('clients').getOne<Client>(id, {
      expand: 'assigned_to,created_by',
    })
  },

  async create(data: Partial<Client>): Promise<Client> {
    return await pb.collection('clients').create<Client>(data)
  },

  async update(id: string, data: Partial<Client>): Promise<Client> {
    return await pb.collection('clients').update<Client>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('clients').delete(id)
  },
}
