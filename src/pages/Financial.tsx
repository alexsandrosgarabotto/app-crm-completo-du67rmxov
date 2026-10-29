import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { invoicesService } from '@/services/invoices'
import { clientsService } from '@/services/clients'
import { dealsService } from '@/services/deals'
import { fixedCostsService } from '@/services/fixedCosts'
import type {
  Invoice,
  InvoiceType,
  InvoiceStatus,
  Client,
  Deal,
  FixedCost,
  FixedCostCategory,
} from '@/types/crm'
import {
  ReceiptText,
  Plus,
  ArrowUpCircle,
  ArrowDownCircle,
  CheckCircle,
  Clock,
  Search,
  DollarSign,
  Edit,
  Trash2,
  Building,
  Calendar,
  Layers,
  Power,
  SendHorizontal,
  TrendingDown,
  Users2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

export default function FinancialPage() {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)

  const [searchParams, setSearchParams] = useSearchParams()

  // Aba principal: Faturas (contas a receber / pagar) ou Custos Fixos Mensais
  const currentTabParam = searchParams.get('aba')
  const [mainView, setMainView] = useState<'invoices' | 'fixed_costs'>(
    currentTabParam === 'custos-fixos' ? 'fixed_costs' : 'invoices',
  )

  // Custos Fixos State
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([])
  const [loadingCosts, setLoadingCosts] = useState(false)
  const [costCategoryFilter, setCostCategoryFilter] = useState<string>('all')
  const [costStatusFilter, setCostStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [costSearch, setCostSearch] = useState('')

  // Dialog Custo Fixo
  const [isCostDialogOpen, setIsCostDialogOpen] = useState(false)
  const [editingCost, setEditingCost] = useState<FixedCost | null>(null)
  const [submittingCost, setSubmittingCost] = useState(false)
  const [launchingCostId, setLaunchingCostId] = useState<string | null>(null)

  // Form Custo Fixo State
  const [costFormName, setCostFormName] = useState('')
  const [costFormCategory, setCostFormCategory] = useState<FixedCostCategory>('salarios')
  const [costFormAmount, setCostFormAmount] = useState('')
  const [costFormDueDay, setCostFormDueDay] = useState('5')
  const [costFormActive, setCostFormActive] = useState(true)
  const [costFormNotes, setCostFormNotes] = useState('')

  // Filtros Faturas
  const [activeTab, setActiveTab] = useState<'all' | 'receivable' | 'payable'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all')
  const [search, setSearch] = useState('')

  // Dialog Criar/Editar Fatura
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form State
  const [formDescription, setFormDescription] = useState('')
  const [formType, setFormType] = useState<InvoiceType>('receivable')
  const [formAmount, setFormAmount] = useState('')
  const [formDueDate, setFormDueDate] = useState('')
  const [formStatus, setFormStatus] = useState<InvoiceStatus>('pending')
  const [formClientId, setFormClientId] = useState('')
  const [formDealId, setFormDealId] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formNotes, setFormNotes] = useState('')

  // Sincroniza mainView quando a URL query parameter mudar
  useEffect(() => {
    const tab = searchParams.get('aba')
    if (tab === 'custos-fixos') {
      setMainView('fixed_costs')
    } else if (!tab && mainView === 'fixed_costs' && currentTabParam === null) {
      // mantém
    }
  }, [searchParams])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [invData, clientsData, dealsData, costsData] = await Promise.all([
        invoicesService.getAll(),
        clientsService.getAll(),
        dealsService.getAll(),
        fixedCostsService.getAll(),
      ])
      setInvoices(invData)
      setClients(clientsData)
      setDeals(dealsData)
      setFixedCosts(costsData)
    } catch (err) {
      console.error('Erro ao carregar dados financeiros:', err)
      toast({
        title: 'Erro',
        description: 'Falha ao buscar lançamentos financeiros.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadFixedCosts = async () => {
    setLoadingCosts(true)
    try {
      const data = await fixedCostsService.getAll()
      setFixedCosts(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingCosts(false)
    }
  }

  const handleOpenCreate = (predefinedType?: InvoiceType) => {
    const today = new Date().toISOString().split('T')[0]
    setEditingInvoice(null)
    setFormDescription('')
    setFormType(predefinedType || 'receivable')
    setFormAmount('')
    setFormDueDate(today)
    setFormStatus('pending')
    setFormClientId('')
    setFormDealId('')
    setFormCategory('')
    setFormNotes('')
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (inv: Invoice) => {
    setEditingInvoice(inv)
    setFormDescription(inv.description || '')
    setFormType(inv.type)
    setFormAmount(inv.amount ? inv.amount.toString() : '')
    setFormDueDate(inv.due_date || '')
    setFormStatus(inv.status)
    setFormClientId(inv.client_id || '')
    setFormDealId(inv.deal_id || '')
    setFormCategory(inv.category || '')
    setFormNotes(inv.notes || '')
    setIsDialogOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formDescription.trim() || !formAmount || !formDueDate) {
      toast({
        title: 'Atenção',
        description: 'Descrição, valor e vencimento são obrigatórios.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      const payload: Partial<Invoice> = {
        description: formDescription.trim(),
        type: formType,
        amount: parseFloat(formAmount),
        due_date: formDueDate,
        status: formStatus,
        client_id: formClientId || undefined,
        deal_id: formDealId || undefined,
        category: formCategory.trim() || undefined,
        notes: formNotes.trim() || undefined,
      }

      if (formStatus === 'paid') {
        payload.paid_date = new Date().toISOString().split('T')[0]
      }

      if (editingInvoice) {
        const updated = await invoicesService.update(editingInvoice.id, payload)
        toast({ title: 'Sucesso', description: 'Lançamento financeiro atualizado!' })
        setInvoices((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
      } else {
        payload.created_by = user?.id
        const created = await invoicesService.create(payload)
        toast({ title: 'Sucesso', description: 'Conta/Fatura cadastrada com sucesso!' })
        setInvoices((prev) => [created, ...prev])
      }

      setIsDialogOpen(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Verifique as informações preenchidas.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleTogglePaid = async (inv: Invoice) => {
    const nextStatus: InvoiceStatus = inv.status === 'paid' ? 'pending' : 'paid'
    try {
      setInvoices((prev) => prev.map((i) => (i.id === inv.id ? { ...i, status: nextStatus } : i)))
      await invoicesService.updateStatus(inv.id, nextStatus)
      toast({
        title: nextStatus === 'paid' ? 'Marcada como Paga!' : 'Marcada como Pendente',
        description: inv.description,
      })
    } catch {
      setInvoices((prev) => prev.map((i) => (i.id === inv.id ? { ...i, status: inv.status } : i)))
      toast({
        title: 'Erro',
        description: 'Não foi possível alterar a fatura.',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Deseja realmente excluir este lançamento financeiro?')) return
    try {
      await invoicesService.delete(id)
      toast({ title: 'Excluído', description: 'Lançamento financeiro removido.' })
      setInvoices((prev) => prev.filter((i) => i.id !== id))
    } catch {
      toast({ title: 'Erro', description: 'Falha ao excluir lançamento.', variant: 'destructive' })
    }
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  // Handlers Custos Fixos
  const handleOpenCreateCost = () => {
    setEditingCost(null)
    setCostFormName('')
    setCostFormCategory('salarios')
    setCostFormAmount('')
    setCostFormDueDay('5')
    setCostFormActive(true)
    setCostFormNotes('')
    setIsCostDialogOpen(true)
  }

  const handleOpenEditCost = (cost: FixedCost) => {
    setEditingCost(cost)
    setCostFormName(cost.name || '')
    setCostFormCategory(cost.category || 'outros')
    setCostFormAmount(cost.amount ? cost.amount.toString() : '')
    setCostFormDueDay(cost.due_day ? cost.due_day.toString() : '5')
    setCostFormActive(cost.active !== false)
    setCostFormNotes(cost.notes || '')
    setIsCostDialogOpen(true)
  }

  const handleSaveCost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!costFormName.trim() || !costFormAmount) {
      toast({
        title: 'Atenção',
        description: 'Nome e valor do custo fixo são obrigatórios.',
        variant: 'destructive',
      })
      return
    }

    setSubmittingCost(true)
    try {
      const payload: Partial<FixedCost> = {
        name: costFormName.trim(),
        category: costFormCategory,
        amount: parseFloat(costFormAmount) || 0,
        due_day: parseInt(costFormDueDay, 10) || 5,
        active: costFormActive,
        notes: costFormNotes.trim() || undefined,
      }

      if (editingCost) {
        const updated = await fixedCostsService.update(editingCost.id, payload)
        toast({ title: 'Sucesso', description: 'Custo fixo atualizado!' })
        setFixedCosts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      } else {
        payload.created_by = user?.id
        const created = await fixedCostsService.create(payload)
        toast({ title: 'Sucesso', description: 'Custo fixo cadastrado com sucesso!' })
        setFixedCosts((prev) => [created, ...prev])
      }

      setIsCostDialogOpen(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Verifique as informações.',
        variant: 'destructive',
      })
    } finally {
      setSubmittingCost(false)
    }
  }

  const handleToggleCostActive = async (cost: FixedCost) => {
    try {
      const updated = await fixedCostsService.toggleActive(cost.id, cost.active)
      setFixedCosts((prev) => prev.map((c) => (c.id === cost.id ? updated : c)))
      toast({
        title: updated.active ? 'Custo ativado' : 'Custo desativado',
        description: `${cost.name} agora está ${updated.active ? 'ativo' : 'inativo'}.`,
      })
    } catch {
      toast({
        title: 'Erro',
        description: 'Não foi possível alterar status do custo fixo.',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteCost = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este custo fixo?')) return
    try {
      await fixedCostsService.delete(id)
      setFixedCosts((prev) => prev.filter((c) => c.id !== id))
      toast({ title: 'Removido', description: 'Custo fixo excluído com sucesso.' })
    } catch {
      toast({ title: 'Erro', description: 'Falha ao excluir custo fixo.', variant: 'destructive' })
    }
  }

  // Verifica se o custo já foi lançado como fatura a pagar no mês/ano atual
  const currentYearMonth = new Date().toISOString().substring(0, 7) // 'YYYY-MM'
  const isCostLaunchedInCurrentMonth = (cost: FixedCost) => {
    return invoices.some((inv) => {
      const isPayable = inv.type === 'payable'
      const matchMonth = inv.due_date?.startsWith(currentYearMonth)
      const matchName =
        inv.description.toLowerCase().includes(cost.name.toLowerCase()) ||
        inv.notes?.includes(`[CustoFixoId:${cost.id}]`)
      return isPayable && matchMonth && matchName
    })
  }

  // Lança o custo fixo como fatura a pagar no mês atual
  const handleLaunchCostInCurrentMonth = async (cost: FixedCost) => {
    if (isCostLaunchedInCurrentMonth(cost)) {
      if (
        !window.confirm(
          `Já existe um lançamento para "${cost.name}" neste mês (${currentYearMonth}). Deseja lançar novamente?`,
        )
      ) {
        return
      }
    }

    setLaunchingCostId(cost.id)
    try {
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(Math.min(cost.due_day || 5, 28)).padStart(2, '0')
      const dueDate = `${year}-${month}-${day}`

      const payload: Partial<Invoice> = {
        description: `[Custo Fixo] ${cost.name}`,
        type: 'payable',
        amount: cost.amount,
        status: 'pending',
        due_date: dueDate,
        category: categoryLabels[cost.category] || cost.category,
        notes: `Gerado automaticamente a partir de Custos Fixos Mensais. [CustoFixoId:${cost.id}]`,
        created_by: user?.id,
      }

      const created = await invoicesService.create(payload)
      setInvoices((prev) => [created, ...prev])
      toast({
        title: 'Lançado no Financeiro!',
        description: `Conta a pagar de ${formatCurrency(cost.amount)} gerada com vencimento em ${dueDate}.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao lançar',
        description: err.message || 'Não foi possível gerar a fatura a pagar.',
        variant: 'destructive',
      })
    } finally {
      setLaunchingCostId(null)
    }
  }

  const categoryLabels: Record<FixedCostCategory, string> = {
    salarios: 'Salários e Encargos',
    aluguel: 'Aluguel de Imóvel',
    energia: 'Energia Elétrica',
    agua: 'Água e Esgoto',
    internet: 'Internet e Conectividade',
    telefone: 'Telefonia / Celular',
    marketing: 'Marketing e Publicidade',
    contabilidade: 'Assessoria Contábil',
    outros: 'Outras Despesas Fixas',
  }

  // Cálculos Custos Fixos
  const activeFixedCosts = fixedCosts.filter((c) => c.active !== false)
  const totalMonthlyFixedCosts = activeFixedCosts.reduce((sum, c) => sum + (c.amount || 0), 0)
  const maxExpense = activeFixedCosts.reduce<FixedCost | null>((max, c) => {
    if (!max || (c.amount || 0) > (max.amount || 0)) return c
    return max
  }, null)
  const totalSalaries = activeFixedCosts
    .filter((c) => c.category === 'salarios')
    .reduce((sum, c) => sum + (c.amount || 0), 0)

  // Filtragem Custos Fixos
  const filteredCosts = fixedCosts.filter((c) => {
    const matchesCategory = costCategoryFilter === 'all' || c.category === costCategoryFilter
    const matchesStatus =
      costStatusFilter === 'all' ||
      (costStatusFilter === 'active' && c.active !== false) ||
      (costStatusFilter === 'inactive' && c.active === false)
    const matchesSearch =
      c.name.toLowerCase().includes(costSearch.toLowerCase()) ||
      (categoryLabels[c.category] &&
        categoryLabels[c.category].toLowerCase().includes(costSearch.toLowerCase()))
    return matchesCategory && matchesStatus && matchesSearch
  })

  // Cálculos de Totais Faturas
  const receivables = invoices.filter((i) => i.type === 'receivable')
  const payables = invoices.filter((i) => i.type === 'payable')

  const totalReceivables = receivables.reduce((sum, i) => sum + i.amount, 0)
  const paidReceivables = receivables
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + i.amount, 0)
  const pendingReceivables = totalReceivables - paidReceivables

  const totalPayables = payables.reduce((sum, i) => sum + i.amount, 0)
  const paidPayables = payables
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + i.amount, 0)
  const pendingPayables = totalPayables - paidPayables

  const netBalance = paidReceivables - paidPayables

  // Filtragem da lista
  const filteredInvoices = invoices.filter((inv) => {
    const matchesTab = activeTab === 'all' || inv.type === activeTab
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter
    const matchesSearch =
      inv.description.toLowerCase().includes(search.toLowerCase()) ||
      (inv.category && inv.category.toLowerCase().includes(search.toLowerCase()))

    return matchesTab && matchesStatus && matchesSearch
  })

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            {mainView === 'fixed_costs' ? (
              <DollarSign className="h-7 w-7 text-amber-600" />
            ) : (
              <ReceiptText className="h-7 w-7 text-blue-600" />
            )}
            Gestão Financeira
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {mainView === 'fixed_costs'
              ? 'Custos fixos mensais, folha de salários e despesas recorrentes da empresa.'
              : 'Acompanhe contas a receber de vendas, contas a pagar da empresa e fluxo de caixa.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mainView === 'fixed_costs' ? (
            <Button onClick={handleOpenCreateCost} className="bg-amber-600 hover:bg-amber-700">
              <Plus className="h-4 w-4 mr-1.5" /> Novo Custo Fixo
            </Button>
          ) : (
            <>
              <Button
                onClick={() => handleOpenCreate('receivable')}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4 mr-1.5" /> A Receber
              </Button>
              <Button
                onClick={() => handleOpenCreate('payable')}
                variant="outline"
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
              >
                <Plus className="h-4 w-4 mr-1.5" /> A Pagar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Navegação entre Módulos Internos do Financeiro */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => {
            setMainView('invoices')
            setSearchParams({})
          }}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors flex items-center gap-2 ${
            mainView === 'invoices'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ReceiptText className="h-4 w-4" />
          Faturas & Contas (Receber/Pagar)
        </button>
        <button
          onClick={() => {
            setMainView('fixed_costs')
            setSearchParams({ aba: 'custos-fixos' })
          }}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors flex items-center gap-2 ${
            mainView === 'fixed_costs'
              ? 'border-amber-600 text-amber-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <DollarSign className="h-4 w-4" />
          Custos Fixos Mensais
          <Badge className="ml-1 bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0 border-0">
            {activeFixedCosts.length}
          </Badge>
        </button>
      </div>

      {mainView === 'fixed_costs' ? (
        /* ================= ABA CUSTOS FIXOS MENSAIS ================= */
        <div className="space-y-6">
          {/* Cards de Resumo Custos Fixos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Total dos Custos Fixos */}
            <Card className="border-slate-200 shadow-xs bg-amber-50/20 border-amber-200/60">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-700">
                  Total Custos Fixos Mensais
                </CardTitle>
                <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                  <DollarSign className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-900">
                  {formatCurrency(totalMonthlyFixedCosts)}
                </div>
                <div className="text-xs text-slate-500 mt-1 flex justify-between">
                  <span>{activeFixedCosts.length} itens ativos</span>
                  <span>{fixedCosts.length - activeFixedCosts.length} inativos</span>
                </div>
              </CardContent>
            </Card>

            {/* Total em Salários e Encargos */}
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">
                  Folha & Salários
                </CardTitle>
                <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Users2 className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-700">
                  {formatCurrency(totalSalaries)}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {activeFixedCosts.filter((c) => c.category === 'salarios').length} cadastros de
                  salários/pró-labore
                </div>
              </CardContent>
            </Card>

            {/* Maior Despesa Fixa */}
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Maior Despesa</CardTitle>
                <div className="h-8 w-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                  <TrendingDown className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-rose-700 truncate">
                  {maxExpense ? formatCurrency(maxExpense.amount) : 'R$ 0,00'}
                </div>
                <p className="text-xs text-slate-500 mt-1 truncate">
                  {maxExpense
                    ? `${maxExpense.name} (venc. dia ${maxExpense.due_day || 5})`
                    : 'Nenhum custo ativo'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filtros e Busca de Custos Fixos */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select
                value={costCategoryFilter}
                onChange={(e) => setCostCategoryFilter(e.target.value)}
                className="h-9 text-xs rounded-md border border-input bg-background px-2.5 shadow-xs"
              >
                <option value="all">Todas as Categorias</option>
                <option value="salarios">Salários e Encargos</option>
                <option value="aluguel">Aluguel</option>
                <option value="energia">Energia</option>
                <option value="agua">Água</option>
                <option value="internet">Internet</option>
                <option value="telefone">Telefone</option>
                <option value="marketing">Marketing</option>
                <option value="contabilidade">Contabilidade</option>
                <option value="outros">Outros</option>
              </select>

              <select
                value={costStatusFilter}
                onChange={(e) => setCostStatusFilter(e.target.value as any)}
                className="h-9 text-xs rounded-md border border-input bg-background px-2.5 shadow-xs"
              >
                <option value="all">Todos os Status</option>
                <option value="active">Apenas Ativos</option>
                <option value="inactive">Apenas Inativos</option>
              </select>
            </div>

            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Buscar custo fixo..."
                value={costSearch}
                onChange={(e) => setCostSearch(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>
          </div>

          {/* Tabela de Custos Fixos */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            {loadingCosts ? (
              <div className="p-12 text-center text-slate-500">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-amber-600 border-t-transparent mb-2"></div>
                <p className="text-sm">Carregando custos fixos...</p>
              </div>
            ) : filteredCosts.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <DollarSign className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-base font-semibold text-slate-700">
                  Nenhum custo fixo cadastrado
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Cadastre despesas mensais como salários da equipe, aluguel, energia, água,
                  internet e contabilidade para controle e geração automática de contas a pagar.
                </p>
                <div className="flex justify-center gap-2 mt-4">
                  <Button
                    onClick={handleOpenCreateCost}
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Cadastrar Custo Fixo
                  </Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Nome / Descrição</th>
                      <th className="py-3 px-4">Categoria</th>
                      <th className="py-3 px-4 text-center">Dia Vencimento</th>
                      <th className="py-3 px-4">Valor Mensal</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Lançamento no Mês Atual</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCosts.map((cost) => {
                      const isLaunched = isCostLaunchedInCurrentMonth(cost)
                      return (
                        <tr
                          key={cost.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            cost.active === false ? 'opacity-60 bg-slate-50/40' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4 font-medium text-slate-900">
                            <div>{cost.name}</div>
                            {cost.notes && (
                              <div className="text-[11px] text-slate-400 font-normal line-clamp-1">
                                {cost.notes}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <Badge
                              className={`text-[11px] border-0 ${
                                cost.category === 'salarios'
                                  ? 'bg-blue-100 text-blue-800'
                                  : cost.category === 'aluguel'
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {categoryLabels[cost.category] || cost.category}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 text-center text-xs text-slate-700">
                            <span className="font-semibold bg-slate-100 px-2 py-0.5 rounded">
                              Dia {cost.due_day || 5}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-rose-700">
                              {formatCurrency(cost.amount)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => handleToggleCostActive(cost)}
                              className="cursor-pointer"
                              title="Clique para ativar/desativar"
                            >
                              {cost.active !== false ? (
                                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-0 text-[10px]">
                                  <CheckCircle className="h-3 w-3 mr-1 inline" /> Ativo
                                </Badge>
                              ) : (
                                <Badge className="bg-slate-200 text-slate-600 hover:bg-slate-300 border-0 text-[10px]">
                                  <Power className="h-3 w-3 mr-1 inline" /> Inativo
                                </Badge>
                              )}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {isLaunched ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">
                                <CheckCircle className="h-3 w-3 mr-1 inline" /> Lançado em{' '}
                                {currentYearMonth}
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleLaunchCostInCurrentMonth(cost)}
                                disabled={launchingCostId === cost.id || cost.active === false}
                                className="h-7 text-[11px] text-blue-700 hover:bg-blue-50 border-blue-200"
                              >
                                <SendHorizontal className="h-3 w-3 mr-1" />
                                {launchingCostId === cost.id
                                  ? 'Lançando...'
                                  : 'Lançar no mês atual'}
                              </Button>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-blue-600"
                                onClick={() => handleOpenEditCost(cost)}
                                title="Editar"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-rose-600"
                                onClick={() => handleDeleteCost(cost.id)}
                                title="Excluir"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ================= ABA CONTAS / FATURAS PADRÃO ================= */
        <div className="space-y-6">
          {/* Cards de Resumo Financeiro */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Contas a Receber */}
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">
                  Total a Receber
                </CardTitle>
                <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <ArrowUpCircle className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-700">
                  {formatCurrency(totalReceivables)}
                </div>
                <div className="text-xs text-slate-500 mt-1 flex justify-between">
                  <span>Recebido: {formatCurrency(paidReceivables)}</span>
                  <span className="font-semibold text-amber-600">
                    Pendente: {formatCurrency(pendingReceivables)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Contas a Pagar */}
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Total a Pagar</CardTitle>
                <div className="h-8 w-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                  <ArrowDownCircle className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-rose-700">
                  {formatCurrency(totalPayables)}
                </div>
                <div className="text-xs text-slate-500 mt-1 flex justify-between">
                  <span>Pago: {formatCurrency(paidPayables)}</span>
                  <span className="font-semibold text-rose-600">
                    Pendente: {formatCurrency(pendingPayables)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Saldo Líquido Realizado */}
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">
                  Saldo Realizado
                </CardTitle>
                <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                  <DollarSign className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${netBalance >= 0 ? 'text-blue-700' : 'text-rose-600'}`}
                >
                  {formatCurrency(netBalance)}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Diferença entre entradas e saídas liquidadas
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Barra de Filtros e Busca */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    activeTab === 'all' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600'
                  }`}
                >
                  Todos ({invoices.length})
                </button>
                <button
                  onClick={() => setActiveTab('receivable')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    activeTab === 'receivable'
                      ? 'bg-white shadow-xs text-emerald-700'
                      : 'text-slate-600'
                  }`}
                >
                  A Receber ({receivables.length})
                </button>
                <button
                  onClick={() => setActiveTab('payable')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    activeTab === 'payable' ? 'bg-white shadow-xs text-rose-700' : 'text-slate-600'
                  }`}
                >
                  A Pagar ({payables.length})
                </button>
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="h-8 text-xs rounded-md border border-input bg-background px-2.5 shadow-xs"
              >
                <option value="all">Todos os Status</option>
                <option value="pending">Apenas Pendentes</option>
                <option value="paid">Apenas Pagas / Liquidadas</option>
              </select>
            </div>

            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Buscar fatura ou categoria..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>
          </div>

          {/* Tabela de Lançamentos */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-500">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2"></div>
                <p className="text-sm">Carregando faturas e lançamentos...</p>
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <ReceiptText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-base font-semibold text-slate-700">
                  Nenhum lançamento financeiro encontrado
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Cadastre faturas a receber vinculadas a vendas ou despesas operacionais da
                  empresa.
                </p>
                <div className="flex justify-center gap-2 mt-4">
                  <Button
                    onClick={() => handleOpenCreate('receivable')}
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Nova Fatura a Receber
                  </Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4">Descrição</th>
                      <th className="py-3 px-4">Cliente / Venda</th>
                      <th className="py-3 px-4">Vencimento</th>
                      <th className="py-3 px-4">Valor</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInvoices.map((inv) => {
                      const client =
                        clients.find((c) => c.id === inv.client_id) || inv.expand?.client_id
                      const deal = deals.find((d) => d.id === inv.deal_id) || inv.expand?.deal_id

                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            {inv.type === 'receivable' ? (
                              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0 text-[10px]">
                                Receber
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 border-0 text-[10px]">
                                Pagar
                              </Badge>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-900">
                            <div>{inv.description}</div>
                            {inv.category && (
                              <div className="text-[11px] text-slate-400 font-normal">
                                Categoria: {inv.category}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-600">
                            {client ? (
                              <div className="flex items-center gap-1 font-medium text-blue-600">
                                <Building className="h-3 w-3" /> {client.name}
                              </div>
                            ) : (
                              <span className="text-slate-400">Geral</span>
                            )}
                            {deal && (
                              <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                Venda: {deal.title}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-700">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-slate-400" />
                              {inv.due_date}
                            </div>
                            {inv.paid_date && (
                              <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
                                Pago em {inv.paid_date}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`font-bold ${
                                inv.type === 'receivable' ? 'text-emerald-700' : 'text-rose-600'
                              }`}
                            >
                              {inv.type === 'receivable' ? '+' : '-'} {formatCurrency(inv.amount)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => handleTogglePaid(inv)}
                              className="inline-flex items-center gap-1 text-xs cursor-pointer group"
                              title="Clique para alternar status pago/pendente"
                            >
                              {inv.status === 'paid' ? (
                                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-0 text-[10px] cursor-pointer">
                                  <CheckCircle className="h-3 w-3 mr-1 inline" /> Pago
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-0 text-[10px] cursor-pointer">
                                  <Clock className="h-3 w-3 mr-1 inline" /> Pendente
                                </Badge>
                              )}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-blue-600"
                                onClick={() => handleOpenEdit(inv)}
                                title="Editar"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-rose-600"
                                onClick={() => handleDelete(inv.id)}
                                title="Excluir"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL CRIAR / EDITAR CUSTO FIXO */}
      <Dialog open={isCostDialogOpen} onOpenChange={setIsCostDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCost ? 'Editar Custo Fixo Mensal' : 'Novo Custo Fixo Mensal'}
            </DialogTitle>
            <DialogDescription>
              Cadastre despesas recorrentes mensais, como salários, aluguel, luz e internet.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCost} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="cost-name">Nome da Despesa / Salário *</Label>
              <Input
                id="cost-name"
                value={costFormName}
                onChange={(e) => setCostFormName(e.target.value)}
                placeholder="Ex: Salário Vendedor 1, Aluguel do Escritório, etc."
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cost-cat">Categoria da Despesa *</Label>
              <select
                id="cost-cat"
                value={costFormCategory}
                onChange={(e) => setCostFormCategory(e.target.value as FixedCostCategory)}
                className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs font-medium"
                required
              >
                <option value="salarios">👥 Salários e Encargos da Equipe</option>
                <option value="aluguel">🏢 Aluguel de Imóvel / Escritório</option>
                <option value="energia">⚡ Energia Elétrica</option>
                <option value="agua">💧 Água e Saneamento</option>
                <option value="internet">🌐 Internet e Conectividade</option>
                <option value="telefone">📞 Telefonia e Comunicação</option>
                <option value="marketing">📢 Marketing e Publicidade Recorrente</option>
                <option value="contabilidade">📊 Assessoria Contábil</option>
                <option value="outros">📦 Outras Despesas Fixas</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cost-amount">Valor Mensal (R$) *</Label>
                <Input
                  id="cost-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={costFormAmount}
                  onChange={(e) => setCostFormAmount(e.target.value)}
                  placeholder="0,00"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cost-due">Dia de Vencimento (1 a 31)</Label>
                <Input
                  id="cost-due"
                  type="number"
                  min="1"
                  max="31"
                  value={costFormDueDay}
                  onChange={(e) => setCostFormDueDay(e.target.value)}
                  placeholder="5"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cost-notes">Observações</Label>
              <Textarea
                id="cost-notes"
                rows={2}
                value={costFormNotes}
                onChange={(e) => setCostFormNotes(e.target.value)}
                placeholder="Detalhes da conta, chave PIX, contrato, etc."
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="cost-active"
                checked={costFormActive}
                onChange={(e) => setCostFormActive(e.target.checked)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 h-4 w-4"
              />
              <Label htmlFor="cost-active" className="text-sm font-medium cursor-pointer">
                Custo fixo ativo no orçamento mensal
              </Label>
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button type="button" variant="outline" onClick={() => setIsCostDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-amber-600 hover:bg-amber-700"
                disabled={submittingCost}
              >
                {submittingCost
                  ? 'Salvando...'
                  : editingCost
                    ? 'Atualizar Custo'
                    : 'Cadastrar Custo Fixo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL CRIAR / EDITAR FATURA */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingInvoice ? 'Editar Fatura / Lançamento' : 'Nova Fatura / Conta'}
            </DialogTitle>
            <DialogDescription>
              Lance faturas a receber com clientes vinculados ou despesas a pagar da empresa.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="inv-type">Tipo de Movimentação</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={formType === 'receivable' ? 'default' : 'outline'}
                  onClick={() => setFormType('receivable')}
                  className={
                    formType === 'receivable'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-xs'
                      : 'text-xs'
                  }
                >
                  <ArrowUpCircle className="h-4 w-4 mr-1.5" /> A Receber (Entrada)
                </Button>
                <Button
                  type="button"
                  variant={formType === 'payable' ? 'default' : 'outline'}
                  onClick={() => setFormType('payable')}
                  className={
                    formType === 'payable' ? 'bg-rose-600 hover:bg-rose-700 text-xs' : 'text-xs'
                  }
                >
                  <ArrowDownCircle className="h-4 w-4 mr-1.5" /> A Pagar (Saída)
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inv-desc">Descrição do Lançamento *</Label>
              <Input
                id="inv-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Ex: Fatura #01 referente à implantação"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="inv-amount">Valor (R$) *</Label>
                <Input
                  id="inv-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="0,00"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inv-due">Vencimento *</Label>
                <Input
                  id="inv-due"
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="inv-status">Status Inicial</Label>
                <select
                  id="inv-status"
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as InvoiceStatus)}
                  className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
                >
                  <option value="pending">Pendente</option>
                  <option value="paid">Pago / Liquidado</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inv-cat">Categoria</Label>
                <Input
                  id="inv-cat"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="Ex: Consultoria, TI, etc."
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inv-client">Cliente Vinculado (Opcional)</Label>
              <select
                id="inv-client"
                value={formClientId}
                onChange={(e) => setFormClientId(e.target.value)}
                className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
              >
                <option value="">Nenhum (Lançamento avulso)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {formClientId && (
              <div className="space-y-1.5">
                <Label htmlFor="inv-deal">Venda / Negócio Vinculado</Label>
                <select
                  id="inv-deal"
                  value={formDealId}
                  onChange={(e) => setFormDealId(e.target.value)}
                  className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
                >
                  <option value="">Nenhuma venda específica</option>
                  {deals
                    .filter((d) => d.client_id === formClientId)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title} (R$ {d.value})
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="inv-notes">Observações</Label>
              <Textarea
                id="inv-notes"
                rows={2}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Forma de pagamento, chave pix, etc."
              />
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={submitting}>
                {submitting
                  ? 'Salvando...'
                  : editingInvoice
                    ? 'Atualizar Fatura'
                    : 'Lançar no Financeiro'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
