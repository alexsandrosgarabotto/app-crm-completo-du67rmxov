import { useEffect, useState } from 'react'
import { Loader2, Lock } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { scheduleReservationsService } from '@/services/technicians'
import type { ScheduleReservation } from '@/types/crm'

const formatDay = (date: string) => new Date(date + 'T12:00:00').toLocaleDateString('pt-BR')

// ==================== Dialog: criar reserva de agenda ====================
// Mesma collection de Configurações → Mensagens Automáticas (Reserva de
// agenda): bloqueia o dia inteiro (horário vazio) ou um horário específico,
// e o bot do WhatsApp deixa de oferecer esse dia/horário.
export function ReservationCreateDialog({
  open,
  onOpenChange,
  initialDate,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDate: string
  onCreated: (r: ScheduleReservation) => void
}) {
  const { toast } = useToast()
  const [date, setDate] = useState(initialDate)
  const [time, setTime] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setDate(initialDate)
      setTime('')
      setReason('')
    }
  }, [open, initialDate])

  const submit = async () => {
    if (!date) {
      toast({ title: 'Escolha a data da reserva', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const created = await scheduleReservationsService.create({
        date,
        time: time.trim(),
        reason: reason.trim(),
      })
      toast({
        title: time.trim()
          ? `Horário ${time.trim()} reservado em ${formatDay(date)}`
          : `Dia ${formatDay(date)} reservado por inteiro`,
        description: 'O bot do WhatsApp não oferece mais esse horário.',
      })
      onOpenChange(false)
      onCreated(created)
    } catch {
      toast({
        title: 'Erro ao criar reserva',
        description: 'Verifique a conexão e tente novamente.',
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
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-slate-500" /> Reservar agenda
          </DialogTitle>
          <DialogDescription>
            Bloqueia o dia inteiro (deixando o horário vazio) ou um horário específico — o bot do
            WhatsApp não oferece essas datas aos clientes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="agenda-res-date">Data</Label>
            <Input
              id="agenda-res-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="agenda-res-time">Horário (opcional)</Label>
            <Input
              id="agenda-res-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="Vazio = dia inteiro"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="agenda-res-reason">Motivo</Label>
            <Input
              id="agenda-res-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: implantação na sexta"
              maxLength={300}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            variant="outline"
            className="h-11"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button className="h-11" onClick={() => void submit()} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Reservar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ==================== Dialog: excluir reserva (desbloquear) ====================
export function ReservationDeleteConfirm({
  target,
  onOpenChange,
  onDeleted,
}: {
  target: ScheduleReservation | null
  onOpenChange: (open: boolean) => void
  onDeleted: (r: ScheduleReservation) => void
}) {
  const { toast } = useToast()
  const [deleting, setDeleting] = useState(false)

  const remove = async () => {
    if (!target) return
    setDeleting(true)
    try {
      await scheduleReservationsService.remove(target.id)
      toast({
        title: 'Reserva removida',
        description: target.time
          ? `Horário ${target.time} voltou a ficar disponível.`
          : 'O dia voltou a ficar disponível para o bot.',
      })
      onOpenChange(false)
      onDeleted(target)
    } catch {
      toast({
        title: 'Erro ao remover reserva',
        description: 'Verifique a conexão e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={!!target} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Remover esta reserva?</AlertDialogTitle>
          <AlertDialogDescription>
            {target
              ? `${formatDay(target.date)} — ${
                  target.time ? `horário ${target.time}` : 'dia inteiro'
                }${target.reason ? ` (${target.reason})` : ''}. O dia/horário volta a ser oferecido pelo bot do WhatsApp.`
              : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="h-11" disabled={deleting}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            className="h-11 bg-rose-600 text-white hover:bg-rose-700"
            disabled={deleting}
            onClick={(e) => {
              e.preventDefault()
              void remove()
            }}
          >
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            Remover reserva
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
