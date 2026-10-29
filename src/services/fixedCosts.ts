import pb from '@/lib/pocketbase/client'
import type { FixedCost } from '@/types/crm'

export const fixedCostsService = {
  async getAll(): Promise<FixedCost[]> {
    return await pb.collection('fixed_costs').getFullList<FixedCost>({
      sort: 'due_day,name',
      expand: 'created_by',
    })
  },

  async getById(id: string): Promise<FixedCost> {
    return await pb.collection('fixed_costs').getOne<FixedCost>(id, {
      expand: 'created_by',
    })
  },

  async create(data: Partial<FixedCost>): Promise<FixedCost> {
    return await pb.collection('fixed_costs').create<FixedCost>(data, {
      expand: 'created_by',
    })
  },

  async update(id: string, data: Partial<FixedCost>): Promise<FixedCost> {
    return await pb.collection('fixed_costs').update<FixedCost>(id, data, {
      expand: 'created_by',
    })
  },

  async toggleActive(id: string, currentActive: boolean): Promise<FixedCost> {
    return await pb.collection('fixed_costs').update<FixedCost>(id, {
      active: !currentActive,
    })
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('fixed_costs').delete(id)
  },
}
