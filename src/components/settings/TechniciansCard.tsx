import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { techniciansService, scheduleReservationsService } from '@/services/technicians'
import type { Technician, ScheduleReservation } from '@/types/crm'
import { Trash2, Loader2, Pencil, Plus } from 'lucide-react'

// ==================== Card Técnicos ====================
export function TechniciansCard() {
  const { toast } = useToast()
  const [items, setItems] = useState<Technician[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await techniciansService.list())
    } catch {
      toast({ title: 'Erro ao carregar técnicos', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const startEdit = (t: Technician) => {
    setEditingId(t.id)
    setName(t.name)
    setPhone(t.phone || '')
  }

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setPhone('')
  }

  const save = async () => {
    if (!name.trim()) {
      toast({ title: 'Informe o nome do técnico', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await techniciansService.update(editingId, { name: name.trim(), phone: phone.trim() })
      } else {
        await techniciansService.create({ name: name.trim(), phone: phone.trim(), active: true })
      }
      toast({ title: editingId ? 'Técnico atualizado' : 'Técnico cadastrado' })
      resetForm()
      await load()
    } catch {
      toast({ title: 'Erro ao salvar técnico', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (t: Technician) => {
    try {
      await techniciansService.update(t.id, { active: !t.active })
      await load()
    } catch {
      toast({ title: 'Erro ao atualizar técnico', variant: 'destructive' })
    }
  }

  const remove = async (t: Technician) => {
    if (!window.confirm(`Excluir o técnico "${t.name}"?`)) return
    try {
      await techniciansService.remove(t.id)
      toast({ title: 'Técnico excluído' })
      await load()
    } catch {
      toast({ title: 'Erro ao excluir técnico', variant: 'destructive' })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Técnicos</CardTitle>
        <CardDescription>
          Técnicos cadastrados recebem as ordens de serviço agendadas. O primeiro técnico ativo da
          lista é o técnico principal padrão das OS abertas via WhatsApp.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="tech-name">Nome</Label>
            <Input
              id="tech-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do técnico"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tech-phone">Telefone</Label>
            <Input
              id="tech-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(66) 99999-0000"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {editingId ? 'Salvar' : 'Adicionar'}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum técnico cadastrado ainda.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {items.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.phone || '—'}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Switch checked={!!t.active} onCheckedChange={() => void toggleActive(t)} />
                    <span className="text-xs text-muted-foreground">
                      {t.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => startEdit(t)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => void remove(t)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

// ==================== Card Reserva de agenda ====================
export function ScheduleReservationsCard() {
  const { toast } = useToast()
  const [items, setItems] = useState<ScheduleReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await scheduleReservationsService.list())
    } catch {
      toast({ title: 'Erro ao carregar reservas', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    if (!date) {
      toast({ title: 'Escolha a data da reserva', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await scheduleReservationsService.create({
        date,
        time: time.trim(),
        reason: reason.trim(),
      })
      toast({
        title: time.trim()
          ? `Horário ${time.trim()} reservado em ${date}`
          : `Dia ${date} reservado por inteiro`,
      })
      setDate('')
      setTime('')
      setReason('')
      await load()
    } catch {
      toast({ title: 'Erro ao criar reserva', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (r: ScheduleReservation) => {
    try {
      await scheduleReservationsService.remove(r.id)
      toast({ title: 'Reserva removida' })
      await load()
    } catch {
      toast({ title: 'Erro ao remover reserva', variant: 'destructive' })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reserva de agenda</CardTitle>
        <CardDescription>
          Bloqueia um dia inteiro (deixando o horário vazio) ou um horário específico — o bot não
          oferece essas datas aos clientes. Use para implantações, compromissos internos etc.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1.5fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="res-date">Data</Label>
            <Input
              id="res-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-time">Horário (opcional)</Label>
            <Input
              id="res-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="Vazio = dia inteiro"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-reason">Motivo</Label>
            <Input
              id="res-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: implantação na sexta"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Reservar
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma reserva de agenda.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {items.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR')}{' '}
                    {r.time ? `às ${r.time}` : '(dia inteiro)'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{r.reason || '—'}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => void remove(r)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
