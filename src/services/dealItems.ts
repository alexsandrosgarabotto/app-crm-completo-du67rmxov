import pb from '@/lib/pocketbase/client'
import type { DealItem } from '@/types/crm'

export const dealItemsService = {
  async getAll(): Promise<DealItem[]> {
    return await pb.collection('deal_items').getFullList<DealItem>({
      sort: '-created',
      expand: 'product_id,service_id',
    })
  },

  async getByDealId(dealId: string): Promise<DealItem[]> {
    return await pb.collection('deal_items').getFullList<DealItem>({
      filter: `deal_id = "${dealId}"`,
      sort: 'created',
      expand: 'product_id,service_id',
    })
  },

  async create(data: Partial<DealItem>): Promise<DealItem> {
    return await pb.collection('deal_items').create<DealItem>(data, {
      expand: 'product_id,service_id',
    })
  },

  async update(id: string, data: Partial<DealItem>): Promise<DealItem> {
    return await pb.collection('deal_items').update<DealItem>(id, data, {
      expand: 'product_id,service_id',
    })
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('deal_items').delete(id)
  },

  async syncItemsForDeal(
    dealId: string,
    items: Array<{
      id?: string
      item_type: 'product' | 'service'
      product_id?: string
      service_id?: string
      name_snapshot: string
      quantity: number
      unit_price: number
      total_price: number
    }>,
  ): Promise<DealItem[]> {
    const existing = await this.getByDealId(dealId)
    const existingIds = new Set(existing.map((item) => item.id))
    const keepIds = new Set<string>()

    const results: DealItem[] = []

    for (const item of items) {
      if (item.id && existingIds.has(item.id)) {
        keepIds.add(item.id)
        const updated = await this.update(item.id, {
          item_type: item.item_type,
          product_id: item.product_id || undefined,
          service_id: item.service_id || undefined,
          name_snapshot: item.name_snapshot,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
        })
        results.push(updated)
      } else {
        const created = await this.create({
          deal_id: dealId,
          item_type: item.item_type,
          product_id: item.product_id || undefined,
          service_id: item.service_id || undefined,
          name_snapshot: item.name_snapshot,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
        })
        results.push(created)
      }
    }

    // Deletar os itens removidos
    for (const oldItem of existing) {
      if (!keepIds.has(oldItem.id)) {
        await this.delete(oldItem.id)
      }
    }

    return results
  },
}
