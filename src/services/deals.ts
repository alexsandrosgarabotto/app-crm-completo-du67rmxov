import pb from '@/lib/pocketbase/client'
import type { Deal, DealStage } from '@/types/crm'

export const dealsService = {
  async getAll(): Promise<Deal[]> {
    return await pb.collection('deals').getFullList<Deal>({
      sort: '-created',
      expand: 'client_id,user_id,created_by',
    })
  },

  async getById(id: string): Promise<Deal> {
    return await pb.collection('deals').getOne<Deal>(id, {
      expand: 'client_id,user_id,created_by',
    })
  },

  async create(data: Partial<Deal>): Promise<Deal> {
    return await pb.collection('deals').create<Deal>(data, {
      expand: 'client_id,user_id,created_by',
    })
  },

  async update(id: string, data: Partial<Deal>): Promise<Deal> {
    return await pb.collection('deals').update<Deal>(id, data, {
      expand: 'client_id,user_id,created_by',
    })
  },

  async updateStage(id: string, stage: DealStage): Promise<Deal> {
    const patch: Partial<Deal> = { stage }
    if (stage === 'won' || stage === 'lost') {
      patch.closed_date = new Date().toISOString().split('T')[0]
    }
    return await pb.collection('deals').update<Deal>(id, patch, {
      expand: 'client_id,user_id,created_by',
    })
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('deals').delete(id)
  },
}
