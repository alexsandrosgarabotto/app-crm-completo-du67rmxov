import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { dealsService } from '@/services/deals'
import { dealItemsService } from '@/services/dealItems'
import { stockService } from '@/services/stock'
import { companyService } from '@/services/company'
import type { Deal, DealItem, Product, StockMovement, User } from '@/types/crm'
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Package,
  Layers,
  Calendar,
  Download,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  SlidersHorizontal,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  Building,
  Boxes,
  Percent,
  Search,
  ChevronRight,
  Filter,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Cell,
  PieChart,
  Pie,
} from 'recharts'

export default function ReportsPage() {
  const { user } = useAuth()

  // Dados brutos
  const [loading, setLoading] = useState(true)
  const [deals, setDeals] = useState<Deal[]>([])
  const [dealItems, setDealItems] = useState<DealItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
  const [teamMembers, setTeamMembers] = useState<User[]>([])

  // Filtros de Data para Vendas e Estoque
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(1) // Primeiro dia do mês atual
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  // Filtros locais de busca
  const [salesSearch, setSalesSearch] = useState('')
  const [stockSearch, setStockSearch] = useState('')
  const [stockCategoryFilter, setStockCategoryFilter] = useState('all')

  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
    setLoading(true)
    try {
      const [dealsData, itemsData, productsData, movementsData, teamData] = await Promise.all([
        dealsService.getAll(),
        dealItemsService.getAll(),
        stockService.getProducts(),
        stockService.getMovements(),
        companyService.getTeamMembers(),
      ])

      setDeals(dealsData)
      setDealItems(itemsData)
      setProducts(productsData)
      setStockMovements(movementsData)
      setTeamMembers(teamData)
    } catch (err) {
      console.error('Erro ao carregar dados dos relatórios:', err)
    } finally {
      setLoading(false)
    }
  }

  // Atalhos de Período
  const applyDatePreset = (preset: 'today' | 'last7' | 'last30' | 'thisMonth' | 'thisYear') => {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    let start = todayStr
    let end = todayStr

    if (preset === 'today') {
      start = todayStr
      end = todayStr
    } else if (preset === 'last7') {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      start = d.toISOString().split('T')[0]
    } else if (preset === 'last30') {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      start = d.toISOString().split('T')[0]
    } else if (preset === 'thisMonth') {
      const d = new Date(today.getFullYear(), today.getMonth(), 1)
      start = d.toISOString().split('T')[0]
    } else if (preset === 'thisYear') {
      const d = new Date(today.getFullYear(), 0, 1)
      start = d.toISOString().split('T')[0]
    }

    setStartDate(start)
    setEndDate(end)
  }

  // Formatador de Moeda
  const formatCurrency = (val?: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  // Helper para verificar se a data está no intervalo [startDate, endDate]
  const isDateInRange = (dateStr?: string) => {
    if (!dateStr) return false
    const d = dateStr.split('T')[0]
    if (startDate && d < startDate) return false
    if (endDate && d > endDate) return false
    return true
  }

  // ==========================================
  // CÁLCULOS: RELATÓRIO DE VENDAS
  // ==========================================

  // Filtra as vendas pelo período
  const periodDeals = useMemo(() => {
    return deals.filter((deal) => {
      // Data de referência: closed_date se won/lost ou created
      const refDate = deal.closed_date || deal.created?.split('T')[0]
      return isDateInRange(refDate)
    })
  }, [deals, startDate, endDate])

  // Métricas do período
  const salesMetrics = useMemo(() => {
    const totalDeals = periodDeals.length
    const wonDeals = periodDeals.filter((d) => d.stage === 'won')
    const lostDeals = periodDeals.filter((d) => d.stage === 'lost')
    const inProgressDeals = periodDeals.filter((d) => d.stage === 'in_progress')
    const leadDeals = periodDeals.filter((d) => d.stage === 'lead')

    const totalWonValue = wonDeals.reduce((sum, d) => sum + (d.value || 0), 0)
    const totalPeriodValue = periodDeals.reduce((sum, d) => sum + (d.value || 0), 0)

    const conversionRate = totalDeals > 0 ? (wonDeals.length / totalDeals) * 100 : 0
    const averageTicket = wonDeals.length > 0 ? totalWonValue / wonDeals.length : 0

    return {
      totalDeals,
      wonCount: wonDeals.length,
      lostCount: lostDeals.length,
      inProgressCount: inProgressDeals.length,
      leadCount: leadDeals.length,
      totalWonValue,
      totalPeriodValue,
      conversionRate,
      averageTicket,
    }
  }, [periodDeals])

  // Desempenho por Etapa do Pipeline
  const pipelineStageMetrics = useMemo(() => {
    const stages = [
      { id: 'lead', label: 'Lead / Prospect', color: '#64748b' },
      { id: 'in_progress', label: 'Em Andamento', color: '#2563eb' },
      { id: 'won', label: 'Ganho', color: '#16a34a' },
      { id: 'lost', label: 'Perdido', color: '#dc2626' },
    ]

    return stages.map((st) => {
      const stageDeals = periodDeals.filter((d) => d.stage === st.id)
      const value = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0)
      return {
        stage: st.id,
        label: st.label,
        color: st.color,
        count: stageDeals.length,
        value,
      }
    })
  }, [periodDeals])

  // Desempenho por Vendedor/Responsável (Negócios Ganhos e Totais)
  const sellersPerformance = useMemo(() => {
    const map = new Map<
      string,
      {
        userId: string
        userName: string
        wonCount: number
        wonValue: number
        totalCount: number
        totalValue: number
      }
    >()

    periodDeals.forEach((deal) => {
      const assigned = teamMembers.find((m) => m.id === deal.user_id) || deal.expand?.user_id
      const userId = assigned?.id || 'unassigned'
      const userName = assigned?.name || 'Não atribuído'

      if (!map.has(userId)) {
        map.set(userId, {
          userId,
          userName,
          wonCount: 0,
          wonValue: 0,
          totalCount: 0,
          totalValue: 0,
        })
      }

      const entry = map.get(userId)!
      entry.totalCount += 1
      entry.totalValue += deal.value || 0

      if (deal.stage === 'won') {
        entry.wonCount += 1
        entry.wonValue += deal.value || 0
      }
    })

    return Array.from(map.values()).sort((a, b) => b.wonValue - a.wonValue)
  }, [periodDeals, teamMembers])

  // Evolução Mensal das Vendas (baseado em todos os negócios ou últimos 12 meses)
  const monthlyEvolution = useMemo(() => {
    const monthNames = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ]

    const map = new Map<
      string,
      { monthKey: string; label: string; wonValue: number; totalValue: number; count: number }
    >()

    // Ordena negócios por data
    periodDeals.forEach((deal) => {
      const dateStr = deal.closed_date || deal.created?.split('T')[0]
      if (!dateStr) return

      const [year, month] = dateStr.split('-')
      const monthKey = `${year}-${month}`
      const label = `${monthNames[parseInt(month, 10) - 1]}/${year.slice(2)}`

      if (!map.has(monthKey)) {
        map.set(monthKey, {
          monthKey,
          label,
          wonValue: 0,
          totalValue: 0,
          count: 0,
        })
      }

      const entry = map.get(monthKey)!
      entry.totalValue += deal.value || 0
      entry.count += 1
      if (deal.stage === 'won') {
        entry.wonValue += deal.value || 0
      }
    })

    return Array.from(map.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey))
  }, [periodDeals])

  // Ranking de Produtos e Serviços mais vendidos no período
  const topItemsRanking = useMemo(() => {
    // Ids dos deals do período (apenas deals ganhos ou de todo o período)
    const periodDealIds = new Set(periodDeals.map((d) => d.id))
    const wonDealIds = new Set(periodDeals.filter((d) => d.stage === 'won').map((d) => d.id))

    const itemMap = new Map<
      string,
      {
        name: string
        type: 'product' | 'service'
        quantity: number
        totalValue: number
        wonQuantity: number
        wonValue: number
      }
    >()

    dealItems.forEach((item) => {
      if (!periodDealIds.has(item.deal_id)) return

      const key = `${item.item_type}:${item.name_snapshot}`
      if (!itemMap.has(key)) {
        itemMap.set(key, {
          name: item.name_snapshot,
          type: item.item_type,
          quantity: 0,
          totalValue: 0,
          wonQuantity: 0,
          wonValue: 0,
        })
      }

      const entry = itemMap.get(key)!
      entry.quantity += item.quantity || 0
      entry.totalValue += item.total_price || 0

      if (wonDealIds.has(item.deal_id)) {
        entry.wonQuantity += item.quantity || 0
        entry.wonValue += item.total_price || 0
      }
    })

    return Array.from(itemMap.values()).sort((a, b) => b.wonValue - a.wonValue)
  }, [periodDeals, dealItems])

  // Tabela de Detalhamento das Vendas do Período (com resumo de itens e busca)
  const filteredSalesDetails = useMemo(() => {
    // Mapa rápido dealId -> itens resumo
    const itemsByDeal = new Map<string, string[]>()
    dealItems.forEach((i) => {
      if (!itemsByDeal.has(i.deal_id)) {
        itemsByDeal.set(i.deal_id, [])
      }
      itemsByDeal.get(i.deal_id)!.push(`${i.quantity}x ${i.name_snapshot}`)
    })

    return periodDeals
      .map((d) => {
        const clientName = d.expand?.client_id?.name || 'Cliente não identificado'
        const sellerName = d.expand?.user_id?.name || 'Não atribuído'
        const itemsSummary = itemsByDeal.get(d.id)?.join(', ') || 'Sem itens avulsos'
        const date = d.closed_date || d.created?.split('T')[0] || ''

        return {
          id: d.id,
          title: d.title,
          clientName,
          sellerName,
          itemsSummary,
          value: d.value || 0,
          stage: d.stage,
          date,
        }
      })
      .filter((row) => {
        if (!salesSearch.trim()) return true
        const s = salesSearch.toLowerCase()
        return (
          row.title.toLowerCase().includes(s) ||
          row.clientName.toLowerCase().includes(s) ||
          row.sellerName.toLowerCase().includes(s) ||
          row.itemsSummary.toLowerCase().includes(s)
        )
      })
  }, [periodDeals, dealItems, salesSearch])

  // Exportação CSV: Vendas
  const handleExportSalesCSV = () => {
    const headers = [
      'ID',
      'Negócio',
      'Cliente',
      'Itens',
      'Valor (R$)',
      'Etapa',
      'Data',
      'Responsável',
    ]
    const rows = filteredSalesDetails.map((r) => [
      `"${r.id}"`,
      `"${r.title.replace(/"/g, '""')}"`,
      `"${r.clientName.replace(/"/g, '""')}"`,
      `"${r.itemsSummary.replace(/"/g, '""')}"`,
      r.value.toFixed(2),
      `"${r.stage}"`,
      `"${r.date}"`,
      `"${r.sellerName.replace(/"/g, '""')}"`,
    ])

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `relatorio_vendas_${startDate}_a_${endDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // ==========================================
  // CÁLCULOS: RELATÓRIO DE ESTOQUE
  // ==========================================

  // Métricas gerais de estoque (Catálogo Atual)
  const stockMetrics = useMemo(() => {
    const totalProducts = products.length
    const activeProducts = products.filter((p) => p.active !== false).length

    const totalCostValue = products.reduce((sum, p) => {
      const qty = p.stock_quantity || 0
      const cost = p.cost_price || 0
      return sum + qty * cost
    }, 0)

    const totalSaleValue = products.reduce((sum, p) => {
      const qty = p.stock_quantity || 0
      const sale = p.sale_price || 0
      return sum + qty * sale
    }, 0)

    const lowStockItems = products.filter(
      (p) => (p.stock_quantity ?? 0) <= (p.min_stock ?? 0) && p.active !== false,
    )

    return {
      totalProducts,
      activeProducts,
      totalCostValue,
      totalSaleValue,
      lowStockCount: lowStockItems.length,
      lowStockItems,
    }
  }, [products])

  // Movimentações filtradas pelo período
  const periodMovements = useMemo(() => {
    return stockMovements.filter((m) => {
      const dateStr = m.date || m.created?.split('T')[0]
      return isDateInRange(dateStr)
    })
  }, [stockMovements, startDate, endDate])

  // Resumo das movimentações do período (entradas, saídas, ajustes)
  const movementsSummary = useMemo(() => {
    let entryQty = 0
    let exitQty = 0
    let adjQty = 0

    let entryValue = 0
    let exitValue = 0

    // Mapa de produtos para estimativa de valor
    const prodMap = new Map<string, Product>()
    products.forEach((p) => prodMap.set(p.id, p))

    periodMovements.forEach((m) => {
      const prod = prodMap.get(m.product_id)
      const cost = prod?.cost_price || 0
      const sale = prod?.sale_price || 0

      if (m.type === 'entry') {
        entryQty += m.quantity
        entryValue += m.quantity * (cost || sale)
      } else if (m.type === 'exit') {
        exitQty += m.quantity
        exitValue += m.quantity * sale
      } else if (m.type === 'adjustment') {
        adjQty += 1
      }
    })

    return {
      totalMovements: periodMovements.length,
      entryQty,
      entryValue,
      exitQty,
      exitValue,
      adjQty,
    }
  }, [periodMovements, products])

  // Produtos com maior saída no período (baseado nas movimentações tipo 'exit')
  const topExitedProducts = useMemo(() => {
    const exitMap = new Map<
      string,
      { productId: string; name: string; sku?: string; quantity: number; totalValue: number }
    >()

    const prodMap = new Map<string, Product>()
    products.forEach((p) => prodMap.set(p.id, p))

    periodMovements
      .filter((m) => m.type === 'exit')
      .forEach((m) => {
        const prod = prodMap.get(m.product_id) || m.expand?.product_id
        const name = prod?.name || 'Produto Removido'
        const sku = prod?.sku
        const salePrice = prod?.sale_price || 0

        if (!exitMap.has(m.product_id)) {
          exitMap.set(m.product_id, {
            productId: m.product_id,
            name,
            sku,
            quantity: 0,
            totalValue: 0,
          })
        }

        const entry = exitMap.get(m.product_id)!
        entry.quantity += m.quantity
        entry.totalValue += m.quantity * salePrice
      })

    return Array.from(exitMap.values()).sort((a, b) => b.quantity - a.quantity)
  }, [periodMovements, products])

  // Distribuição do Valor do Estoque por Categoria
  const stockByCategory = useMemo(() => {
    const catMap = new Map<string, { category: string; value: number; count: number }>()

    products.forEach((p) => {
      const cat = p.category?.trim() || 'Sem Categoria'
      const val = (p.stock_quantity || 0) * (p.sale_price || 0)

      if (!catMap.has(cat)) {
        catMap.set(cat, { category: cat, value: 0, count: 0 })
      }

      const entry = catMap.get(cat)!
      entry.value += val
      entry.count += 1
    })

    return Array.from(catMap.values()).sort((a, b) => b.value - a.value)
  }, [products])

  // Categorias disponíveis para filtro
  const categoriesList = useMemo(() => {
    return Array.from(new Set(products.map((p) => p.category?.trim()).filter(Boolean) as string[]))
  }, [products])

  // Tabela completa de produtos com filtro
  const filteredStockProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(stockSearch.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(stockSearch.toLowerCase())) ||
        (p.category && p.category.toLowerCase().includes(stockSearch.toLowerCase()))

      const matchesCat =
        stockCategoryFilter === 'all' || (p.category && p.category === stockCategoryFilter)

      return matchesSearch && matchesCat
    })
  }, [products, stockSearch, stockCategoryFilter])

  // Exportação CSV: Estoque
  const handleExportStockCSV = () => {
    const headers = [
      'Código SKU',
      'Produto',
      'Categoria',
      'Qtd Atual',
      'Estoque Mínimo',
      'Preço Custo (R$)',
      'Preço Venda (R$)',
      'Valor em Estoque (R$)',
      'Status',
    ]

    const rows = filteredStockProducts.map((p) => {
      const qty = p.stock_quantity ?? 0
      const min = p.min_stock ?? 0
      const isLow = qty <= min
      const totalVal = qty * (p.sale_price || 0)

      return [
        `"${(p.sku || '').replace(/"/g, '""')}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${(p.category || 'Sem categoria').replace(/"/g, '""')}"`,
        qty,
        min,
        (p.cost_price || 0).toFixed(2),
        (p.sale_price || 0).toFixed(2),
        totalVal.toFixed(2),
        isLow ? '"Estoque Baixo"' : '"Regular"',
      ]
    })

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `relatorio_estoque_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Paleta de Cores para Gráficos
  const PIE_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b']

  return (
    <div className="space-y-6">
      {/* Header Geral da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-blue-600" />
            Relatórios Gerenciais
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Análises completas de vendas, conversão do funil, estoque físico e movimentações.
          </p>
        </div>

        {/* Filtros de Data e Atalhos */}
        <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 text-xs w-32 px-2"
            />
            <span>até</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 text-xs w-32 px-2"
            />
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => applyDatePreset('today')}
              className="h-8 px-2 text-xs"
            >
              Hoje
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => applyDatePreset('last7')}
              className="h-8 px-2 text-xs"
            >
              7 dias
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => applyDatePreset('last30')}
              className="h-8 px-2 text-xs"
            >
              30 dias
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => applyDatePreset('thisMonth')}
              className="h-8 px-2 text-xs"
            >
              Este mês
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => applyDatePreset('thisYear')}
              className="h-8 px-2 text-xs"
            >
              Este ano
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs Principais: Vendas vs Estoque */}
      <Tabs defaultValue="sales" className="space-y-6">
        <TabsList className="bg-slate-200/70 p-1">
          <TabsTrigger value="sales" className="flex items-center gap-2 px-4 py-2">
            <TrendingUp className="h-4 w-4" />
            Relatório de Vendas
          </TabsTrigger>
          <TabsTrigger value="stock" className="flex items-center gap-2 px-4 py-2">
            <Boxes className="h-4 w-4" />
            Relatório de Estoque
          </TabsTrigger>
        </TabsList>

        {/* ======================================================== */}
        {/* ABA: RELATÓRIO DE VENDAS */}
        {/* ======================================================== */}
        <TabsContent value="sales" className="space-y-6">
          {/* Cards de Métricas Principais de Vendas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Total Vendido */}
            <Card className="border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Vendido (Ganhos)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-xl font-bold text-emerald-700">
                  {formatCurrency(salesMetrics.totalWonValue)}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">no período selecionado</p>
              </CardContent>
            </Card>

            {/* Negócios Totais */}
            <Card className="border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total de Negócios
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-xl font-bold text-slate-900">{salesMetrics.totalDeals}</div>
                <p className="text-[11px] text-slate-500 mt-0.5">volume no período</p>
              </CardContent>
            </Card>

            {/* Vendas Ganhas */}
            <Card className="border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Vendas Ganhas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-xl font-bold text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  {salesMetrics.wonCount}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">oportunidades fechadas</p>
              </CardContent>
            </Card>

            {/* Vendas Perdidas */}
            <Card className="border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Vendas Perdidas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-xl font-bold text-rose-700 flex items-center gap-1.5">
                  <XCircle className="h-4 w-4" />
                  {salesMetrics.lostCount}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">negócios descartados</p>
              </CardContent>
            </Card>

            {/* Taxa de Conversão */}
            <Card className="border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Taxa de Conversão
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-xl font-bold text-blue-700 flex items-center gap-1">
                  <Percent className="h-4 w-4" />
                  {salesMetrics.conversionRate.toFixed(1)}%
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">ganhos / total de negócios</p>
              </CardContent>
            </Card>

            {/* Ticket Médio */}
            <Card className="border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Ticket Médio
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-xl font-bold text-slate-900">
                  {formatCurrency(salesMetrics.averageTicket)}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">por venda ganha</p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de Evolução e Desempenho por Etapa */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Evolução das Vendas por Mês */}
            <Card className="border-slate-200 shadow-2xs lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-800">
                  Evolução das Vendas no Período
                </CardTitle>
                <CardDescription className="text-xs">
                  Comparativo mensal de valores ganhos e total negociado
                </CardDescription>
              </CardHeader>
              <CardContent>
                {monthlyEvolution.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
                    Nenhum negócio registrado no período selecionado.
                  </div>
                ) : (
                  <div className="h-64 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyEvolution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="label" stroke="#64748b" fontSize={12} />
                        <YAxis
                          stroke="#64748b"
                          fontSize={11}
                          tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          formatter={(value: any) => [formatCurrency(Number(value)), '']}
                          labelFormatter={(l) => `Mês: ${l}`}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar
                          dataKey="wonValue"
                          name="Vendas Ganhas (R$)"
                          fill="#16a34a"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="totalValue"
                          name="Total Negociado (R$)"
                          fill="#3b82f6"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Desempenho por Etapa do Pipeline */}
            <Card className="border-slate-200 shadow-2xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-800">
                  Funil de Vendas (Etapas)
                </CardTitle>
                <CardDescription className="text-xs">
                  Distribuição de negócios e montantes por estágio
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {pipelineStageMetrics.map((st) => (
                  <div
                    key={st.stage}
                    className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: st.color }}
                        />
                        <span className="font-semibold text-sm text-slate-800">{st.label}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {st.count} negócio(s) registrado(s)
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm text-slate-900">
                        {formatCurrency(st.value)}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {salesMetrics.totalPeriodValue > 0
                          ? `${((st.value / salesMetrics.totalPeriodValue) * 100).toFixed(0)}% do volume`
                          : '0%'}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Desempenho por Vendedor e Ranking de Produtos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Desempenho por Vendedor / Responsável */}
            <Card className="border-slate-200 shadow-2xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-blue-600" />
                  Desempenho por Vendedor
                </CardTitle>
                <CardDescription className="text-xs">
                  Quantidade e montante de negócios ganhos pela equipe
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sellersPerformance.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    Nenhum vendedor com negócios no período.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {sellersPerformance.map((s, idx) => (
                      <div key={s.userId} className="py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {idx + 1}º
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-slate-800">{s.userName}</p>
                            <p className="text-xs text-slate-500">
                              {s.wonCount} ganho(s) de {s.totalCount} negócio(s)
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm text-emerald-700">
                            {formatCurrency(s.wonValue)}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Total negociado: {formatCurrency(s.totalValue)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Ranking de Produtos e Serviços mais Vendidos */}
            <Card className="border-slate-200 shadow-2xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-600" />
                  Itens Mais Vendidos (Produtos & Serviços)
                </CardTitle>
                <CardDescription className="text-xs">
                  Calculado a partir dos itens das vendas concluídas (ganhas)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {topItemsRanking.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    Nenhum item avulso adicionado às vendas do período.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto pr-1">
                    {topItemsRanking.slice(0, 8).map((item, idx) => (
                      <div key={idx} className="py-2.5 flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1 py-0 ${
                                item.type === 'product'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-purple-50 text-purple-700 border-purple-200'
                              }`}
                            >
                              {item.type === 'product' ? 'Produto' : 'Serviço'}
                            </Badge>
                            <p className="font-semibold text-xs text-slate-800 truncate">
                              {item.name}
                            </p>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Qtd Vendida:{' '}
                            <span className="font-bold text-slate-700">{item.wonQuantity}</span>{' '}
                            (Total propostas: {item.quantity})
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-sm text-emerald-700">
                            {formatCurrency(item.wonValue)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Detalhamento das Vendas do Período */}
          <Card className="border-slate-200 shadow-2xs overflow-hidden">
            <CardHeader className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold text-slate-800">
                  Detalhamento das Vendas
                </CardTitle>
                <CardDescription className="text-xs">
                  Lista completa de negócios no período selecionado ({filteredSalesDetails.length}{' '}
                  registros)
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-48 sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Filtrar por cliente, título..."
                    value={salesSearch}
                    onChange={(e) => setSalesSearch(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportSalesCSV}
                  className="h-8 text-xs bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  title="Exportar detalhamento de vendas para CSV"
                >
                  <Download className="h-3.5 w-3.5 mr-1 text-blue-600" />
                  Exportar CSV
                </Button>
              </div>
            </CardHeader>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Negócio</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Itens (Resumo)</th>
                    <th className="py-3 px-4 text-right">Valor</th>
                    <th className="py-3 px-4 text-center">Etapa</th>
                    <th className="py-3 px-4 text-center">Data</th>
                    <th className="py-3 px-4">Responsável</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSalesDetails.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Nenhuma venda encontrada para os filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredSalesDetails.map((deal) => {
                      const isWon = deal.stage === 'won'
                      const isLost = deal.stage === 'lost'

                      return (
                        <tr key={deal.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-900 max-w-[200px] truncate">
                            {deal.title}
                          </td>
                          <td className="py-3 px-4 text-slate-700 max-w-[150px] truncate">
                            {deal.clientName}
                          </td>
                          <td
                            className="py-3 px-4 text-slate-500 max-w-[220px] truncate"
                            title={deal.itemsSummary}
                          >
                            {deal.itemsSummary}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            {formatCurrency(deal.value)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge
                              variant="secondary"
                              className={`text-[10px] font-medium ${
                                isWon
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isLost
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {deal.stage === 'lead'
                                ? 'Lead'
                                : deal.stage === 'in_progress'
                                  ? 'Em Andamento'
                                  : deal.stage === 'won'
                                    ? 'Ganho'
                                    : 'Perdido'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-center text-slate-500 font-mono">
                            {deal.date || '-'}
                          </td>
                          <td className="py-3 px-4 text-slate-600 truncate">{deal.sellerName}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* ABA: RELATÓRIO DE ESTOQUE */}
        {/* ======================================================== */}
        <TabsContent value="stock" className="space-y-6">
          {/* Cards de Resumo de Estoque */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Valor a Preço de Custo */}
            <Card className="border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Valor Estoque (Preço Custo)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold text-slate-900">
                  {formatCurrency(stockMetrics.totalCostValue)}
                </div>
                <p className="text-xs text-slate-500 mt-1">custo do estoque físico atual</p>
              </CardContent>
            </Card>

            {/* Valor a Preço de Venda */}
            <Card className="border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Valor Estoque (Preço Venda)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold text-emerald-700">
                  {formatCurrency(stockMetrics.totalSaleValue)}
                </div>
                <p className="text-xs text-slate-500 mt-1">potencial de faturamento em estoque</p>
              </CardContent>
            </Card>

            {/* Produtos Cadastrados */}
            <Card className="border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total de Produtos
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold text-slate-900">
                  {stockMetrics.totalProducts}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {stockMetrics.activeProducts} produtos ativos no catálogo
                </p>
              </CardContent>
            </Card>

            {/* Itens Abaixo do Mínimo */}
            <Card
              className={`border-slate-200 shadow-2xs ${
                stockMetrics.lowStockCount > 0 ? 'bg-rose-50/50 border-rose-200' : ''
              }`}
            >
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Abaixo do Estoque Mínimo</span>
                  <AlertTriangle
                    className={`h-4 w-4 ${
                      stockMetrics.lowStockCount > 0 ? 'text-rose-600' : 'text-slate-400'
                    }`}
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div
                  className={`text-2xl font-bold ${
                    stockMetrics.lowStockCount > 0 ? 'text-rose-700' : 'text-slate-900'
                  }`}
                >
                  {stockMetrics.lowStockCount}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {stockMetrics.lowStockCount > 0
                    ? 'Necessitam reposição imediata!'
                    : 'Nenhum produto em nível crítico'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Resumo de Movimentações do Período + Produtos com Maior Saída */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Resumo das Movimentações do Período */}
            <Card className="border-slate-200 shadow-2xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-blue-600" />
                  Movimentações no Período
                </CardTitle>
                <CardDescription className="text-xs">
                  Entradas, saídas e ajustes registrados entre {startDate} e {endDate}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Entradas */}
                <div className="p-3 rounded-lg border border-emerald-100 bg-emerald-50/60 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <ArrowDownCircle className="h-5 w-5 text-emerald-600" />
                    <div>
                      <p className="font-semibold text-sm text-slate-800">Entradas</p>
                      <p className="text-xs text-slate-500">
                        {movementsSummary.entryQty} unidades adicionadas
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-sm text-emerald-800">
                      +{formatCurrency(movementsSummary.entryValue)}
                    </span>
                  </div>
                </div>

                {/* Saídas */}
                <div className="p-3 rounded-lg border border-amber-100 bg-amber-50/60 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <ArrowUpCircle className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="font-semibold text-sm text-slate-800">
                        Saídas (Vendas / Baixas)
                      </p>
                      <p className="text-xs text-slate-500">
                        {movementsSummary.exitQty} unidades movimentadas
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-sm text-amber-800">
                      -{formatCurrency(movementsSummary.exitValue)}
                    </span>
                  </div>
                </div>

                {/* Ajustes */}
                <div className="p-3 rounded-lg border border-blue-100 bg-blue-50/60 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <SlidersHorizontal className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-semibold text-sm text-slate-800">Ajustes & Balanços</p>
                      <p className="text-xs text-slate-500">
                        {movementsSummary.adjQty} conferência(s) manual(is)
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-xs">
                      {movementsSummary.totalMovements} mov. totais
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Produtos com Maior Saída no Período */}
            <Card className="border-slate-200 shadow-2xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-amber-600" />
                  Produtos com Maior Saída
                </CardTitle>
                <CardDescription className="text-xs">
                  Itens mais vendidos e baixados no período selecionado
                </CardDescription>
              </CardHeader>
              <CardContent>
                {topExitedProducts.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    Nenhuma saída registrada no período selecionado.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1">
                    {topExitedProducts.slice(0, 6).map((item, idx) => (
                      <div
                        key={item.productId}
                        className="py-2.5 flex items-center justify-between"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-semibold text-xs text-slate-800 truncate">
                            {idx + 1}º {item.name}
                          </p>
                          {item.sku && (
                            <span className="text-[10px] font-mono text-slate-400">
                              SKU: {item.sku}
                            </span>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-bold text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                            {item.quantity} un.
                          </span>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {formatCurrency(item.totalValue)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Distribuição do Valor por Categoria */}
            <Card className="border-slate-200 shadow-2xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-600" />
                  Estoque por Categoria
                </CardTitle>
                <CardDescription className="text-xs">
                  Distribuição do valor de venda acumulado
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stockByCategory.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    Nenhum produto cadastrado com valor de estoque.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {stockByCategory.slice(0, 6).map((cat, idx) => (
                      <div
                        key={cat.category}
                        className="p-2 rounded border border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                          />
                          <span className="font-semibold text-slate-800 truncate max-w-[120px]">
                            {cat.category}
                          </span>
                          <span className="text-slate-400">({cat.count} itens)</span>
                        </div>
                        <span className="font-bold text-slate-900">
                          {formatCurrency(cat.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tabela Completa de Produtos em Estoque */}
          <Card className="border-slate-200 shadow-2xs overflow-hidden">
            <CardHeader className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold text-slate-800">
                  Inventário Completo de Produtos
                </CardTitle>
                <CardDescription className="text-xs">
                  Código, quantidades atuais, estoque mínimo, custos e preços de venda
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-48 sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Buscar produto ou SKU..."
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>

                <select
                  value={stockCategoryFilter}
                  onChange={(e) => setStockCategoryFilter(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2.5 text-xs shadow-2xs"
                >
                  <option value="all">Todas as categorias</option>
                  {categoriesList.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportStockCSV}
                  className="h-8 text-xs bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  title="Exportar inventário de estoque para CSV"
                >
                  <Download className="h-3.5 w-3.5 mr-1 text-blue-600" />
                  Exportar CSV
                </Button>
              </div>
            </CardHeader>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Código / SKU</th>
                    <th className="py-3 px-4">Nome do Produto</th>
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4 text-center">Qtd Atual</th>
                    <th className="py-3 px-4 text-center">Estoque Mínimo</th>
                    <th className="py-3 px-4 text-right">Preço Custo</th>
                    <th className="py-3 px-4 text-right">Preço Venda</th>
                    <th className="py-3 px-4 text-right">Valor em Estoque</th>
                    <th className="py-3 px-4 text-center">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStockProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        Nenhum produto cadastrado ou correspondente aos filtros.
                      </td>
                    </tr>
                  ) : (
                    filteredStockProducts.map((p) => {
                      const qty = p.stock_quantity ?? 0
                      const min = p.min_stock ?? 0
                      const isLow = qty <= min && p.active !== false
                      const stockValue = qty * (p.sale_price || 0)

                      return (
                        <tr
                          key={p.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isLow ? 'bg-rose-50/30' : ''
                          }`}
                        >
                          <td className="py-3 px-4 font-mono text-slate-500">{p.sku || '-'}</td>
                          <td className="py-3 px-4 font-semibold text-slate-900">{p.name}</td>
                          <td className="py-3 px-4 text-slate-600">
                            {p.category || (
                              <span className="text-slate-400 italic">Sem categoria</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-bold">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                                isLow
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isLow && <AlertTriangle className="h-3 w-3 mr-1 inline" />}
                              {qty} {p.unit || 'UN'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center text-slate-500 font-mono">
                            {min} {p.unit || 'UN'}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600">
                            {formatCurrency(p.cost_price)}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-900">
                            {formatCurrency(p.sale_price)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            {formatCurrency(stockValue)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {p.active === false ? (
                              <Badge variant="outline" className="text-slate-400 text-[10px]">
                                Inativo
                              </Badge>
                            ) : isLow ? (
                              <Badge variant="destructive" className="bg-rose-600 text-[10px]">
                                Crítico / Baixo
                              </Badge>
                            ) : (
                              <Badge
                                variant="secondary"
                                className="bg-emerald-50 text-emerald-700 text-[10px]"
                              >
                                Regular
                              </Badge>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
