import React, { useState, useMemo } from 'react'
import type { CashMovement, CashMovementType, CashPaymentMethod } from '@/types/crm'
import {
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit,
  FileText,
  CreditCard,
  Banknote,
  QrCode,
  Building2,
  Calendar,
  HelpCircle,
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

interface CashControlViewProps {
  movements: CashMovement[]
  loading: boolean
  onSaveMovement: (data: Partial<CashMovement>, id?: string) => Promise<void>
  onDeleteMovement: (id: string) => Promise<void>
  formatCurrency: (val: number) => string
}

export type PeriodFilter = 'today' | '7days' | 'month' | 'custom' | 'all'

export default function CashControlView({
  movements,
  loading,
  onSaveMovement,
  onDeleteMovement,
  formatCurrency,
}: CashControlViewProps) {
  // Filtros
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('month')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'entry' | 'exit'>('all')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  // Dialog de Movimento Manual
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingMovement, setEditingMovement] = useState<CashMovement | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form State
  const [formType, setFormType] = useState<CashMovementType>('entry')
  const [formDescription, setFormDescription] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formPaymentMethod, setFormPaymentMethod] = useState<CashPaymentMethod>('pix')
  const [formCategory, setFormCategory] = useState('')
  const [formNotes, setFormNotes] = useState('')

  // Datas de referência para filtro
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])
  const sevenDaysAgoStr = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().split('T')[0]
  }, [])
  const currentMonthStr = useMemo(() => new Date().toISOString().substring(0, 7), [])

  // Filtragem dos movimentos
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      // Filtro de tipo
      if (typeFilter !== 'all' && m.type !== typeFilter) return false

      // Filtro de forma de pagamento
      if (paymentMethodFilter !== 'all' && m.payment_method !== paymentMethodFilter) return false

      // Filtro de busca
      if (search.trim()) {
        const query = search.toLowerCase()
        const matchesDesc = m.description.toLowerCase().includes(query)
        const matchesCat = m.category?.toLowerCase().includes(query)
        const matchesNotes = m.notes?.toLowerCase().includes(query)
        if (!matchesDesc && !matchesCat && !matchesNotes) return false
      }

      // Filtro de período
      if (periodFilter === 'today') {
        return m.date === todayStr
      } else if (periodFilter === '7days') {
        return m.date >= sevenDaysAgoStr && m.date <= todayStr
      } else if (periodFilter === 'month') {
        return m.date.startsWith(currentMonthStr)
      } else if (periodFilter === 'custom') {
        if (customStartDate && m.date < customStartDate) return false
        if (customEndDate && m.date > customEndDate) return false
        return true
      }

      return true
    })
  }, [
    movements,
    typeFilter,
    paymentMethodFilter,
    search,
    periodFilter,
    todayStr,
    sevenDaysAgoStr,
    currentMonthStr,
    customStartDate,
    customEndDate,
  ])

  // Cálculos no período filtrado
  const totalEntries = useMemo(() => {
    return filteredMovements
      .filter((m) => m.type === 'entry')
      .reduce((sum, m) => sum + (m.amount || 0), 0)
  }, [filteredMovements])

  const totalExits = useMemo(() => {
    return filteredMovements
      .filter((m) => m.type === 'exit')
      .reduce((sum, m) => sum + (m.amount || 0), 0)
  }, [filteredMovements])

  const periodBalance = useMemo(() => {
    return totalEntries - totalExits
  }, [totalEntries, totalExits])

  // Saldo total acumulado de todos os tempos (saldo atual do caixa real)
  const cumulativeCurrentBalance = useMemo(() => {
    const allEntries = movements
      .filter((m) => m.type === 'entry')
      .reduce((sum, m) => sum + (m.amount || 0), 0)
    const allExits = movements
      .filter((m) => m.type === 'exit')
      .reduce((sum, m) => sum + (m.amount || 0), 0)
    return allEntries - allExits
  }, [movements])

  const handleOpenCreate = (predefinedType?: CashMovementType) => {
    setEditingMovement(null)
    setFormType(predefinedType || 'entry')
    setFormDescription('')
    setFormAmount('')
    setFormDate(todayStr)
    setFormPaymentMethod('pix')
    setFormCategory('')
    setFormNotes('')
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (m: CashMovement) => {
    setEditingMovement(m)
    setFormType(m.type)
    setFormDescription(m.description)
    setFormAmount(m.amount ? m.amount.toString() : '')
    setFormDate(m.date || todayStr)
    setFormPaymentMethod(m.payment_method || 'pix')
    setFormCategory(m.category || '')
    setFormNotes(m.notes || '')
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formDescription.trim() || !formAmount || !formDate) return

    setSubmitting(true)
    try {
      const payload: Partial<CashMovement> = {
        type: formType,
        description: formDescription.trim(),
        amount: parseFloat(formAmount) || 0,
        date: formDate,
        payment_method: formPaymentMethod,
        category: formCategory.trim() || undefined,
        notes: formNotes.trim() || undefined,
      }
      await onSaveMovement(payload, editingMovement?.id)
      setIsDialogOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  const getPaymentMethodBadge = (method: CashPaymentMethod) => {
    switch (method) {
      case 'dinheiro':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            <Banknote className="h-3 w-3" /> Dinheiro
          </span>
        )
      case 'pix':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
            <QrCode className="h-3 w-3" /> PIX
          </span>
        )
      case 'cartao':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
            <CreditCard className="h-3 w-3" /> Cartão
          </span>
        )
      case 'transferencia':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            <Building2 className="h-3 w-3" /> Transferência
          </span>
        )
      case 'boleto':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            <FileText className="h-3 w-3" /> Boleto
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
            <HelpCircle className="h-3 w-3" /> Outros
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Botões de Ação Superior */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-xs bg-white text-slate-700 border-slate-200 py-1 px-2.5"
          >
            <Wallet className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
            Total de movimentos:{' '}
            <strong className="ml-1 text-slate-900">{filteredMovements.length}</strong>
          </Badge>
          <span className="text-xs text-slate-400">|</span>
          <span className="text-xs text-slate-500">
            Saldo Geral Acumulado:{' '}
            <strong className={cumulativeCurrentBalance >= 0 ? 'text-blue-700' : 'text-rose-600'}>
              {formatCurrency(cumulativeCurrentBalance)}
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => handleOpenCreate('entry')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Entrada Manual
          </Button>
          <Button
            onClick={() => handleOpenCreate('exit')}
            variant="outline"
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 text-xs h-9"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Saída / Sangria
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card Saldo do Período */}
        <Card className="border-slate-200 shadow-xs bg-linear-to-br from-white to-blue-50/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Saldo do Período</CardTitle>
            <div
              className={`h-9 w-9 rounded-full flex items-center justify-center ${
                periodBalance >= 0 ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'
              }`}
            >
              <Wallet className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold tracking-tight ${
                periodBalance >= 0 ? 'text-blue-700' : 'text-rose-600'
              }`}
            >
              {formatCurrency(periodBalance)}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span>{periodFilter === 'all' ? 'Todo o histórico' : 'No período selecionado'}</span>
              <span className="font-medium text-slate-700">
                Geral: {formatCurrency(cumulativeCurrentBalance)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Total de Entradas */}
        <Card className="border-slate-200 shadow-xs bg-linear-to-br from-white to-emerald-50/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total de Entradas</CardTitle>
            <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <ArrowUpCircle className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700 tracking-tight">
              {formatCurrency(totalEntries)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {filteredMovements.filter((m) => m.type === 'entry').length} lançamentos de entrada
            </p>
          </CardContent>
        </Card>

        {/* Total de Saídas */}
        <Card className="border-slate-200 shadow-xs bg-linear-to-br from-white to-rose-50/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total de Saídas</CardTitle>
            <div className="h-9 w-9 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
              <ArrowDownCircle className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-700 tracking-tight">
              {formatCurrency(totalExits)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {filteredMovements.filter((m) => m.type === 'exit').length} lançamentos de saída
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Filtro de Período Rápido */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setPeriodFilter('today')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                periodFilter === 'today'
                  ? 'bg-white shadow-xs text-blue-700 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hoje
            </button>
            <button
              onClick={() => setPeriodFilter('7days')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                periodFilter === '7days'
                  ? 'bg-white shadow-xs text-blue-700 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Últimos 7 dias
            </button>
            <button
              onClick={() => setPeriodFilter('month')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                periodFilter === 'month'
                  ? 'bg-white shadow-xs text-blue-700 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Este Mês
            </button>
            <button
              onClick={() => setPeriodFilter('custom')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                periodFilter === 'custom'
                  ? 'bg-white shadow-xs text-blue-700 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Personalizado
            </button>
            <button
              onClick={() => setPeriodFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                periodFilter === 'all'
                  ? 'bg-white shadow-xs text-blue-700 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos
            </button>
          </div>

          {/* Filtros de Tipo e Forma */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="h-9 text-xs rounded-md border border-input bg-background px-2.5 shadow-xs font-medium"
            >
              <option value="all">Todas as Movimentações</option>
              <option value="entry">🟢 Apenas Entradas</option>
              <option value="exit">🔴 Apenas Saídas</option>
            </select>

            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="h-9 text-xs rounded-md border border-input bg-background px-2.5 shadow-xs font-medium"
            >
              <option value="all">Todas as Formas de Pagamento</option>
              <option value="pix">PIX</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="cartao">Cartão</option>
              <option value="transferencia">Transferência</option>
              <option value="boleto">Boleto</option>
              <option value="outros">Outros</option>
            </select>

            {/* Campo de Busca */}
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Buscar movimento ou categoria..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>
          </div>
        </div>

        {/* Período Personalizado Datas */}
        {periodFilter === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
            <span className="font-medium text-slate-600 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-blue-600" /> Período Personalizado:
            </span>
            <div className="flex items-center gap-2">
              <Label htmlFor="custom-start" className="text-xs text-slate-500">
                De:
              </Label>
              <Input
                id="custom-start"
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-8 text-xs w-36"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="custom-end" className="text-xs text-slate-500">
                Até:
              </Label>
              <Input
                id="custom-end"
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-8 text-xs w-36"
              />
            </div>
          </div>
        )}
      </div>

      {/* Tabela de Movimentos do Caixa */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2"></div>
            <p className="text-sm">Carregando movimentações do caixa...</p>
          </div>
        ) : filteredMovements.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Wallet className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-700">
              Nenhuma movimentação de caixa encontrada
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Lançamentos de faturas pagas entram no caixa automaticamente, ou você pode registrar
              entradas e saídas manuais (suprimento, sangria, pequenos pagamentos).
            </p>
            <div className="flex justify-center gap-2 mt-4">
              <Button
                onClick={() => handleOpenCreate('entry')}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Nova Entrada
              </Button>
              <Button
                onClick={() => handleOpenCreate('exit')}
                size="sm"
                variant="outline"
                className="text-rose-600 hover:text-rose-700 border-rose-200 text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Nova Saída
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Descrição & Categoria</th>
                  <th className="py-3 px-4">Forma de Pagamento</th>
                  <th className="py-3 px-4">Origem</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMovements.map((m) => {
                  const isEntry = m.type === 'entry'
                  const isLinkedToInvoice = !!m.invoice_id

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Tipo */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isEntry ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0 text-[10px] font-semibold gap-1">
                            <ArrowUpCircle className="h-3 w-3 text-emerald-600" /> Entrada
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 border-0 text-[10px] font-semibold gap-1">
                            <ArrowDownCircle className="h-3 w-3 text-rose-600" /> Saída
                          </Badge>
                        )}
                      </td>

                      {/* Data */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-700 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          {m.date}
                        </div>
                      </td>

                      {/* Descrição & Categoria */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900 leading-snug">
                          {m.description}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {m.category && (
                            <span className="text-[11px] text-slate-500 font-normal">
                              {m.category}
                            </span>
                          )}
                          {m.notes && (
                            <span className="text-[10px] text-slate-400 italic">• {m.notes}</span>
                          )}
                        </div>
                      </td>

                      {/* Forma de Pagamento */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getPaymentMethodBadge(m.payment_method)}
                      </td>

                      {/* Origem */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                        {isLinkedToInvoice ? (
                          <Badge
                            variant="secondary"
                            className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-medium"
                          >
                            <FileText className="h-3 w-3 mr-1" /> Fatura Financeiro
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-slate-600 border-slate-200 text-[10px] font-normal"
                          >
                            Manual / Caixa
                          </Badge>
                        )}
                      </td>

                      {/* Valor */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <span
                          className={`font-bold text-sm ${
                            isEntry ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {isEntry ? '+' : '-'} {formatCurrency(m.amount)}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-blue-600"
                            onClick={() => handleOpenEdit(m)}
                            title="Editar movimento"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-rose-600"
                            onClick={() => onDeleteMovement(m.id)}
                            title="Excluir movimento"
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

      {/* MODAL NOVO / EDITAR MOVIMENTO DE CAIXA */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingMovement ? 'Editar Movimento de Caixa' : 'Novo Movimento de Caixa'}
            </DialogTitle>
            <DialogDescription>
              Lance entradas ou saídas de valores diretamente no fluxo de caixa da empresa.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* Tipo: Entrada vs Saída */}
            <div className="space-y-1.5">
              <Label>Tipo de Movimento *</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormType('entry')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                    formType === 'entry'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-1 ring-emerald-500'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
                  Entrada (Recebimento)
                </button>
                <button
                  type="button"
                  onClick={() => setFormType('exit')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                    formType === 'exit'
                      ? 'bg-rose-50 border-rose-500 text-rose-800 ring-1 ring-rose-500'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <ArrowDownCircle className="h-4 w-4 text-rose-600" />
                  Saída (Pagamento/Sangria)
                </button>
              </div>
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label htmlFor="cash-desc">Descrição do Movimento *</Label>
              <Input
                id="cash-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Ex: Suprimento inicial, Sangria para banco, Café do escritório..."
                required
              />
            </div>

            {/* Valor e Data */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cash-amount">Valor (R$) *</Label>
                <Input
                  id="cash-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="0,00"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cash-date">Data do Movimento *</Label>
                <Input
                  id="cash-date"
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Forma de Pagamento e Categoria */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cash-method">Forma de Pagamento *</Label>
                <select
                  id="cash-method"
                  value={formPaymentMethod}
                  onChange={(e) => setFormPaymentMethod(e.target.value as CashPaymentMethod)}
                  className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs font-medium"
                  required
                >
                  <option value="pix">PIX</option>
                  <option value="dinheiro">Dinheiro em Espécie</option>
                  <option value="cartao">Cartão de Crédito/Débito</option>
                  <option value="transferencia">Transferência / TED</option>
                  <option value="boleto">Boleto Bancário</option>
                  <option value="outros">Outros</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cash-category">Categoria</Label>
                <Input
                  id="cash-category"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="Ex: Operacional, Alimentação, Vendas..."
                />
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label htmlFor="cash-notes">Observações Adicionais</Label>
              <Textarea
                id="cash-notes"
                rows={2}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Detalhes adicionais, comprovante ou motivo..."
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className={
                  formType === 'entry'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }
              >
                {submitting
                  ? 'Salvando...'
                  : editingMovement
                    ? 'Salvar Alterações'
                    : 'Confirmar Lançamento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
