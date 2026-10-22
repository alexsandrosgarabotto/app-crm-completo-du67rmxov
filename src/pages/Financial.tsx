import React, { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { invoicesService } from '@/services/invoices'
import { clientsService } from '@/services/clients'
import { dealsService } from '@/services/deals'
import type { Invoice, InvoiceType, InvoiceStatus, Client, Deal } from '@/types/crm'
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
  FileCheck,
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

  // Filtros
  const [activeTab, setActiveTab] = useState<'all' | 'receivable' | 'payable'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all')
  const [search, setSearch] = useState('')

  // Dialog Criar/Editar
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

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [invData, clientsData, dealsData] = await Promise.all([
        invoicesService.getAll(),
        clientsService.getAll(),
        dealsService.getAll(),
      ])
      setInvoices(invData)
      setClients(clientsData)
      setDeals(dealsData)
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
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  // Cálculos de Totais
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
            <ReceiptText className="h-7 w-7 text-blue-600" />
            Gestão Financeira & Faturas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Acompanhe contas a receber de vendas, contas a pagar da empresa e fluxo de caixa.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* Cards de Resumo Financeiro */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Contas a Receber */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total a Receber</CardTitle>
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
            <div className="text-2xl font-bold text-rose-700">{formatCurrency(totalPayables)}</div>
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
            <CardTitle className="text-sm font-medium text-slate-600">Saldo Realizado</CardTitle>
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
              Cadastre faturas a receber vinculadas a vendas ou despesas operacionais da empresa.
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
