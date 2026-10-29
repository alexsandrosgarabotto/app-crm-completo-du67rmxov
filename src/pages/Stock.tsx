import React, { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { stockService } from '@/services/stock'
import type { Product, StockMovement, StockMovementType } from '@/types/crm'
import {
  Boxes,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  SlidersHorizontal,
  History,
  Edit,
  Trash2,
  Package,
  Layers,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  FileSpreadsheet,
} from 'lucide-react'
import {
  ImportSpreadsheetModal,
  type ImportColumnDefinition,
  type ImportPreviewItem,
} from '@/components/ImportSpreadsheetModal'
import { normalizeHeader } from '@/lib/csvImportUtils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'

export default function StockPage() {
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all') // all, low_stock, active, inactive

  // Modal Importação
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  // Modal Produto (Criar / Editar)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [submittingProduct, setSubmittingProduct] = useState(false)

  // Form Produto
  const [formName, setFormName] = useState('')
  const [formSku, setFormSku] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formUnit, setFormUnit] = useState('UN')
  const [formSalePrice, setFormSalePrice] = useState('')
  const [formCostPrice, setFormCostPrice] = useState('')
  const [formStockQty, setFormStockQty] = useState('')
  const [formMinStock, setFormMinStock] = useState('')
  const [formActive, setFormActive] = useState(true)

  // Modal Movimentação Manual
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false)
  const [selectedProductForMovement, setSelectedProductForMovement] = useState<Product | null>(null)
  const [movementType, setMovementType] = useState<StockMovementType>('entry')
  const [movementQty, setMovementQty] = useState('')
  const [movementReason, setMovementReason] = useState('')
  const [submittingMovement, setSubmittingMovement] = useState(false)

  // Modal Histórico de Movimentações
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<Product | null>(null)
  const [movementsHistory, setMovementsHistory] = useState<StockMovement[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    setLoading(true)
    try {
      const data = await stockService.getProducts()
      setProducts(data)
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao carregar estoque',
        description: 'Não foi possível buscar a lista de produtos.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Categorias disponíveis
  const categories = Array.from(
    new Set(products.map((p) => p.category).filter(Boolean) as string[]),
  )

  // Filtros
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()))

    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter

    const isLow = (p.stock_quantity ?? 0) <= (p.min_stock ?? 0)
    let matchesStatus = true
    if (statusFilter === 'low_stock') matchesStatus = isLow
    if (statusFilter === 'active') matchesStatus = p.active !== false
    if (statusFilter === 'inactive') matchesStatus = p.active === false

    return matchesSearch && matchesCategory && matchesStatus
  })

  // Handlers Produto
  const handleOpenCreateProduct = () => {
    setEditingProduct(null)
    setFormName('')
    setFormSku('')
    setFormDesc('')
    setFormCategory('')
    setFormUnit('UN')
    setFormSalePrice('')
    setFormCostPrice('')
    setFormStockQty('0')
    setFormMinStock('5')
    setFormActive(true)
    setIsProductModalOpen(true)
  }

  const handleOpenEditProduct = (p: Product) => {
    setEditingProduct(p)
    setFormName(p.name || '')
    setFormSku(p.sku || '')
    setFormDesc(p.description || '')
    setFormCategory(p.category || '')
    setFormUnit(p.unit || 'UN')
    setFormSalePrice(p.sale_price !== undefined ? p.sale_price.toString() : '')
    setFormCostPrice(p.cost_price !== undefined ? p.cost_price.toString() : '')
    setFormStockQty(p.stock_quantity !== undefined ? p.stock_quantity.toString() : '0')
    setFormMinStock(p.min_stock !== undefined ? p.min_stock.toString() : '5')
    setFormActive(p.active !== false)
    setIsProductModalOpen(true)
  }

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) {
      toast({
        title: 'Atenção',
        description: 'O nome do produto é obrigatório.',
        variant: 'destructive',
      })
      return
    }

    setSubmittingProduct(true)
    try {
      const payload: Partial<Product> = {
        name: formName.trim(),
        sku: formSku.trim() || undefined,
        description: formDesc.trim() || undefined,
        category: formCategory.trim() || undefined,
        unit: formUnit.trim() || 'UN',
        sale_price: formSalePrice ? parseFloat(formSalePrice) : 0,
        cost_price: formCostPrice ? parseFloat(formCostPrice) : 0,
        stock_quantity: formStockQty ? parseFloat(formStockQty) : 0,
        min_stock: formMinStock ? parseFloat(formMinStock) : 0,
        active: formActive,
      }

      if (editingProduct) {
        const updated = await stockService.updateProduct(editingProduct.id, payload)
        setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
        toast({ title: 'Sucesso', description: 'Produto atualizado no estoque!' })
      } else {
        payload.created_by = user?.id
        const created = await stockService.createProduct(payload)
        setProducts((prev) => [created, ...prev])
        toast({ title: 'Sucesso', description: 'Produto adicionado ao estoque!' })
      }

      setIsProductModalOpen(false)
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao salvar produto',
        description: err.message || 'Verifique os dados informados.',
        variant: 'destructive',
      })
    } finally {
      setSubmittingProduct(false)
    }
  }

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja remover este produto do estoque?')) return
    try {
      await stockService.deleteProduct(id)
      setProducts((prev) => prev.filter((p) => p.id !== id))
      toast({ title: 'Excluído', description: 'Produto removido com sucesso.' })
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o produto.',
        variant: 'destructive',
      })
    }
  }

  // Handlers Movimentação
  const handleOpenMovementModal = (p: Product, initialType: StockMovementType = 'entry') => {
    setSelectedProductForMovement(p)
    setMovementType(initialType)
    setMovementQty('1')
    setMovementReason('')
    setIsMovementModalOpen(true)
  }

  const handleSaveMovement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProductForMovement) return
    const qty = parseFloat(movementQty)
    if (!qty || qty <= 0) {
      toast({
        title: 'Atenção',
        description: 'Informe uma quantidade válida e positiva.',
        variant: 'destructive',
      })
      return
    }

    setSubmittingMovement(true)
    try {
      await stockService.createMovement({
        productId: selectedProductForMovement.id,
        type: movementType,
        quantity: qty,
        reason: movementReason.trim() || `Movimentação manual (${movementType})`,
        userId: user?.id,
      })

      // Atualiza produto na lista local
      const updatedProduct = await stockService.getProductById(selectedProductForMovement.id)
      setProducts((prev) => prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p)))

      toast({
        title: 'Movimentação Registrada',
        description: `Estoque de "${selectedProductForMovement.name}" atualizado para ${updatedProduct.stock_quantity}.`,
      })
      setIsMovementModalOpen(false)
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro na movimentação',
        description: err.message || 'Falha ao registrar movimentação.',
        variant: 'destructive',
      })
    } finally {
      setSubmittingMovement(false)
    }
  }

  // Handlers Histórico
  const handleOpenHistoryModal = async (p: Product) => {
    setSelectedProductForHistory(p)
    setIsHistoryModalOpen(true)
    setLoadingHistory(true)
    try {
      const list = await stockService.getMovements(p.id)
      setMovementsHistory(list)
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar o histórico.',
        variant: 'destructive',
      })
    } finally {
      setLoadingHistory(false)
    }
  }

  const formatCurrency = (val?: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  const lowStockCount = products.filter(
    (p) => (p.stock_quantity ?? 0) <= (p.min_stock ?? 0) && p.active !== false,
  ).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Boxes className="h-7 w-7 text-blue-600" />
            Controle de Estoque
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie mercadorias, quantidades mínimas, entradas, saídas e histórico de
            movimentações.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsImportModalOpen(true)}
            className="border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5 text-emerald-600" /> Importar Produtos
          </Button>
          <Button onClick={handleOpenCreateProduct} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-1.5" /> Novo Produto
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-600">Total de Produtos</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{products.length}</div>
            <p className="text-xs text-slate-500 mt-1">
              {products.filter((p) => p.active !== false).length} ativos no catálogo
            </p>
          </CardContent>
        </Card>

        <Card
          className={`border-slate-200 shadow-2xs ${lowStockCount > 0 ? 'bg-rose-50/40 border-rose-200' : ''}`}
        >
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-600">
              Alerta: Estoque Baixo
            </CardTitle>
            <AlertTriangle
              className={`h-4 w-4 ${lowStockCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}
            />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div
              className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-rose-700' : 'text-slate-900'}`}
            >
              {lowStockCount}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {lowStockCount > 0
                ? 'Produtos abaixo ou no limite mínimo!'
                : 'Todos os estoques regularizados'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-600">
              Valor em Mercadoria
            </CardTitle>
            <Layers className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-emerald-700">
              {formatCurrency(
                products.reduce((acc, p) => acc + (p.stock_quantity || 0) * (p.sale_price || 0), 0),
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">Estimativa a preço de venda</p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros e Busca */}
      <Card className="border-slate-200 shadow-2xs">
        <CardContent className="p-4 flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por nome, código SKU ou descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
            >
              <option value="all">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
            >
              <option value="all">Todos os status</option>
              <option value="low_stock">⚠️ Apenas Estoque Baixo</option>
              <option value="active">Apenas Ativos</option>
              <option value="inactive">Apenas Inativos</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Produtos */}
      <Card className="border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Produto / SKU</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4 text-right">Preço Venda</th>
                <th className="py-3 px-4 text-center">Qtd. em Estoque</th>
                <th className="py-3 px-4 text-center">Estoque Mínimo</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2"></div>
                    <p>Carregando estoque...</p>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Nenhum produto encontrado no estoque para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const qty = p.stock_quantity ?? 0
                  const min = p.min_stock ?? 0
                  const isLow = qty <= min

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isLow ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{p.name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          {p.sku && (
                            <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded text-[11px]">
                              {p.sku}
                            </span>
                          )}
                          {p.unit && <span>Unidade: {p.unit}</span>}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        {p.category || <span className="text-slate-400 italic">Sem categoria</span>}
                      </td>

                      <td className="py-3.5 px-4 text-right font-medium text-slate-900">
                        {formatCurrency(p.sale_price)}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isLow
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isLow && <AlertTriangle className="h-3 w-3 mr-1 inline" />}
                          {qty} {p.unit || 'UN'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center text-slate-500 font-mono text-xs">
                        {min} {p.unit || 'UN'}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {p.active === false ? (
                          <Badge
                            variant="outline"
                            className="text-slate-400 border-slate-300 text-[11px]"
                          >
                            Inativo
                          </Badge>
                        ) : isLow ? (
                          <Badge variant="destructive" className="bg-rose-600 text-[11px]">
                            Estoque Baixo
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="bg-emerald-50 text-emerald-700 text-[11px]"
                          >
                            Regular
                          </Badge>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Botão Entrada Rápida */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenMovementModal(p, 'entry')}
                            className="h-8 px-2 text-emerald-700 hover:bg-emerald-50 text-xs"
                            title="Registrar entrada de estoque"
                          >
                            <ArrowDownCircle className="h-3.5 w-3.5 mr-1" />
                            Entrada
                          </Button>

                          {/* Botão Saída Rápida */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenMovementModal(p, 'exit')}
                            className="h-8 px-2 text-amber-700 hover:bg-amber-50 text-xs"
                            title="Registrar saída manual de estoque"
                          >
                            <ArrowUpCircle className="h-3.5 w-3.5 mr-1" />
                            Saída
                          </Button>

                          {/* Histórico */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenHistoryModal(p)}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-blue-600"
                            title="Ver histórico de movimentações"
                          >
                            <History className="h-4 w-4" />
                          </Button>

                          {/* Editar */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditProduct(p)}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-blue-600"
                            title="Editar produto"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          {/* Excluir */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteProduct(p.id)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600"
                            title="Excluir produto"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL CRIAR / EDITAR PRODUTO */}
      <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Editar Produto de Estoque' : 'Cadastrar Novo Produto'}
            </DialogTitle>
            <DialogDescription>
              Defina dados da mercadoria, código SKU, preços e parâmetros de estoque.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProduct} className="space-y-3.5 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="prod-name">Nome do Produto *</Label>
              <Input
                id="prod-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Teclado Sem Fio USB ou Bobina Térmica"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="prod-sku">Código / SKU</Label>
                <Input
                  id="prod-sku"
                  value={formSku}
                  onChange={(e) => setFormSku(e.target.value)}
                  placeholder="Ex: PROD-001"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prod-unit">Unidade</Label>
                <select
                  id="prod-unit"
                  value={formUnit}
                  onChange={(e) => setFormUnit(e.target.value)}
                  className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
                >
                  <option value="UN">UN - Unidade</option>
                  <option value="KG">KG - Quilograma</option>
                  <option value="CX">CX - Caixa</option>
                  <option value="PC">PC - Peça</option>
                  <option value="M">M - Metro</option>
                  <option value="PAR">PAR - Par</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prod-category">Categoria</Label>
              <Input
                id="prod-category"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                placeholder="Ex: Informática, Suprimentos, Hardware..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="prod-sale">Preço de Venda (R$)</Label>
                <Input
                  id="prod-sale"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formSalePrice}
                  onChange={(e) => setFormSalePrice(e.target.value)}
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prod-cost">Preço de Custo (R$)</Label>
                <Input
                  id="prod-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formCostPrice}
                  onChange={(e) => setFormCostPrice(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="prod-qty">Qtd. Atual em Estoque</Label>
                <Input
                  id="prod-qty"
                  type="number"
                  step="1"
                  value={formStockQty}
                  onChange={(e) => setFormStockQty(e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prod-min">Estoque Mínimo (Alerta)</Label>
                <Input
                  id="prod-min"
                  type="number"
                  step="1"
                  min="0"
                  value={formMinStock}
                  onChange={(e) => setFormMinStock(e.target.value)}
                  placeholder="5"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prod-desc">Descrição / Detalhes</Label>
              <Textarea
                id="prod-desc"
                rows={2}
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Especificações técnicas, garantia, fabricante..."
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="prod-active"
                checked={formActive}
                onChange={(e) => setFormActive(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <Label htmlFor="prod-active" className="text-sm font-medium cursor-pointer">
                Produto ativo para vendas
              </Label>
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button type="button" variant="outline" onClick={() => setIsProductModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={submittingProduct}
              >
                {submittingProduct
                  ? 'Salvando...'
                  : editingProduct
                    ? 'Atualizar Produto'
                    : 'Cadastrar Produto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL REGISTRAR ENTRADA / SAÍDA / AJUSTE MANUAL */}
      <Dialog open={isMovementModalOpen} onOpenChange={setIsMovementModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-blue-600" />
              Movimentação de Estoque
            </DialogTitle>
            <DialogDescription>
              {selectedProductForMovement && (
                <span>
                  Produto: <strong>{selectedProductForMovement.name}</strong> (Estoque atual:{' '}
                  <strong>
                    {selectedProductForMovement.stock_quantity ?? 0}{' '}
                    {selectedProductForMovement.unit || 'UN'}
                  </strong>
                  )
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveMovement} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="mov-type">Tipo de Movimentação</Label>
              <select
                id="mov-type"
                value={movementType}
                onChange={(e) => setMovementType(e.target.value as StockMovementType)}
                className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs font-medium"
              >
                <option value="entry">📥 Entrada de Mercadoria (Adicionar)</option>
                <option value="exit">📤 Saída de Mercadoria (Subtrair)</option>
                <option value="adjustment">⚖️ Ajuste / Balanço Físico (Definir novo total)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mov-qty">
                {movementType === 'adjustment'
                  ? 'Nova Quantidade Real em Estoque'
                  : 'Quantidade da Movimentação'}
              </Label>
              <Input
                id="mov-qty"
                type="number"
                step="1"
                min="1"
                value={movementQty}
                onChange={(e) => setMovementQty(e.target.value)}
                placeholder="1"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mov-reason">Motivo / Justificativa</Label>
              <Input
                id="mov-reason"
                value={movementReason}
                onChange={(e) => setMovementReason(e.target.value)}
                placeholder="Ex: Chegada de fornecedor, perda/avaria, contagem de inventário..."
              />
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button type="button" variant="outline" onClick={() => setIsMovementModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={submittingMovement}
              >
                {submittingMovement ? 'Gravando...' : 'Confirmar Movimentação'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL HISTÓRICO DE MOVIMENTAÇÕES */}
      <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-blue-600" />
              Histórico de Movimentações
            </DialogTitle>
            <DialogDescription>
              {selectedProductForHistory?.name} — Registro completo de entradas, saídas e vendas.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[400px] overflow-y-auto space-y-2 py-2">
            {loadingHistory ? (
              <div className="p-8 text-center text-slate-400">Carregando movimentações...</div>
            ) : movementsHistory.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                Nenhuma movimentação registrada para este produto ainda.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {movementsHistory.map((m) => {
                  const isEntry = m.type === 'entry'
                  const isExit = m.type === 'exit'
                  const isAdj = m.type === 'adjustment'

                  return (
                    <div key={m.id} className="py-2.5 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                            isEntry
                              ? 'bg-emerald-100 text-emerald-700'
                              : isExit
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {isEntry ? (
                            <ArrowDownCircle className="h-4 w-4" />
                          ) : isExit ? (
                            <ArrowUpCircle className="h-4 w-4" />
                          ) : (
                            <SlidersHorizontal className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-xs">
                            {isEntry ? 'Entrada' : isExit ? 'Saída' : 'Ajuste de Estoque'}:{' '}
                            <span className="font-bold">
                              {isEntry
                                ? `+${m.quantity}`
                                : isExit
                                  ? `-${m.quantity}`
                                  : `Novo total: ${m.quantity}`}
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {m.reason || 'Sem observações'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right text-xs text-slate-400">
                        <p>{m.date || m.created.split('T')[0]}</p>
                        {m.expand?.deal_id && (
                          <span className="text-blue-600 font-medium text-[10px]">
                            Venda: {m.expand.deal_id.title}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHistoryModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE IMPORTAÇÃO DE PRODUTOS */}
      <ImportSpreadsheetModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Importar Produtos para o Estoque"
        entityName="produtos"
        templateFileName="modelo_importacao_produtos.csv"
        columns={[
          { key: 'sku', label: 'Código / SKU' },
          { key: 'name', label: 'Nome do Produto', required: true },
          { key: 'category', label: 'Categoria' },
          { key: 'unit', label: 'Unidade (UN, KG, CX, PC, M)' },
          { key: 'sale_price', label: 'Preço de Venda (R$)' },
          { key: 'cost_price', label: 'Preço de Custo (R$)' },
          { key: 'stock_quantity', label: 'Quantidade em Estoque' },
          { key: 'min_stock', label: 'Estoque Mínimo' },
          { key: 'description', label: 'Descrição' },
        ]}
        sampleData={[
          [
            'PROD-001',
            'Teclado Mecânico Sem Fio RGB',
            'Informática',
            'UN',
            '250.00',
            '120.00',
            '35',
            '10',
            'Switch azul padrão ABNT2 bluetooth',
          ],
          [
            'PROD-002',
            'Mouse Óptico Ergonômico USB',
            'Informática',
            'UN',
            '89.90',
            '38.00',
            '50',
            '15',
            '1600 DPI com fio reforçado',
          ],
          [
            'SUP-101',
            'Bobina Térmica 80mm x 40m',
            'Suprimentos',
            'CX',
            '120.00',
            '75.00',
            '20',
            '5',
            'Caixa com 30 rolos amarela',
          ],
        ]}
        processRow={(row, rowIndex) => {
          const normalized: Record<string, string> = {}
          for (const [k, v] of Object.entries(row)) {
            normalized[normalizeHeader(k)] = v
          }

          const sku =
            normalized['codigo'] ||
            normalized['codigo / sku'] ||
            normalized['sku'] ||
            normalized['cod'] ||
            ''

          const name =
            normalized['nome'] ||
            normalized['nome do produto'] ||
            normalized['produto'] ||
            normalized['descricao resumida'] ||
            ''

          const category = normalized['categoria'] || ''
          const unit = normalized['unidade'] || normalized['un'] || 'UN'
          const description = normalized['descricao'] || normalized['especificacoes'] || ''

          const rawSalePrice =
            normalized['preco de venda'] ||
            normalized['preco de venda (r$)'] ||
            normalized['preco venda'] ||
            normalized['venda'] ||
            '0'

          const rawCostPrice =
            normalized['preco de custo'] ||
            normalized['preco de custo (r$)'] ||
            normalized['preco custo'] ||
            normalized['custo'] ||
            '0'

          const rawStockQty =
            normalized['quantidade em estoque'] ||
            normalized['quantidade'] ||
            normalized['qtd estoque'] ||
            normalized['estoque'] ||
            '0'

          const rawMinStock =
            normalized['estoque minimo'] || normalized['minimo'] || normalized['qtd minima'] || '5'

          const salePrice = parseFloat(rawSalePrice.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0
          const costPrice = parseFloat(rawCostPrice.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0
          const stockQty = parseFloat(rawStockQty.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0
          const minStock = parseFloat(rawMinStock.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0

          const errors: string[] = []
          if (!name.trim()) {
            errors.push('Nome do produto é obrigatório')
          }
          if (salePrice < 0) {
            errors.push('Preço de venda inválido')
          }

          // Upsert se produto com mesmo SKU ou mesmo nome já existe
          const existing = products.find((p) => {
            if (sku && p.sku && p.sku.trim().toLowerCase() === sku.trim().toLowerCase()) return true
            if (p.name && p.name.trim().toLowerCase() === name.trim().toLowerCase()) return true
            return false
          })

          const data: Partial<Product> = {
            id: existing?.id,
            sku: sku.trim() || undefined,
            name: name.trim(),
            category: category.trim() || undefined,
            unit: unit.trim().toUpperCase() || 'UN',
            description: description.trim() || undefined,
            sale_price: salePrice,
            cost_price: costPrice,
            stock_quantity: stockQty,
            min_stock: minStock,
            active: true,
          }

          return {
            rowIndex,
            data,
            raw: row,
            isValid: errors.length === 0,
            errors,
            isUpdate: !!existing,
            existingRecordName: existing
              ? `${existing.name} (${existing.sku || 'sem sku'})`
              : undefined,
          }
        }}
        onConfirmImport={async (validItems) => {
          let imported = 0
          let updated = 0
          let ignored = 0

          for (const item of validItems) {
            try {
              if (item.isUpdate && item.data.id) {
                await stockService.updateProduct(item.data.id, item.data)
                updated++
              } else {
                const payload = { ...item.data, created_by: user?.id }
                delete payload.id
                await stockService.createProduct(payload)
                imported++
              }
            } catch (err) {
              console.error('Falha ao importar produto:', item.rowIndex, err)
              ignored++
            }
          }

          return { imported, updated, ignored }
        }}
        onSuccess={() => {
          loadProducts()
        }}
      />
    </div>
  )
}
