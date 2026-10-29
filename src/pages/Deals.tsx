import React, { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { dealsService } from '@/services/deals'
import { clientsService } from '@/services/clients'
import { companyService } from '@/services/company'
import { stockService } from '@/services/stock'
import { servicesCatalogService } from '@/services/servicesCatalog'
import { dealItemsService } from '@/services/dealItems'
import type { Deal, DealStage, Client, User, Product, Service, DealItem } from '@/types/crm'
import {
  Kanban,
  Plus,
  DollarSign,
  Calendar,
  Building,
  UserCheck,
  Edit,
  Trash2,
  FileText,
  Clock,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Package,
  Wrench,
  AlertTriangle,
  Receipt,
  ShoppingCart,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
import { useNavigate } from 'react-router-dom'

const STAGES: { id: DealStage; label: string; color: string; bgHeader: string }[] = [
  {
    id: 'lead',
    label: 'Lead / Primeiro Contato',
    color: 'text-slate-700',
    bgHeader: 'bg-slate-100 border-slate-300',
  },
  {
    id: 'in_progress',
    label: 'Em Andamento / Proposta',
    color: 'text-blue-700',
    bgHeader: 'bg-blue-50 border-blue-200',
  },
  {
    id: 'won',
    label: 'Ganho / Fechado',
    color: 'text-emerald-700',
    bgHeader: 'bg-emerald-50 border-emerald-200',
  },
  { id: 'lost', label: 'Perdido', color: 'text-rose-700', bgHeader: 'bg-rose-50 border-rose-200' },
]

interface DraftDealItem {
  id?: string
  item_type: 'product' | 'service'
  product_id?: string
  service_id?: string
  name_snapshot: string
  quantity: number
  unit_price: number
  total_price: number
}

export default function PipelineDealsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [deals, setDeals] = useState<Deal[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [teamMembers, setTeamMembers] = useState<User[]>([])
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([])
  const [catalogServices, setCatalogServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog Criar / Editar Venda
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form State
  const [formTitle, setFormTitle] = useState('')
  const [formClientId, setFormClientId] = useState('')
  const [formValue, setFormValue] = useState<string>('')
  const [formStage, setFormStage] = useState<DealStage>('lead')
  const [formExpectedDate, setFormExpectedDate] = useState('')
  const [formUserId, setFormUserId] = useState('')
  const [formNotes, setFormNotes] = useState('')

  // Itens da Venda
  const [dealItems, setDealItems] = useState<DraftDealItem[]>([])
  const [selectedItemType, setSelectedItemType] = useState<'product' | 'service'>('product')
  const [selectedCatalogId, setSelectedCatalogId] = useState('')
  const [addItemQty, setAddItemQty] = useState('1')

  // Drag & Drop HTML5 nativo
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [dealsData, clientsData, teamData, productsData, servicesData] = await Promise.all([
        dealsService.getAll(),
        clientsService.getAll(),
        companyService.getTeamMembers(),
        stockService.getProducts(),
        servicesCatalogService.getAll(),
      ])
      setDeals(dealsData)
      setClients(clientsData)
      setTeamMembers(teamData)
      setCatalogProducts(productsData)
      setCatalogServices(servicesData)
    } catch (err) {
      console.error('Erro ao carregar pipeline:', err)
      toast({
        title: 'Erro',
        description: 'Falha ao buscar negócios do pipeline.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCreate = (predefinedStage?: DealStage) => {
    setEditingDeal(null)
    setFormTitle('')
    setFormClientId(clients[0]?.id || '')
    setFormValue('')
    setFormStage(predefinedStage || 'lead')
    setFormExpectedDate('')
    setFormUserId(user?.id || '')
    setFormNotes('')
    setDealItems([])
    setSelectedCatalogId(catalogProducts[0]?.id || '')
    setSelectedItemType('product')
    setAddItemQty('1')
    setIsDialogOpen(true)
  }

  const handleOpenEdit = async (deal: Deal) => {
    setEditingDeal(deal)
    setFormTitle(deal.title || '')
    setFormClientId(deal.client_id || '')
    setFormValue(deal.value ? deal.value.toString() : '')
    setFormStage(deal.stage)
    setFormExpectedDate(deal.expected_close_date || '')
    setFormUserId(deal.user_id || '')
    setFormNotes(deal.notes || '')

    // Carregar itens existentes
    try {
      const items = await dealItemsService.getByDealId(deal.id)
      setDealItems(
        items.map((i) => ({
          id: i.id,
          item_type: i.item_type,
          product_id: i.product_id,
          service_id: i.service_id,
          name_snapshot: i.name_snapshot,
          quantity: i.quantity,
          unit_price: i.unit_price,
          total_price: i.total_price,
        })),
      )
    } catch {
      setDealItems([])
    }

    setIsDialogOpen(true)
  }

  // Adicionar item à lista da venda
  const handleAddItem = () => {
    if (!selectedCatalogId) return
    const qty = parseFloat(addItemQty) || 1

    if (selectedItemType === 'product') {
      const prod = catalogProducts.find((p) => p.id === selectedCatalogId)
      if (!prod) return
      const unitPrice = prod.sale_price || 0
      const newItem: DraftDealItem = {
        item_type: 'product',
        product_id: prod.id,
        name_snapshot: prod.name,
        quantity: qty,
        unit_price: unitPrice,
        total_price: qty * unitPrice,
      }
      const updated = [...dealItems, newItem]
      setDealItems(updated)
      recalcTotal(updated)
    } else {
      const srv = catalogServices.find((s) => s.id === selectedCatalogId)
      if (!srv) return
      const unitPrice = srv.price || 0
      const newItem: DraftDealItem = {
        item_type: 'service',
        service_id: srv.id,
        name_snapshot: srv.name,
        quantity: qty,
        unit_price: unitPrice,
        total_price: qty * unitPrice,
      }
      const updated = [...dealItems, newItem]
      setDealItems(updated)
      recalcTotal(updated)
    }
    setAddItemQty('1')
  }

  const handleRemoveItem = (index: number) => {
    const updated = dealItems.filter((_, idx) => idx !== index)
    setDealItems(updated)
    recalcTotal(updated)
  }

  const handleUpdateItemQty = (index: number, newQty: number) => {
    const updated = dealItems.map((item, idx) => {
      if (idx !== index) return item
      const qty = Math.max(1, newQty)
      return {
        ...item,
        quantity: qty,
        total_price: qty * item.unit_price,
      }
    })
    setDealItems(updated)
    recalcTotal(updated)
  }

  const handleUpdateItemPrice = (index: number, newPrice: number) => {
    const updated = dealItems.map((item, idx) => {
      if (idx !== index) return item
      const price = Math.max(0, newPrice)
      return {
        ...item,
        unit_price: price,
        total_price: item.quantity * price,
      }
    })
    setDealItems(updated)
    recalcTotal(updated)
  }

  const recalcTotal = (items: DraftDealItem[]) => {
    if (items.length > 0) {
      const sum = items.reduce((acc, i) => acc + i.total_price, 0)
      setFormValue(sum.toFixed(2))
    }
  }

  // Baixa automática de estoque para itens de produto ao fechar como Ganho
  const processStockExitForWonDeal = async (dealId: string) => {
    try {
      const items = await dealItemsService.getByDealId(dealId)
      const productItems = items.filter((i) => i.item_type === 'product' && i.product_id)

      if (productItems.length === 0) return

      for (const item of productItems) {
        if (!item.product_id) continue
        await stockService.createMovement({
          productId: item.product_id,
          type: 'exit',
          quantity: item.quantity,
          reason: `Venda concluída (Pedido #${dealId.substring(0, 6)}: ${item.name_snapshot})`,
          dealId: dealId,
          userId: user?.id,
        })
      }

      toast({
        title: 'Estoque Atualizado',
        description: `Saída automática de ${productItems.length} produto(s) realizada no estoque com sucesso!`,
      })
    } catch (err) {
      console.error('Erro na baixa de estoque automática:', err)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitle.trim() || !formClientId) {
      toast({
        title: 'Atenção',
        description: 'Título e cliente são obrigatórios.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      const calculatedVal =
        dealItems.length > 0
          ? dealItems.reduce((acc, i) => acc + i.total_price, 0)
          : formValue
            ? parseFloat(formValue)
            : 0

      const payload: Partial<Deal> = {
        title: formTitle.trim(),
        client_id: formClientId,
        value: calculatedVal,
        stage: formStage,
        expected_close_date: formExpectedDate || undefined,
        user_id: formUserId || undefined,
        notes: formNotes.trim() || undefined,
      }

      let targetDeal: Deal

      if (editingDeal) {
        targetDeal = await dealsService.update(editingDeal.id, payload)
        toast({ title: 'Sucesso', description: 'Venda atualizada!' })
        setDeals((prev) => prev.map((d) => (d.id === targetDeal.id ? targetDeal : d)))
      } else {
        payload.created_by = user?.id
        targetDeal = await dealsService.create(payload)
        toast({ title: 'Sucesso', description: 'Nova oportunidade criada no pipeline!' })
        setDeals((prev) => [targetDeal, ...prev])
      }

      // Sincroniza os itens da venda
      await dealItemsService.syncItemsForDeal(targetDeal.id, dealItems)

      // Se foi salvo já como Ganho, baixa o estoque
      if (formStage === 'won' && (!editingDeal || editingDeal.stage !== 'won')) {
        await processStockExitForWonDeal(targetDeal.id)
      }

      setIsDialogOpen(false)
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao salvar oportunidade',
        description: err.message || 'Verifique os dados preenchidos.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta venda do pipeline?')) return
    try {
      await dealsService.delete(id)
      toast({ title: 'Excluído', description: 'Oportunidade removida do CRM.' })
      setDeals((prev) => prev.filter((d) => d.id !== id))
    } catch {
      toast({
        title: 'Erro',
        description: 'Falha ao remover a oportunidade.',
        variant: 'destructive',
      })
    }
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id)
    setDraggedDealId(id)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent, targetStage: DealStage) => {
    e.preventDefault()
    const dealId = e.dataTransfer.getData('text/plain') || draggedDealId
    if (!dealId) return

    const currentDeal = deals.find((d) => d.id === dealId)
    if (!currentDeal || currentDeal.stage === targetStage) return

    // Atualização otimista
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage: targetStage } : d)))

    try {
      await dealsService.updateStage(dealId, targetStage)
      toast({
        title: 'Etapa Atualizada',
        description: `Venda movida para "${STAGES.find((s) => s.id === targetStage)?.label}".`,
      })

      // Se moveu para Ganho (won), baixa o estoque dos produtos
      if (targetStage === 'won') {
        await processStockExitForWonDeal(dealId)
      }
    } catch (err) {
      console.error(err)
      setDeals((prev) =>
        prev.map((d) => (d.id === dealId ? { ...d, stage: currentDeal.stage } : d)),
      )
      toast({
        title: 'Erro',
        description: 'Não foi possível mover a venda.',
        variant: 'destructive',
      })
    } finally {
      setDraggedDealId(null)
    }
  }

  const handleQuickMove = async (dealId: string, targetStage: DealStage) => {
    const currentDeal = deals.find((d) => d.id === dealId)
    if (!currentDeal || currentDeal.stage === targetStage) return

    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage: targetStage } : d)))

    try {
      await dealsService.updateStage(dealId, targetStage)
      toast({
        title: 'Etapa Atualizada',
        description: `Venda movida com sucesso.`,
      })

      // Se marcou como Ganho, dar baixa automática de estoque
      if (targetStage === 'won') {
        await processStockExitForWonDeal(dealId)
      }
    } catch {
      setDeals((prev) =>
        prev.map((d) => (d.id === dealId ? { ...d, stage: currentDeal.stage } : d)),
      )
    }
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Kanban className="h-7 w-7 text-blue-600" />
            Funil de Vendas (Pipeline)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Componha propostas com produtos do estoque e catálogo de serviços. Ao marcar como Ganho,
            a baixa de estoque ocorre automaticamente!
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => navigate('/notas-fiscais')} variant="outline" size="sm">
            <Receipt className="h-4 w-4 mr-1.5 text-blue-600" /> Notas Fiscais
          </Button>
          <Button onClick={() => handleOpenCreate()} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-1.5" /> Nova Oportunidade
          </Button>
        </div>
      </div>

      {/* PIPELINE KANBAN COLUMNS */}
      {loading ? (
        <div className="p-16 text-center text-slate-500">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2"></div>
          <p className="text-sm">Carregando oportunidades no pipeline...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {STAGES.map((stage) => {
            const stageDeals = deals.filter((d) => d.stage === stage.id)
            const totalStageValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0)

            return (
              <div
                key={stage.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.id)}
                className="bg-slate-100/80 rounded-xl p-3 border border-slate-200/80 min-h-[500px] flex flex-col"
              >
                {/* Header da Coluna */}
                <div className={`p-3 rounded-lg border mb-3 ${stage.bgHeader}`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-bold text-sm ${stage.color}`}>{stage.label}</span>
                    <Badge
                      variant="secondary"
                      className="bg-white/80 text-slate-700 text-xs font-semibold"
                    >
                      {stageDeals.length}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                    <span>Total da etapa:</span>
                    <span className="font-bold">{formatCurrency(totalStageValue)}</span>
                  </div>
                </div>

                {/* Lista de Cards da Etapa */}
                <div className="flex-1 space-y-3">
                  {stageDeals.map((deal) => {
                    const client =
                      clients.find((c) => c.id === deal.client_id) || deal.expand?.client_id
                    const assignedUser =
                      teamMembers.find((m) => m.id === deal.user_id) || deal.expand?.user_id

                    return (
                      <Card
                        key={deal.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, deal.id)}
                        className="cursor-grab active:cursor-grabbing border-slate-200 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all bg-white"
                      >
                        <CardContent className="p-3.5 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2">
                              {deal.title}
                            </h4>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleOpenEdit(deal)}
                                className="text-slate-400 hover:text-blue-600 p-0.5 rounded"
                                title="Editar negócio e itens"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(deal.id)}
                                className="text-slate-400 hover:text-rose-600 p-0.5 rounded"
                                title="Excluir negócio"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Valor da Venda */}
                          <div className="text-base font-extrabold text-blue-700 flex items-center">
                            {formatCurrency(deal.value || 0)}
                          </div>

                          {/* Cliente Vinculado */}
                          <div className="text-xs text-slate-600 flex items-center gap-1.5 font-medium truncate">
                            <Building className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">
                              {client?.name || 'Cliente não encontrado'}
                            </span>
                          </div>

                          {/* Previsão de Fechamento */}
                          {deal.expected_close_date && (
                            <div className="text-[11px] text-slate-500 flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-slate-400 shrink-0" />
                              <span>Previsão: {deal.expected_close_date}</span>
                            </div>
                          )}

                          {/* Responsável */}
                          {assignedUser && (
                            <div className="text-[11px] text-slate-600 flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded">
                              <UserCheck className="h-3 w-3 text-blue-500 shrink-0" />
                              <span className="truncate">{assignedUser.name}</span>
                            </div>
                          )}

                          {/* Notas */}
                          {deal.notes && (
                            <p className="text-[11px] text-slate-400 line-clamp-1 italic mt-1">
                              "{deal.notes}"
                            </p>
                          )}

                          {/* Botões de Avanço Rápido de Etapa */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                            {stage.id === 'lead' && (
                              <button
                                onClick={() => handleQuickMove(deal.id, 'in_progress')}
                                className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium ml-auto"
                              >
                                Enviar Proposta <ArrowRight className="h-3 w-3" />
                              </button>
                            )}

                            {stage.id === 'in_progress' && (
                              <div className="flex items-center justify-between w-full">
                                <button
                                  onClick={() => handleQuickMove(deal.id, 'lost')}
                                  className="text-rose-600 hover:underline inline-flex items-center gap-0.5"
                                >
                                  <XCircle className="h-3 w-3" /> Perdido
                                </button>
                                <button
                                  onClick={() => handleQuickMove(deal.id, 'won')}
                                  className="text-emerald-600 hover:underline inline-flex items-center gap-0.5 font-bold"
                                  title="Marcar como ganho e dar baixa no estoque dos produtos"
                                >
                                  <CheckCircle className="h-3 w-3" /> Ganho!
                                </button>
                              </div>
                            )}

                            {stage.id === 'won' && (
                              <div className="flex items-center justify-between w-full">
                                <span className="text-emerald-700 font-semibold text-[11px] flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" /> Ganho (Estoque Baixado)
                                </span>
                                <button
                                  onClick={() => navigate('/notas-fiscais')}
                                  className="text-blue-600 hover:underline inline-flex items-center gap-1 text-[11px]"
                                  title="Emitir NF-e ou NFS-e desta venda"
                                >
                                  <Receipt className="h-3 w-3" /> Emitir Nota
                                </button>
                              </div>
                            )}

                            {stage.id === 'lost' && (
                              <button
                                onClick={() => handleQuickMove(deal.id, 'lead')}
                                className="text-slate-600 hover:underline inline-flex items-center gap-1 ml-auto"
                              >
                                Reativar Lead <ArrowLeft className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}

                  {stageDeals.length === 0 && (
                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center text-xs text-slate-400">
                      Nenhuma oportunidade nesta etapa.
                    </div>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenCreate(stage.id)}
                  className="mt-3 w-full text-xs text-slate-600 hover:bg-white border border-dashed border-slate-300"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar nesta etapa
                </Button>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL CRIAR / EDITAR NEGÓCIO COM COMPOSIÇÃO DE ITENS */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingDeal ? 'Editar Negócio e Itens' : 'Nova Oportunidade de Venda'}
            </DialogTitle>
            <DialogDescription>
              Vincule a venda ao cliente e componha itens de produtos (estoque) e serviços
              (catálogo).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="deal-title">Título do Negócio *</Label>
              <Input
                id="deal-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Ex: Implantação de Software + Terminais POS"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="deal-client">Cliente Vinculado *</Label>
                <select
                  id="deal-client"
                  value={formClientId}
                  onChange={(e) => setFormClientId(e.target.value)}
                  required
                  className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
                >
                  <option value="">Selecione um cliente...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.company ? `(${c.company})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="deal-stage">Etapa do Funil</Label>
                <select
                  id="deal-stage"
                  value={formStage}
                  onChange={(e) => setFormStage(e.target.value as DealStage)}
                  className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
                >
                  {STAGES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* SEÇÃO DE COMPOSIÇÃO DE ITENS (PRODUTO / SERVIÇO) */}
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/70 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShoppingCart className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Composição da Venda (Produtos & Serviços)
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  {dealItems.length} item(ns) adicionado(s)
                </span>
              </div>

              {/* Seletor para adicionar novo item */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-white p-2.5 rounded-md border border-slate-200">
                <div className="sm:col-span-3">
                  <select
                    value={selectedItemType}
                    onChange={(e) => {
                      const type = e.target.value as 'product' | 'service'
                      setSelectedItemType(type)
                      setSelectedCatalogId(
                        type === 'product'
                          ? catalogProducts[0]?.id || ''
                          : catalogServices[0]?.id || '',
                      )
                    }}
                    className="w-full h-8 rounded border border-input bg-background px-2 text-xs font-semibold"
                  >
                    <option value="product">📦 Produto (Estoque)</option>
                    <option value="service">🛠️ Serviço (Catálogo)</option>
                  </select>
                </div>

                <div className="sm:col-span-5">
                  <select
                    value={selectedCatalogId}
                    onChange={(e) => setSelectedCatalogId(e.target.value)}
                    className="w-full h-8 rounded border border-input bg-background px-2 text-xs"
                  >
                    <option value="">Selecione o item...</option>
                    {selectedItemType === 'product'
                      ? catalogProducts.map((p) => {
                          const isLow = (p.stock_quantity ?? 0) <= 0
                          return (
                            <option key={p.id} value={p.id}>
                              {p.name} — {formatCurrency(p.sale_price || 0)}{' '}
                              {isLow
                                ? '(⚠️ Estoque zerado)'
                                : `(Estoque: ${p.stock_quantity ?? 0})`}
                            </option>
                          )
                        })
                      : catalogServices.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} — {formatCurrency(s.price || 0)}
                          </option>
                        ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={addItemQty}
                    onChange={(e) => setAddItemQty(e.target.value)}
                    placeholder="Qtd"
                    className="h-8 text-xs text-center"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddItem}
                    disabled={!selectedCatalogId}
                    className="w-full h-8 bg-blue-600 hover:bg-blue-700 text-xs px-2"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Incluir
                  </Button>
                </div>
              </div>

              {/* Tabela de itens incluídos */}
              {dealItems.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {dealItems.map((item, idx) => {
                    // Checar estoque do produto para aviso
                    const productObj =
                      item.item_type === 'product' && item.product_id
                        ? catalogProducts.find((p) => p.id === item.product_id)
                        : null

                    const stockAvail = productObj?.stock_quantity ?? 999
                    const isInsufficient =
                      item.item_type === 'product' && stockAvail < item.quantity

                    return (
                      <div
                        key={idx}
                        className={`p-2 rounded border bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                          isInsufficient ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {item.item_type === 'product' ? (
                              <Package className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                            ) : (
                              <Wrench className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                            )}
                            <span className="font-semibold text-slate-800 truncate">
                              {item.name_snapshot}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1 py-0 border-slate-200"
                            >
                              {item.item_type === 'product' ? 'Produto' : 'Serviço'}
                            </Badge>
                          </div>

                          {isInsufficient && (
                            <p className="text-[11px] text-amber-700 font-medium flex items-center gap-1 mt-0.5">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              Aviso: estoque atual ({stockAvail}) é inferior à quantidade
                              solicitada.
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-slate-400">Qtd:</span>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                handleUpdateItemQty(idx, parseFloat(e.target.value) || 1)
                              }
                              className="h-7 w-14 text-xs text-center p-1"
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-slate-400">Unit:</span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unit_price}
                              onChange={(e) =>
                                handleUpdateItemPrice(idx, parseFloat(e.target.value) || 0)
                              }
                              className="h-7 w-20 text-xs text-right p-1"
                            />
                          </div>

                          <span className="font-bold text-slate-900 w-20 text-right">
                            {formatCurrency(item.total_price)}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1"
                            title="Remover item"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-2 italic">
                  Nenhum item adicionado ainda. Você pode adicionar produtos e serviços acima ou
                  definir o valor manualmente abaixo.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="deal-value">Valor Total do Negócio (R$)</Label>
                <Input
                  id="deal-value"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  placeholder="0,00"
                  className={dealItems.length > 0 ? 'bg-slate-50 font-bold text-blue-700' : ''}
                />
                {dealItems.length > 0 && (
                  <p className="text-[10px] text-slate-400">
                    Calculado automaticamente da soma dos itens.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="deal-date">Previsão Fechamento</Label>
                <Input
                  id="deal-date"
                  type="date"
                  value={formExpectedDate}
                  onChange={(e) => setFormExpectedDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="deal-user">Responsável</Label>
              <select
                id="deal-user"
                value={formUserId}
                onChange={(e) => setFormUserId(e.target.value)}
                className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
              >
                <option value="">Não atribuído</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="deal-notes">Observações do Negócio</Label>
              <Textarea
                id="deal-notes"
                rows={2}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Condições comerciais negociadas, prazos, etc."
              />
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={submitting}>
                {submitting
                  ? 'Salvando...'
                  : editingDeal
                    ? 'Atualizar Venda'
                    : 'Salvar no Pipeline'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
