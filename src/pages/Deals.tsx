import React, { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { dealsService } from '@/services/deals'
import { clientsService } from '@/services/clients'
import { companyService } from '@/services/company'
import type { Deal, DealStage, Client, User } from '@/types/crm'
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

export default function PipelineDealsPage() {
  const { user } = useAuth()
  const [deals, setDeals] = useState<Deal[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [teamMembers, setTeamMembers] = useState<User[]>([])
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

  // Drag & Drop HTML5 nativo
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [dealsData, clientsData, teamData] = await Promise.all([
        dealsService.getAll(),
        clientsService.getAll(),
        companyService.getTeamMembers(),
      ])
      setDeals(dealsData)
      setClients(clientsData)
      setTeamMembers(teamData)
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
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (deal: Deal) => {
    setEditingDeal(deal)
    setFormTitle(deal.title || '')
    setFormClientId(deal.client_id || '')
    setFormValue(deal.value ? deal.value.toString() : '')
    setFormStage(deal.stage)
    setFormExpectedDate(deal.expected_close_date || '')
    setFormUserId(deal.user_id || '')
    setFormNotes(deal.notes || '')
    setIsDialogOpen(true)
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
      const payload: Partial<Deal> = {
        title: formTitle.trim(),
        client_id: formClientId,
        value: formValue ? parseFloat(formValue) : 0,
        stage: formStage,
        expected_close_date: formExpectedDate || undefined,
        user_id: formUserId || undefined,
        notes: formNotes.trim() || undefined,
      }

      if (editingDeal) {
        const updated = await dealsService.update(editingDeal.id, payload)
        toast({ title: 'Sucesso', description: 'Venda atualizada!' })
        setDeals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
      } else {
        payload.created_by = user?.id
        const created = await dealsService.create(payload)
        toast({ title: 'Sucesso', description: 'Nova oportunidade criada no pipeline!' })
        setDeals((prev) => [created, ...prev])
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
    } catch (err) {
      console.error(err)
      // Reverter se falhar
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
            Arraste os cards entre as etapas de Lead, Em Andamento, Ganho e Perdido.
          </p>
        </div>
        <Button onClick={() => handleOpenCreate()} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-1.5" /> Nova Oportunidade
        </Button>
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
                                title="Editar negócio"
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
                                >
                                  <CheckCircle className="h-3 w-3" /> Ganho!
                                </button>
                              </div>
                            )}

                            {stage.id === 'won' && (
                              <span className="text-emerald-700 font-semibold text-[11px] flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" /> Fechamento com Sucesso
                              </span>
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

      {/* MODAL CRIAR / EDITAR NEGÓCIO */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingDeal ? 'Editar Negócio' : 'Nova Oportunidade de Venda'}
            </DialogTitle>
            <DialogDescription>
              Vincule a venda a um cliente, defina o valor e a etapa inicial do pipeline.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="deal-title">Título do Negócio *</Label>
              <Input
                id="deal-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Ex: Implantação de Software ou Venda de Equipamentos"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="deal-client">Cliente Vinculado *</Label>
                {clients.length === 0 && (
                  <span className="text-[11px] text-rose-500">Cadastre um cliente antes!</span>
                )}
              </div>
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="deal-value">Valor Estimado (R$)</Label>
                <Input
                  id="deal-value"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  placeholder="0,00"
                />
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="deal-date">Previsão Fechamento</Label>
                <Input
                  id="deal-date"
                  type="date"
                  value={formExpectedDate}
                  onChange={(e) => setFormExpectedDate(e.target.value)}
                />
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
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="deal-notes">Observações do Negócio</Label>
              <Textarea
                id="deal-notes"
                rows={2}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Histórico da proposta, condições negociadas, etc."
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
