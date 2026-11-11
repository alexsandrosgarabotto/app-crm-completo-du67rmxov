import { useEffect, useMemo, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { clientsService } from '@/services/clients'
import { stockService } from '@/services/stock'
import { servicesCatalogService } from '@/services/servicesCatalog'
import {
  serviceOrdersService,
  serviceOrderStatusLabels,
  serviceOrderFileUrl,
  OPEN_SERVICE_ORDER_STATUSES,
  type AvisoWhatsapp,
  type StockIssue,
} from '@/services/serviceOrders'
import type {
  Client,
  Product,
  Service,
  ServiceOrder,
  ServiceOrderItem,
  ServiceOrderStatus,
  User,
} from '@/types/crm'
import {
  Plus,
  ClipboardList,
  User as UserIcon,
  Calendar,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Wrench,
  Package,
  Clock,
  History,
  Camera,
  PenLine,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { SignaturePad } from '@/components/serviceOrders/SignaturePad'
import { PhotoReport } from '@/components/serviceOrders/PhotoReport'
import { ServiceOrderClientData } from '@/components/serviceOrders/ServiceOrderClientData'

const statusBadgeClasses: Record<ServiceOrderStatus, string> = {
  aberta: 'bg-blue-100 text-blue-800 hover:bg-blue-100 border-0',
  em_andamento: 'bg-amber-100 text-amber-800 hover:bg-amber-100 border-0',
  aguardando_peca: 'bg-purple-100 text-purple-800 hover:bg-purple-100 border-0',
  finalizada: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0',
  cancelada: 'bg-rose-100 text-rose-800 hover:bg-rose-100 border-0',
}

/** Feedback do aviso de WhatsApp, por resultado devolvido pelo hook backend. */
const avisoFeedback: Record<AvisoWhatsapp, { ok: boolean; text: string }> = {
  enviado: { ok: true, text: 'Aviso enviado ao cliente pelo WhatsApp.' },
  fora_da_janela: {
    ok: false,
    text: 'Aviso NÃO saiu: conversa fora da janela de 24h do WhatsApp.',
  },
  modo_validacao: {
    ok: false,
    text: 'Aviso NÃO saiu: modo de validação ativo (só o contato de teste recebe).',
  },
  sem_telefone: { ok: false, text: 'Aviso NÃO saiu: cliente sem telefone cadastrado.' },
  sem_conversa: {
    ok: false,
    text: 'Aviso NÃO saiu: nenhuma conversa WhatsApp encontrada para este cliente.',
  },
  falhou: { ok: false, text: 'Falha ao enviar o aviso de WhatsApp (verifique o canal Meta).' },
}

const emptyItem = (): ServiceOrderItem => ({
  item_type: 'product',
  product_id: undefined,
  service_id: undefined,
  name_snapshot: '',
  quantity: 1,
  unit_price: 0,
  total_price: 0,
})

interface OrderFormState {
  id?: string
  number?: string
  client_id: string
  status: ServiceOrderStatus
  opened_at: string
  responsible_id: string
  problem_description: string
  notes: string
  items: ServiceOrderItem[]
  stock_released?: boolean
  invoice_id?: string
  finished_at?: string
  conversation_id?: string
  agendamento_data: string
  agendamento_hora: string
}

const emptyForm = (): OrderFormState => ({
  client_id: '',
  status: 'aberta',
  opened_at: new Date().toISOString().slice(0, 10),
  responsible_id: '',
  problem_description: '',
  notes: '',
  items: [emptyItem()],
  agendamento_data: '',
  agendamento_hora: '',
})

const pad2 = (n: number) => String(n).padStart(2, '0')

export default function ServiceOrdersPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [busyStatusId, setBusyStatusId] = useState<string | null>(null)
  const [avisoInfo, setAvisoInfo] = useState<{ whatsapp: AvisoWhatsapp; erro?: string } | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ServiceOrderStatus>('all')

  // Filtro de período do relatório do topo (padrão: mês atual)
  const now = new Date()
  const [periodStart, setPeriodStart] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
  )
  const [periodEnd, setPeriodEnd] = useState(
    new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
  )

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<OrderFormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [finalizeTarget, setFinalizeTarget] = useState<ServiceOrder | null>(null)
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [signaturePadOpen, setSignaturePadOpen] = useState(false)
  const [savingSignature, setSavingSignature] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<ServiceOrder | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  // Abre automaticamente a OS indicada na URL (ex.: vinda do atendimento WhatsApp)
  useEffect(() => {
    const targetId = searchParams.get('os')
    if (!targetId) return
    setFormOpen(false)
    serviceOrdersService
      .getById(targetId)
      .then((order) => {
        if (order) {
          openEdit(order)
          setSearchParams({}, { replace: true })
        }
      })
      .catch((err) => console.error('Erro ao abrir a OS da URL:', err))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [ordersData, clientsData, productsData, servicesData, usersData] = await Promise.all([
        serviceOrdersService.getAll(),
        clientsService.getAll(),
        stockService.getProducts(),
        servicesCatalogService.getAll(),
        pb
          .collection('users')
          .getFullList<User>({ sort: 'name' })
          .catch(() => [] as User[]),
      ])
      setOrders(ordersData)
      setClients(clientsData)
      setProducts(productsData)
      setServices(servicesData)
      setUsers(usersData)
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro',
        description: 'Falha ao carregar ordens de serviço.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const getClientName = (order: ServiceOrder) => {
    const expanded = order.expand?.client_id
    if (expanded) return expanded.name
    const found = clients.find((c) => c.id === order.client_id)
    return found?.name || '—'
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return orders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false
      if (!term) return true
      const clientName = getClientName(order).toLowerCase()
      return (
        (order.number || '').toLowerCase().includes(term) ||
        clientName.includes(term) ||
        (order.problem_description || '').toLowerCase().includes(term)
      )
    })
  }, [orders, search, statusFilter, clients])

  const report = useMemo(() => {
    const inPeriod = orders.filter((order) => {
      const date = (order.opened_at || order.created || '').slice(0, 10)
      return date >= periodStart && date <= periodEnd
    })
    const finished = inPeriod.filter((o) => o.status === 'finalizada')
    return {
      open: inPeriod.filter((o) => OPEN_SERVICE_ORDER_STATUSES.includes(o.status)).length,
      inProgress: inPeriod.filter((o) => o.status === 'em_andamento').length,
      finishedCount: finished.length,
      revenue: finished.reduce((sum, o) => sum + (o.total_value || 0), 0),
    }
  }, [orders, periodStart, periodEnd])

  const formTotal = useMemo(() => {
    return (form.items || []).reduce((sum, item) => sum + (item.total_price || 0), 0)
  }, [form.items])

  const openNew = (presetClientId?: string) => {
    setForm({ ...emptyForm(), client_id: presetClientId || '' })
    setFormOpen(true)
  }

  const openEdit = (order: ServiceOrder) => {
    setAvisoInfo(null)
    const ag = order.agendamento_para ? new Date(order.agendamento_para) : null
    setForm({
      id: order.id,
      number: order.number,
      client_id: order.client_id,
      status: order.status,
      opened_at: (order.opened_at || order.created || '').slice(0, 10),
      responsible_id: order.responsible_id || '',
      problem_description: order.problem_description || '',
      notes: order.notes || '',
      items: (order.items || []).map((i) => ({ ...i })),
      stock_released: order.stock_released,
      invoice_id: order.invoice_id,
      finished_at: order.finished_at,
      conversation_id: order.conversation_id,
      agendamento_data: ag
        ? `${ag.getFullYear()}-${pad2(ag.getMonth() + 1)}-${pad2(ag.getDate())}`
        : '',
      agendamento_hora: ag ? `${pad2(ag.getHours())}:${pad2(ag.getMinutes())}` : '',
    })
    setSignatureDataUrl(null)
    setSignaturePadOpen(false)
    setFormOpen(true)
  }

  // ---- Cliente da ficha (dados completos, salvos na coleção clients) ------
  const editingClient = form.client_id ? clients.find((c) => c.id === form.client_id) : undefined

  const handleClientSaved = (updated: Client) => {
    setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    // Atualiza também o snapshot na lista de OS, para o nome novo aparecer na tabela.
    setOrders((prev) =>
      prev.map((o) =>
        o.client_id === updated.id
          ? {
              ...o,
              expand: { ...o.expand, client_id: updated },
            }
          : o,
      ),
    )
    toast({ title: 'Dados do cliente atualizados no cadastro' })
  }

  // ---- Fotos (relatório fotográfico) --------------------------------------
  const handleAddPhoto = async (file: File) => {
    const order = editingOrder || orders.find((o) => o.id === form.id)
    if (!order) throw new Error('Salve a OS antes de adicionar fotos.')
    const updated = await serviceOrdersService.addPhoto(order, file)
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
    setForm((prev) => ({ ...prev }))
  }

  const handleRemovePhoto = async (filename: string) => {
    const order = editingOrder || orders.find((o) => o.id === form.id)
    if (!order) throw new Error('Salve a OS antes de remover fotos.')
    const updated = await serviceOrdersService.removePhoto(order, filename)
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
    setForm((prev) => ({ ...prev }))
  }

  // ---- Itens -------------------------------------------------------------
  const updateItem = (index: number, patch: Partial<ServiceOrderItem>) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i !== index) return item
        const next = { ...item, ...patch }
        next.total_price = (next.quantity || 0) * (next.unit_price || 0)
        return next
      }),
    }))
  }

  const changeItemType = (index: number, type: 'product' | 'service') => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i !== index) return item
        return {
          ...emptyItem(),
          item_type: type,
          quantity: item.quantity,
        }
      }),
    }))
  }

  const pickCatalogItem = (index: number, catalogId: string) => {
    if (!catalogId) {
      updateItem(index, {
        product_id: undefined,
        service_id: undefined,
        name_snapshot: '',
        unit_price: 0,
        total_price: 0,
      })
      return
    }
    if (form.items[index].item_type === 'product') {
      const product = products.find((p) => p.id === catalogId)
      if (!product) return
      updateItem(index, {
        product_id: product.id,
        service_id: undefined,
        name_snapshot: product.name,
        unit_price: product.sale_price || 0,
        total_price: (form.items[index].quantity || 0) * (product.sale_price || 0),
      })
    } else {
      const service = services.find((s) => s.id === catalogId)
      if (!service) return
      updateItem(index, {
        service_id: service.id,
        product_id: undefined,
        name_snapshot: service.name,
        unit_price: service.price || 0,
        total_price: (form.items[index].quantity || 0) * (service.price || 0),
      })
    }
  }

  const addItem = () => setForm((prev) => ({ ...prev, items: [...prev.items, emptyItem()] }))

  const removeItem = (index: number) =>
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }))

  // ---- CRUD ---------------------------------------------------------------
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.client_id) {
      toast({
        title: 'Atenção',
        description: 'Selecione o cliente da ordem de serviço.',
        variant: 'destructive',
      })
      return
    }
    const items = (form.items || []).filter(
      (i) => i.name_snapshot && i.quantity > 0 && (i.product_id || i.service_id),
    )
    if (items.length === 0) {
      toast({
        title: 'Atenção',
        description: 'Adicione pelo menos um item (produto ou serviço) à ordem.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    const total = items.reduce((sum, i) => sum + (i.total_price || 0), 0)
    const payload = {
      client_id: form.client_id,
      status: form.status,
      opened_at: form.opened_at ? new Date(`${form.opened_at}T12:00:00`).toISOString() : undefined,
      responsible_id: form.responsible_id || undefined,
      problem_description: form.problem_description.trim() || undefined,
      notes: form.notes.trim() || undefined,
      items,
      total_value: total,
      conversation_id: form.conversation_id || undefined,
      agendamento_para: form.agendamento_data
        ? new Date(`${form.agendamento_data}T${form.agendamento_hora || '09:00'}:00`).toISOString()
        : undefined,
    }

    try {
      if (form.id) {
        await serviceOrdersService.update(form.id, payload)
        toast({ title: 'Sucesso', description: 'Ordem de serviço atualizada!' })
      } else {
        await serviceOrdersService.create(payload)
        toast({ title: 'Sucesso', description: 'Ordem de serviço criada!' })
      }
      setFormOpen(false)
      await loadAll()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Verifique os dados e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  /**
   * Mudança de status pela ficha: grava no histórico e dispara o aviso de
   * WhatsApp ao cliente (rota do hook backend, canal Meta primário).
   */
  const handleStatusChange = async (novo: ServiceOrderStatus) => {
    if (!form.id) return
    const order = orders.find((o) => o.id === form.id)
    if (!order || order.status === novo) {
      setForm((prev) => ({ ...prev, status: novo }))
      return
    }
    setBusyStatusId(order.id)
    setAvisoInfo(null)
    try {
      const {
        order: updated,
        whatsapp,
        whatsappErro,
      } = await serviceOrdersService.changeStatus(
        order,
        novo,
        user ? { id: user.id, name: user.name } : undefined,
      )
      setForm((prev) => ({ ...prev, status: updated.status }))
      setAvisoInfo({ whatsapp, erro: whatsappErro })
      const feedback = avisoFeedback[whatsapp]
      toast({
        title: feedback.ok ? 'Status atualizado' : 'Status atualizado — aviso pendente',
        description: feedback.text,
        variant: feedback.ok ? 'default' : 'destructive',
      })
      await loadAll()
    } catch (err: any) {
      toast({
        title: 'Erro ao mudar status',
        description: err.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setBusyStatusId(null)
    }
  }

  const handleFinalize = async (order: ServiceOrder) => {
    setBusyId(order.id)
    const issues: StockIssue[] = []
    try {
      await serviceOrdersService.finalize(order, {
        userId: user?.id,
        onStockIssue: (issue) => issues.push(issue),
      })
      toast({
        title: 'Ordem finalizada!',
        description: 'Estoque baixado e conta a receber gerada no financeiro.',
      })
      for (const issue of issues) {
        toast({
          title: 'Atenção no estoque',
          description: issue.message,
          variant: 'destructive',
        })
      }
      setFinalizeTarget(null)
      await loadAll()
    } catch (err: any) {
      toast({
        title: 'Erro ao finalizar',
        description: err.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setBusyId(null)
    }
  }

  // Finalização com (opcional) assinatura coletada no diálogo: salva a assinatura
  // primeiro, quando houver, e depois segue o fluxo normal de finalização.
  const handleFinalizeWithSignature = async (order: ServiceOrder) => {
    if (signatureDataUrl) {
      try {
        const withSignature = await serviceOrdersService.saveSignature(order, signatureDataUrl)
        setSignatureDataUrl(null)
        setOrders((prev) => prev.map((o) => (o.id === withSignature.id ? withSignature : o)))
        await handleFinalize(withSignature)
        return
      } catch (err: any) {
        toast({
          title: 'Erro ao salvar assinatura',
          description: err?.message || 'Tente novamente.',
          variant: 'destructive',
        })
        return
      }
    }
    await handleFinalize(order)
  }

  const handleCancel = async (order: ServiceOrder) => {
    setBusyId(order.id)
    try {
      await serviceOrdersService.cancel(order)
      toast({
        title: 'Ordem cancelada',
        description: 'A baixa de estoque foi estornada, quando aplicável.',
      })
      setCancelTarget(null)
      await loadAll()
    } catch (err: any) {
      toast({
        title: 'Erro ao cancelar',
        description: err.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (order: ServiceOrder) => {
    if (
      !window.confirm(
        `Excluir a ordem ${order.number || ''}? Esta ação não pode ser desfeita (a conta a receber gerada não é removida).`,
      )
    )
      return
    try {
      await serviceOrdersService.remove(order.id)
      toast({ title: 'Ordem excluída' })
      await loadAll()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir',
        description: err.message || 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const editingOrder = form.id ? orders.find((o) => o.id === form.id) : undefined

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-blue-600" />
            Ordens de Serviço
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Abra, acompanhe e finalize ordens de serviço com integração automática de estoque e
            financeiro.
          </p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => openNew()}>
          <Plus className="h-4 w-4 mr-1.5" /> Nova Ordem
        </Button>
      </div>

      {/* Relatório do período */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription>OS abertas</CardDescription>
            <CardTitle className="text-2xl text-blue-600">{report.open}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription>Em andamento</CardDescription>
            <CardTitle className="text-2xl text-amber-600">{report.inProgress}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription>Finalizadas</CardDescription>
            <CardTitle className="text-2xl text-emerald-600">{report.finishedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription>Faturamento de OS (finalizadas)</CardDescription>
            <CardTitle className="text-2xl text-slate-900">
              {report.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </CardTitle>
          </CardHeader>
        </Card>
        <input
          type="date"
          value={periodStart}
          onChange={(e) => setPeriodStart(e.target.value)}
          className="hidden"
          aria-hidden
        />
        <input
          type="date"
          value={periodEnd}
          onChange={(e) => setPeriodEnd(e.target.value)}
          className="hidden"
          aria-hidden
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500 -mt-2">
        <span>Período do relatório:</span>
        <input
          type="date"
          value={periodStart}
          onChange={(e) => setPeriodStart(e.target.value)}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs"
        />
        <span>até</span>
        <input
          type="date"
          value={periodEnd}
          onChange={(e) => setPeriodEnd(e.target.value)}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número, cliente ou problema..."
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
        >
          <option value="all">Todos os status</option>
          {Object.entries(serviceOrderStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-500">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2"></div>
            <p className="text-sm">Carregando ordens de serviço...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <ClipboardList className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">
              Nenhuma ordem de serviço encontrada
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Crie a primeira OS para começar a acompanhar os serviços.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Abertura</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100">
                {filtered.map((order) => (
                  <TableRow key={order.id} className="hover:bg-slate-50/70">
                    <TableCell className="font-semibold text-slate-900">
                      {order.number || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-800">{getClientName(order)}</div>
                      {order.expand?.responsible_id && (
                        <div className="text-xs text-slate-400">
                          Resp.: {order.expand.responsible_id.name}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {(order.opened_at || order.created || '')
                        .slice(0, 10)
                        .split('-')
                        .reverse()
                        .join('/')}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {(order.items || []).length} item(ns)
                    </TableCell>
                    <TableCell className="font-medium text-slate-900">
                      {(order.total_value || 0).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        <Badge className={cn('text-xs', statusBadgeClasses[order.status])}>
                          {serviceOrderStatusLabels[order.status]}
                        </Badge>
                        {order.invoice_id && (
                          <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Fatura gerada
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {order.status !== 'finalizada' && order.status !== 'cancelada' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            onClick={() => setFinalizeTarget(order)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Finalizar
                          </Button>
                        )}
                        {order.status === 'finalizada' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            onClick={() => setCancelTarget(order)}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-blue-600"
                          onClick={() => openEdit(order)}
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                          onClick={() => handleDelete(order)}
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Modal criar/editar */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {form.id ? `Editar ${form.number || 'Ordem'}` : 'Nova Ordem de Serviço'}
            </DialogTitle>
            <DialogDescription>
              Vincule a OS a um cliente e componha os itens com produtos e/ou serviços do cadastro.
              Ao finalizar, o estoque é baixado e a conta a receber é gerada automaticamente.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Cliente *</Label>
                <select
                  value={form.client_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, client_id: e.target.value }))}
                  className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
                  required
                >
                  <option value="">Selecione o cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select
                  value={form.status}
                  disabled={busyStatusId === form.id}
                  onChange={(e) => {
                    const novo = e.target.value as ServiceOrderStatus
                    if (form.id) {
                      // Editando: a mudança de status passa pelo changeStatus
                      // (histórico + aviso de WhatsApp no backend).
                      handleStatusChange(novo)
                    } else {
                      setForm((prev) => ({ ...prev, status: novo }))
                    }
                  }}
                  className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
                >
                  {Object.entries(serviceOrderStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {form.id && (
                  <p className="text-[11px] text-slate-400">
                    Mudar aqui grava no histórico e avisa o cliente por WhatsApp.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Data de abertura</Label>
                <Input
                  type="date"
                  value={form.opened_at}
                  onChange={(e) => setForm((prev) => ({ ...prev, opened_at: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Agendamento da visita</Label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={form.agendamento_data}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, agendamento_data: e.target.value }))
                    }
                    className="flex-1"
                  />
                  <Input
                    type="time"
                    value={form.agendamento_hora}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, agendamento_hora: e.target.value }))
                    }
                    className="w-28"
                  />
                </div>
                {form.agendamento_data && (
                  <p className="text-[11px] text-slate-400">
                    Visita agendada para{' '}
                    {new Date(
                      `${form.agendamento_data}T${form.agendamento_hora || '09:00'}:00`,
                    ).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Técnico responsável</Label>
                <select
                  value={form.responsible_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, responsible_id: e.target.value }))}
                  className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
                >
                  <option value="">Selecione (opcional)</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Problema / Descrição</Label>
                <Textarea
                  value={form.problem_description}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, problem_description: e.target.value }))
                  }
                  placeholder="Descreva o problema relatado ou o serviço solicitado..."
                  rows={2}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Observações internas</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Anotações internas (peças pedidas, prazos, etc.)"
                  rows={2}
                />
              </div>
            </div>

            {/* Aviso de WhatsApp da última mudança de status */}
            {avisoInfo && (
              <div
                className={cn(
                  'rounded-lg border px-3 py-2 text-xs flex items-start gap-2',
                  avisoFeedback[avisoInfo.whatsapp].ok
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700',
                )}
              >
                <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  {avisoFeedback[avisoInfo.whatsapp].text}
                  {avisoInfo.erro ? ` (${avisoInfo.erro})` : ''}
                </span>
              </div>
            )}

            {/* Histórico de mudanças (somente leitura) */}
            {editingOrder && (editingOrder.historico || []).length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-slate-400" /> Histórico de mudanças
                </Label>
                <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-44 overflow-y-auto">
                  {[...(editingOrder.historico || [])].reverse().map((h, i) => (
                    <div
                      key={i}
                      className="px-3 py-2 text-xs text-slate-600 flex items-start gap-2"
                    >
                      <Clock className="h-3 w-3 mt-0.5 text-slate-400 shrink-0" />
                      <div>
                        <span className="font-medium text-slate-800">
                          {serviceOrderStatusLabels[h.de as ServiceOrderStatus] || h.de || '—'} →{' '}
                          {serviceOrderStatusLabels[h.para as ServiceOrderStatus] || h.para}
                        </span>
                        <span className="text-slate-400">
                          {' '}
                          · {new Date(h.quando).toLocaleString('pt-BR')}
                        </span>
                        {h.por_nome && <span className="text-slate-400"> · {h.por_nome}</span>}
                        {h.aviso_whatsapp && (
                          <span className="text-slate-400"> · WhatsApp: {h.aviso_whatsapp}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dados do cliente (visíveis e editáveis; salvos na coleção clients) */}
            {form.id && (
              <div className="space-y-3 rounded-lg border border-slate-200 p-3 bg-slate-50/60">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5">
                    <UserIcon className="h-3.5 w-3.5 text-slate-400" /> Dados do cliente
                  </Label>
                  {editingClient && (
                    <span className="text-[11px] text-slate-400">
                      Salvo no cadastro de clientes
                    </span>
                  )}
                </div>
                <ServiceOrderClientData
                  order={
                    editingOrder || orders.find((o) => o.id === form.id) || ({} as ServiceOrder)
                  }
                  client={editingClient || null}
                  onSaved={handleClientSaved}
                />
              </div>
            )}

            {/* Relatório fotográfico e assinatura (somente OS já salva) */}
            {form.id && editingOrder && (
              <>
                <div className="space-y-3 rounded-lg border border-slate-200 p-3 bg-slate-50/60">
                  <Label className="flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5 text-slate-400" /> Relatório fotográfico
                  </Label>
                  <PhotoReport
                    order={editingOrder}
                    onAddPhoto={handleAddPhoto}
                    onRemovePhoto={handleRemovePhoto}
                  />
                </div>

                <div className="space-y-3 rounded-lg border border-slate-200 p-3 bg-slate-50/60">
                  <Label className="flex items-center gap-1.5">
                    <PenLine className="h-3.5 w-3.5 text-slate-400" /> Assinatura do cliente
                  </Label>
                  {editingOrder.signature ? (
                    <div className="flex items-start gap-3">
                      <img
                        src={serviceOrderFileUrl(editingOrder.id, editingOrder.signature)}
                        alt={`Assinatura do cliente na OS ${editingOrder.number}`}
                        className="h-24 rounded-md border bg-white object-contain"
                      />
                      <div className="space-y-2">
                        <p className="text-xs text-slate-500">
                          Assinatura salva nesta OS (
                          {new Date(editingOrder.updated).toLocaleString('pt-BR')})
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSignatureDataUrl(null)
                            setSignaturePadOpen(true)
                          }}
                        >
                          <PenLine className="h-4 w-4" />
                          Assinar novamente
                        </Button>
                      </div>
                    </div>
                  ) : !signaturePadOpen ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSignatureDataUrl(null)
                        setSignaturePadOpen(true)
                      }}
                    >
                      <PenLine className="h-4 w-4" /> Coletar assinatura
                    </Button>
                  ) : null}
                  {signaturePadOpen && (
                    <SignaturePad
                      onChange={(dataUrl) => setSignatureDataUrl(dataUrl)}
                      className="pt-1"
                    />
                  )}
                  {signaturePadOpen && (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        disabled={savingSignature || !signatureDataUrl}
                        onClick={async () => {
                          const order = editingOrder
                          if (!order || typeof signatureDataUrl !== 'string') return
                          setSavingSignature(true)
                          try {
                            const updated = await serviceOrdersService.saveSignature(
                              order,
                              signatureDataUrl,
                            )
                            setOrders((prev) =>
                              prev.map((o) => (o.id === updated.id ? updated : o)),
                            )
                            setSignatureDataUrl(null)
                            setSignaturePadOpen(false)
                            toast({ title: 'Assinatura salva na OS' })
                          } catch (err: any) {
                            toast({
                              title: 'Erro ao salvar assinatura',
                              description: err?.message || 'Tente novamente.',
                              variant: 'destructive',
                            })
                          } finally {
                            setSavingSignature(false)
                          }
                        }}
                      >
                        {savingSignature ? 'Salvando...' : 'Salvar assinatura'}
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Itens */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Itens (produtos e/ou serviços)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar item
                </Button>
              </div>
              {(form.items || []).map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-12 gap-2 items-end rounded-lg border border-slate-200 p-3 bg-slate-50/60"
                >
                  <div className="col-span-12 sm:col-span-3 space-y-1">
                    <Label className="text-[11px] text-slate-500">Tipo</Label>
                    <select
                      value={item.item_type}
                      onChange={(e) =>
                        changeItemType(index, e.target.value as 'product' | 'service')
                      }
                      className="w-full flex h-9 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-xs"
                    >
                      <option value="product">Produto</option>
                      <option value="service">Serviço</option>
                    </select>
                  </div>
                  <div className="col-span-12 sm:col-span-4 space-y-1">
                    <Label className="text-[11px] text-slate-500">
                      {item.item_type === 'product' ? 'Produto' : 'Serviço'}
                    </Label>
                    <select
                      value={item.product_id || item.service_id || ''}
                      onChange={(e) => pickCatalogItem(index, e.target.value)}
                      className="w-full flex h-9 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-xs"
                    >
                      <option value="">Selecione...</option>
                      {item.item_type === 'product'
                        ? products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} —{' '}
                              {(p.sale_price || 0).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </option>
                          ))
                        : services.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} —{' '}
                              {(s.price || 0).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </option>
                          ))}
                    </select>
                  </div>
                  <div className="col-span-3 sm:col-span-1 space-y-1">
                    <Label className="text-[11px] text-slate-500">Qtd.</Label>
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(index, { quantity: parseInt(e.target.value) || 0 })
                      }
                      className="h-9"
                    />
                  </div>
                  <div className="col-span-5 sm:col-span-2 space-y-1">
                    <Label className="text-[11px] text-slate-500">Preço un.</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) =>
                        updateItem(index, { unit_price: parseFloat(e.target.value) || 0 })
                      }
                      className="h-9"
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2 space-y-1">
                    <Label className="text-[11px] text-slate-500">Total</Label>
                    <div className="h-9 flex items-center px-2 text-sm font-medium text-slate-700">
                      {(item.total_price || 0).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </div>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-rose-500 hover:text-rose-700"
                      onClick={() => removeItem(index)}
                      title="Remover item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-end gap-4 pt-1">
                <span className="text-xs text-slate-500 flex items-center gap-1.5">
                  {form.items.some((i) => i.item_type === 'product') && (
                    <>
                      <Package className="h-3.5 w-3.5" /> estoque baixa ao finalizar
                    </>
                  )}
                  {form.items.some((i) => i.item_type === 'service') && (
                    <>
                      <Wrench className="h-3.5 w-3.5 ml-2" /> serviços
                    </>
                  )}
                </span>
                <div className="text-sm font-bold text-slate-900">
                  Total: {formTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
              </div>
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={saving}>
                {saving ? 'Salvando...' : form.id ? 'Salvar alterações' : 'Criar ordem'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de finalização */}
      <Dialog open={!!finalizeTarget} onOpenChange={(open) => !open && setFinalizeTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar ordem {finalizeTarget?.number}?</DialogTitle>
            <DialogDescription>
              Ao finalizar, o estoque dos produtos será baixado e uma conta a receber de{' '}
              <strong>
                {(finalizeTarget?.total_value || 0).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </strong>{' '}
              será criada no financeiro.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {finalizeTarget?.signature ? (
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 bg-slate-50/60">
                <img
                  src={serviceOrderFileUrl(finalizeTarget.id, finalizeTarget.signature)}
                  alt={`Assinatura do cliente na OS ${finalizeTarget.number}`}
                  className="h-16 rounded border bg-white object-contain"
                />
                <span className="text-xs text-slate-500">Assinatura já coletada nesta OS.</span>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-500">
                  Assinatura do cliente (opcional) — pode ser coletada depois na ficha da OS.
                </p>
                <SignaturePad onChange={(dataUrl) => setSignatureDataUrl(dataUrl)} />
              </>
            )}
          </div>
          <DialogFooter className="pt-3 border-t">
            <Button variant="outline" onClick={() => setFinalizeTarget(null)}>
              Voltar
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => finalizeTarget && handleFinalizeWithSignature(finalizeTarget)}
              disabled={busyId === finalizeTarget?.id}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              {busyId === finalizeTarget?.id ? 'Finalizando...' : 'Confirmar finalização'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de cancelamento */}
      <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Cancelar ordem{' '}
              {cancelTarget?.number}?
            </DialogTitle>
            <DialogDescription>
              O cancelamento devolve ao estoque os produtos que tiveram baixa nesta OS. A conta a
              receber já gerada deve ser removida ou estornada manualmente no financeiro.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-3 border-t">
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelTarget && handleCancel(cancelTarget)}
              disabled={busyId === cancelTarget?.id}
            >
              {busyId === cancelTarget?.id ? 'Cancelando...' : 'Confirmar cancelamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
