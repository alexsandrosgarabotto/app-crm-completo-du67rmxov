import pb from '@/lib/pocketbase/client'
import type { Product, StockMovement, StockMovementType } from '@/types/crm'

export const stockService = {
  async getProducts(): Promise<Product[]> {
    return await pb.collection('products').getFullList<Product>({
      sort: 'name',
    })
  },

  async getProductById(id: string): Promise<Product> {
    return await pb.collection('products').getOne<Product>(id)
  },

  async createProduct(data: Partial<Product>): Promise<Product> {
    return await pb.collection('products').create<Product>(data)
  },

  async updateProduct(id: string, data: Partial<Product>): Promise<Product> {
    return await pb.collection('products').update<Product>(id, data)
  },

  async deleteProduct(id: string): Promise<boolean> {
    return await pb.collection('products').delete(id)
  },

  // Movimentações
  async getMovements(productId?: string): Promise<StockMovement[]> {
    const filter = productId ? `product_id = "${productId}"` : ''
    return await pb.collection('stock_movements').getFullList<StockMovement>({
      filter,
      sort: '-created',
      expand: 'product_id,deal_id,user_id',
    })
  },

  async createMovement(params: {
    productId: string
    type: StockMovementType
    quantity: number
    reason?: string
    dealId?: string
    userId?: string
  }): Promise<StockMovement> {
    const today = new Date().toISOString().split('T')[0]
    const currentProduct = await pb.collection('products').getOne<Product>(params.productId)
    const currentQty = currentProduct.stock_quantity || 0

    let newQty = currentQty
    if (params.type === 'entry') {
      newQty = currentQty + params.quantity
    } else if (params.type === 'exit') {
      newQty = Math.max(0, currentQty - params.quantity)
    } else if (params.type === 'adjustment') {
      newQty = params.quantity
    }

    // Atualiza o estoque do produto
    await pb.collection('products').update(params.productId, {
      stock_quantity: newQty,
    })

    // Cria registro de movimentação
    return await pb.collection('stock_movements').create<StockMovement>(
      {
        product_id: params.productId,
        type: params.type,
        quantity: params.quantity,
        reason: params.reason || undefined,
        deal_id: params.dealId || undefined,
        user_id: params.userId || undefined,
        date: today,
      },
      {
        expand: 'product_id,deal_id,user_id',
      },
    )
  },
}
