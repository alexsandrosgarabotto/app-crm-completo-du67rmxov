import { useEffect, useMemo, useState } from 'react'
import { ClipboardList, ExternalLink, Loader2, Pencil, Plus, Save, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { clientsService } from '@/services/clients'
import { serviceOrdersService, serviceOrderStatusLabels } from '@/services/serviceOrders'
import type { Client, ServiceOrder } from '@/types/crm'

const statusBadgeClasses: Record<string, string> = {
  aberta: 'bg-blue-100 text-blue-800 border-0',
  em_andamento: 'bg-amber-100 text-amber-800 border-0',
  aguardando_peca: 'bg-purple-100 text-purple-800 border-0',
  finalizada: 'bg-emerald-100 text-emerald-800 border-0',
  cancelada: 'bg-rose-100 text-rose-800 border-0',
}

function formatCurrency(value?: number): string {
  return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface ClientFormState {
  name: string
  phone: string
  email: string
  notes: string
}

function formFromClient(client: Client): ClientFormState {
  return {
    name: client.name || '',
    phone: client.phone || '',
    email: client.email || '',
    notes: client.notes || '',
  }
}

/**
 * Ficha do cliente dentro do atendimento WhatsApp: conferir, editar e salvar
 * os dados (nome, telefone, e-mail, observações) direto na tela, sem sair.
 * Inclui a lista de ordens de serviço do cliente e o atalho para abrir uma OS
 * vinculada a esta conversa.
 */
export function ClientInfoPanel({
  client,
  conversationId,
  onClientUpdated,
}: {
  client: Client
  conversationId?: string
  onClientUpdated?: (client: Client) => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<ClientFormState>(() => formFromClient(client))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setEditing(false)
    setForm(formFromClient(client))
  }, [client.id, client.updated])

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({
        title: 'Atenção',
        description: 'O nome do cliente é obrigatório.',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const updated = await clientsService.update(client.id, {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        notes: form.notes.trim() || undefined,
      })
      toast({ title: 'Sucesso', description: 'Dados do cliente atualizados!' })
      setEditing(false)
      onClientUpdated?.(updated)
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

  return (
    <Card className="border-slate-200 shadow-xs">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold text-slate-700">Dados do cliente</CardTitle>
        {editing ? (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              className="h-8 bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-1" />
              )}
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => {
                setEditing(false)
                setForm(formFromClient(client))
              }}
            >
              <X className="h-3.5 w-3.5 mr-1" /> Cancelar
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="h-8" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Nome do cliente"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Telefone / WhatsApp</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="(00) 90000-0000"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="cliente@email.com"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs text-slate-500">Observações</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Observações sobre o cliente..."
                rows={2}
              />
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-[11px] text-slate-400">Nome</dt>
              <dd className="text-slate-800 font-medium truncate">{client.name || '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-400">Telefone</dt>
              <dd className="text-slate-800 truncate">{client.phone || '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-400">E-mail</dt>
              <dd className="text-slate-800 truncate">{client.email || '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-400">Observações</dt>
              <dd className="text-slate-600 text-xs line-clamp-2">{client.notes || '—'}</dd>
            </div>
          </dl>
        )}
        <ClientOrdersSection clientId={client.id} conversationId={conversationId} />
      </CardContent>
    </Card>
  )
}

/**
 * Lista as OS da conversa (e as demais do cliente) e permite abrir uma OS
 * existente ou criar uma nova para aquele cliente, já vinculada à conversa.
 */
export function ClientOrdersSection({
  clientId,
  conversationId,
}: {
  clientId: string
  conversationId?: string
}) {
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    serviceOrdersService
      .getByClientId(clientId)
      .then((data) => {
        if (!cancelled) setOrders(data)
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [clientId])

  const conversationOrders = useMemo(
    () => orders.filter((o) => conversationId && o.conversation_id === conversationId),
    [orders, conversationId],
  )

  const visibleOrders = showAll || !conversationId ? orders : conversationOrders

  return (
    <div className="pt-3 border-t border-slate-100 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
          <ClipboardList className="h-4 w-4 text-blue-600" />
          Ordens de serviço
          {conversationId && !showAll && conversationOrders.length > 0 && (
            <span className="text-[11px] font-normal text-slate-400">(desta conversa)</span>
          )}
        </span>
        <Button
          size="sm"
          className="h-8 bg-blue-600 hover:bg-blue-700"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Abrir OS
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400 flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" /> Carregando ordens de serviço...
        </p>
      ) : visibleOrders.length === 0 ? (
        <p className="text-xs text-slate-400">
          {showAll || !conversationId
            ? 'Nenhuma ordem de serviço para este cliente.'
            : 'Nenhuma OS aberta a partir desta conversa.'}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {visibleOrders.map((order) => (
            <li key={order.id}>
              <button
                onClick={() => setSelectedOrder(order)}
                className="w-full flex items-center justify-between gap-2 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-slate-700">
                    {order.number || order.id.slice(0, 6)}
                  </span>
                  <span className="text-slate-500 truncate">
                    {(order.items || []).length} item(ns) · {formatCurrency(order.total_value)}
                  </span>
                </span>
                <Badge
                  className={
                    statusBadgeClasses[order.status] || 'bg-slate-100 text-slate-700 border-0'
                  }
                >
                  {serviceOrderStatusLabels[order.status] || order.status}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}

      {conversationId && orders.length > conversationOrders.length && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="text-[11px] text-blue-600 hover:underline"
        >
          {showAll
            ? 'Mostrar apenas desta conversa'
            : `Mostrar todas do cliente (${orders.length})`}
        </button>
      )}

      {/* Modal: criar OS a partir do atendimento */}
      <CreateOrderFromConversationModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        clientId={clientId}
        conversationId={conversationId}
        onCreated={(order) => {
          setCreateOpen(false)
          setOrders((prev) => [order, ...prev])
          toast({
            title: 'Ordem criada!',
            description: `A OS ${order.number} foi vinculada a este atendimento.`,
          })
        }}
      />

      {/* Modal: detalhes da OS */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ordem {selectedOrder?.number}</DialogTitle>
            <DialogDescription>
              {selectedOrder && serviceOrderStatusLabels[selectedOrder.status]} ·{' '}
              {selectedOrder && formatCurrency(selectedOrder.total_value)}
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-2 text-sm">
              {selectedOrder.problem_description && (
                <div>
                  <p className="text-[11px] text-slate-400">Problema / Descrição</p>
                  <p className="text-slate-700 whitespace-pre-wrap">
                    {selectedOrder.problem_description}
                  </p>
                </div>
              )}
              <div>
                <p className="text-[11px] text-slate-400 mb-1">Itens</p>
                {selectedOrder.items?.length ? (
                  <ul className="space-y-1">
                    {selectedOrder.items.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between text-xs border border-slate-100 rounded px-2 py-1"
                      >
                        <span className="truncate">
                          {item.item_type === 'product' ? 'Produto' : 'Serviço'}:{' '}
                          {item.name_snapshot} × {item.quantity}
                        </span>
                        <span className="font-medium text-slate-700">
                          {formatCurrency(item.total_price)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400">
                    Nenhum item ainda — adicione itens na tela de Ordens de Serviço.
                  </p>
                )}
              </div>
              {selectedOrder.notes && (
                <div>
                  <p className="text-[11px] text-slate-400">Observações</p>
                  <p className="text-slate-600 text-xs whitespace-pre-wrap">
                    {selectedOrder.notes}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="pt-3 border-t">
            <Button variant="outline" onClick={() => setSelectedOrder(null)}>
              Fechar
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                window.location.href = `/ordens-servico?os=${selectedOrder?.id}`
              }}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir em Ordens de Serviço
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * Cria uma OS para o cliente do atendimento, já vinculada à conversa
 * (conversation_id), com descrição pré-preenchida. Os itens podem ser
 * adicionados depois na tela de Ordens de Serviço.
 */
function CreateOrderFromConversationModal({
  open,
  onOpenChange,
  clientId,
  conversationId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string
  conversationId?: string
  onCreated: (order: ServiceOrder) => void
}) {
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setDescription('')
      setNotes('')
    }
  }, [open])

  const handleCreate = async () => {
    setSaving(true)
    try {
      const order = await serviceOrdersService.create({
        client_id: clientId,
        status: 'aberta',
        opened_at: new Date().toISOString(),
        problem_description: description.trim() || undefined,
        notes: notes.trim() || undefined,
        conversation_id: conversationId || undefined,
      })
      onCreated(order)
    } catch (err: any) {
      toast({
        title: 'Erro ao criar OS',
        description: err.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Abrir Ordem de Serviço</DialogTitle>
          <DialogDescription>
            Uma OS será criada para este cliente e vinculada a este atendimento. Depois você pode
            adicionar itens de produto/serviço na aba Ordens de Serviço.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="os-desc">Problema / Descrição</Label>
            <Textarea
              id="os-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Cliente relatou que o aparelho não liga..."
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="os-notes">Observações internas (opcional)</Label>
            <Textarea
              id="os-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotação interna sobre esta OS..."
              rows={2}
            />
          </div>
        </div>
        <DialogFooter className="pt-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={handleCreate}
            disabled={saving}
          >
            {saving ? 'Criando...' : 'Criar OS'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
