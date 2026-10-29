import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { clientsService } from '@/services/clients'
import { dealsService } from '@/services/deals'
import { tasksService } from '@/services/tasks'
import { invoicesService } from '@/services/invoices'
import { stockService } from '@/services/stock'
import { fiscalService } from '@/services/fiscal'
import type { Client, Deal, Task, Invoice, Product, FiscalDocument } from '@/types/crm'
import {
  Users,
  Kanban,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Clock,
  ArrowUpRight,
  Plus,
  AlertTriangle,
  Boxes,
  Receipt,
  Wrench,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<Client[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [fiscalDocs, setFiscalDocs] = useState<FiscalDocument[]>([])

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      const [clientsData, dealsData, tasksData, invoicesData, productsData, fiscalData] =
        await Promise.all([
          clientsService.getAll(),
          dealsService.getAll(),
          tasksService.getAll(),
          invoicesService.getAll(),
          stockService.getProducts(),
          fiscalService.getDocuments(),
        ])
      setClients(clientsData)
      setDeals(dealsData)
      setTasks(tasksData)
      setInvoices(invoicesData)
      setProducts(productsData)
      setFiscalDocs(fiscalData)
    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  // Cálculos de métricas
  const totalClients = clients.length
  const activeClients = clients.filter((c) => c.status === 'active').length

  const totalDealsValue = deals.reduce((acc, d) => acc + (d.value || 0), 0)
  const wonDeals = deals.filter((d) => d.stage === 'won')
  const wonDealsValue = wonDeals.reduce((acc, d) => acc + (d.value || 0), 0)
  const inProgressDeals = deals.filter((d) => d.stage === 'in_progress')

  const pendingTasks = tasks.filter((t) => t.status === 'pending')
  const completedTasks = tasks.filter((t) => t.status === 'completed')

  const receivables = invoices.filter((inv) => inv.type === 'receivable')
  const totalReceivable = receivables.reduce((acc, inv) => acc + inv.amount, 0)
  const paidReceivables = receivables
    .filter((inv) => inv.status === 'paid')
    .reduce((acc, inv) => acc + inv.amount, 0)

  const payables = invoices.filter((inv) => inv.type === 'payable')
  const totalPayable = payables.reduce((acc, inv) => acc + inv.amount, 0)

  const lowStockProducts = products.filter(
    (p) => (p.stock_quantity ?? 0) <= (p.min_stock ?? 0) && p.active !== false,
  )
  const pendingFiscalDocs = fiscalDocs.filter(
    (d) => d.status === 'to_transmit' || d.status === 'pending',
  )

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  const getStageBadge = (stage: string) => {
    switch (stage) {
      case 'lead':
        return (
          <Badge variant="secondary" className="bg-slate-100 text-slate-700">
            Lead
          </Badge>
        )
      case 'in_progress':
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            Em Andamento
          </Badge>
        )
      case 'won':
        return (
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
            Ganho
          </Badge>
        )
      case 'lost':
        return (
          <Badge variant="secondary" className="bg-rose-100 text-rose-800">
            Perdido
          </Badge>
        )
      default:
        return <Badge variant="outline">{stage}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <span className="text-sm text-slate-500">Atualizando resumo do CRM...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Olá, {user?.name?.split(' ')[0] || 'Gestor'}! 👋
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Visão geral da sua operação comercial, clientes, tarefas e financeiro.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => navigate('/vendas')}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Nova Venda
          </Button>
          <Button onClick={() => navigate('/clientes')} variant="outline" size="sm">
            <Users className="h-4 w-4 mr-1.5" /> Novo Cliente
          </Button>
        </div>
      </div>

      {/* Alertas Rápidos: Estoque Baixo e Notas Pendentes */}
      {(lowStockProducts.length > 0 || pendingFiscalDocs.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lowStockProducts.length > 0 && (
            <div className="p-3.5 rounded-lg border border-rose-200 bg-rose-50/70 flex items-center justify-between text-xs text-rose-900">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-md bg-rose-200 text-rose-800 flex items-center justify-center font-bold">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-bold text-sm text-rose-950">
                    {lowStockProducts.length} produto(s) com estoque baixo!
                  </p>
                  <p className="text-[11px] text-rose-700">Abaixo do estoque mínimo configurado.</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/estoque')}
                className="h-7 text-xs bg-white text-rose-700 border-rose-300 hover:bg-rose-50"
              >
                Ver Estoque <ArrowUpRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          )}

          {pendingFiscalDocs.length > 0 && (
            <div className="p-3.5 rounded-lg border border-amber-200 bg-amber-50/70 flex items-center justify-between text-xs text-amber-900">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-md bg-amber-200 text-amber-800 flex items-center justify-center font-bold">
                  <Receipt className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-bold text-sm text-amber-950">
                    {pendingFiscalDocs.length} nota(s) pendente(s) de transmissão
                  </p>
                  <p className="text-[11px] text-amber-700">
                    NF-e/NFS-e geradas aguardando conexão com provedor.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/notas-fiscais')}
                className="h-7 text-xs bg-white text-amber-700 border-amber-300 hover:bg-amber-50"
              >
                Ver Notas <ArrowUpRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total em Pipeline */}
        <Card className="border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Pipeline Total</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(totalDealsValue)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              <span className="text-emerald-600 font-medium">{deals.length} oportunidades</span>{' '}
              ativas
            </p>
          </CardContent>
        </Card>

        {/* Vendas Fechadas (Ganhos) */}
        <Card className="border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Vendas Ganhas</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">
              {formatCurrency(wonDealsValue)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              <span className="font-medium text-slate-700">{wonDeals.length} negócios</span>{' '}
              concluídos
            </p>
          </CardContent>
        </Card>

        {/* Clientes Cadastrados */}
        <Card className="border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Base de Clientes</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{totalClients}</div>
            <p className="text-xs text-slate-500 mt-1">
              <span className="text-purple-600 font-medium">{activeClients} ativos</span> na
              carteira
            </p>
          </CardContent>
        </Card>

        {/* Tarefas e Compromissos */}
        <Card className="border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Tarefas Pendentes</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{pendingTasks.length}</div>
            <p className="text-xs text-slate-500 mt-1">
              <span className="text-slate-700 font-medium">{completedTasks.length} tarefas</span>{' '}
              concluídas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Seção Financeira e Pipeline Rápido */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Painel Financeiro Rápido */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-800">
                Resumo Financeiro
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/financeiro')}
                className="text-xs h-7"
              >
                Ver tudo <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
            <CardDescription className="text-xs">Faturas e contas da empresa</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">Total a Receber</p>
                <p className="text-lg font-bold text-emerald-700">
                  {formatCurrency(totalReceivable)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-slate-500">Já Recebido</p>
                <p className="text-sm font-semibold text-slate-700">
                  {formatCurrency(paidReceivables)}
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">Total a Pagar</p>
                <p className="text-lg font-bold text-rose-700">{formatCurrency(totalPayable)}</p>
              </div>
              <Badge variant="outline" className="text-xs text-slate-600 border-slate-300">
                {payables.length} contas
              </Badge>
            </div>

            <div className="pt-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Últimas Faturas
              </h4>
              <div className="space-y-2">
                {invoices.slice(0, 3).map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-sm"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-medium text-slate-800 truncate text-xs">
                        {inv.description}
                      </p>
                      <p className="text-[11px] text-slate-500">Venc: {inv.due_date}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`font-semibold text-xs ${inv.type === 'receivable' ? 'text-emerald-600' : 'text-rose-600'}`}
                      >
                        {inv.type === 'receivable' ? '+' : '-'} {formatCurrency(inv.amount)}
                      </p>
                      <span className="text-[10px] text-slate-400 capitalize">
                        {inv.status === 'paid' ? 'Pago' : 'Pendente'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Oportunidades no Pipeline */}
        <Card className="border-slate-200 shadow-xs lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-800">
                  Vendas & Negociações Recentes
                </CardTitle>
                <CardDescription className="text-xs">
                  Acompanhamento de negócios em andamento e leads
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/vendas')}
                className="text-xs h-7"
              >
                Ver Kanban <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {deals.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                Nenhuma venda registrada ainda. Clique em "Nova Venda" para começar!
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {deals.slice(0, 5).map((deal) => (
                  <div key={deal.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 text-sm truncate">{deal.title}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span className="truncate">
                          Cliente: {deal.expand?.client_id?.name || 'Não vinculado'}
                        </span>
                        {deal.expected_close_date && (
                          <span>• Previsão: {deal.expected_close_date}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-bold text-slate-900 text-sm">
                        {formatCurrency(deal.value || 0)}
                      </span>
                      {getStageBadge(deal.stage)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Próximas Tarefas e Compromissos */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-800">
              Próximos Compromissos & Tarefas
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/agenda')}
              className="text-xs h-7"
            >
              Abrir Agenda <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
          <CardDescription className="text-xs">
            Lembretes com clientes, reuniões e follow-ups comerciais
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingTasks.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm">
              Nenhuma tarefa pendente no momento. Parabéns, tudo em dia!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingTasks.slice(0, 6).map((task) => (
                <div
                  key={task.id}
                  className="p-3.5 rounded-lg border border-slate-200 bg-white shadow-2xs hover:border-slate-300 transition-colors flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <Badge
                        variant="secondary"
                        className={
                          task.priority === 'high'
                            ? 'bg-rose-100 text-rose-800 text-[10px]'
                            : task.priority === 'medium'
                              ? 'bg-amber-100 text-amber-800 text-[10px]'
                              : 'bg-slate-100 text-slate-700 text-[10px]'
                        }
                      >
                        Prioridade{' '}
                        {task.priority === 'high'
                          ? 'Alta'
                          : task.priority === 'medium'
                            ? 'Média'
                            : 'Baixa'}
                      </Badge>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {task.due_date} {task.due_time ? `às ${task.due_time}` : ''}
                      </span>
                    </div>
                    <h4 className="font-semibold text-slate-800 text-sm">{task.title}</h4>
                    {task.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1">{task.description}</p>
                    )}
                  </div>
                  {task.expand?.client_id && (
                    <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-blue-600 font-medium truncate">
                      Cliente: {task.expand.client_id.name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
