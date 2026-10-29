import pb from '@/lib/pocketbase/client'
import type { Service } from '@/types/crm'

export const servicesCatalogService = {
  async getAll(): Promise<Service[]> {
    return await pb.collection('services').getFullList<Service>({
      sort: 'name',
    })
  },

  async getById(id: string): Promise<Service> {
    return await pb.collection('services').getOne<Service>(id)
  },

  async create(data: Partial<Service>): Promise<Service> {
    return await pb.collection('services').create<Service>(data)
  },

  async update(id: string, data: Partial<Service>): Promise<Service> {
    return await pb.collection('services').update<Service>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('services').delete(id)
  },
}
