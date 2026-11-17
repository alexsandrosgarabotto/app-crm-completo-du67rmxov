import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Lock,
  MapPin,
  Phone,
  Wrench,
  Cake,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { serviceOrderStatusLabels, serviceOrdersService } from '@/services/serviceOrders'
import { scheduleReservationsService, techniciansService } from '@/services/technicians'
import type { Holiday, ScheduleReservation, ServiceOrder, Technician } from '@/types/crm'
import {
  statusBlockClasses,
  statusDotClasses,
  toKey,
  statusLabelOf,
  agendamentoHora,
  groupOrdersByDay,
  groupReservationsByDay,
  mapHolidaysByDay,
} from '@/lib/agendaUtils'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const pad2 = (n: number) => String(n).padStart(2, '0')

export default function AgendaPage() {
  const navigate = useNavigate()
  const today = useMemo(() => new Date(), [])
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth()) // 0-11
  const [selected, setSelected] = useState<string>(toKey(today))

  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [reservations, setReservations] = useState<ScheduleReservation[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([
      serviceOrdersService.getAll(),
      scheduleReservationsService.list(),
      techniciansService.list(),
      pb
        .collection('holidays')
        .getList<Holiday>(1, 500, { sort: 'date' })
        .then((r) => r.items),
    ])
      .then(([ordersData, reservationsData, techniciansData, holidaysData]) => {
        if (!alive) return
        setOrders(ordersData)
        setReservations(reservationsData)
        setTechnicians(techniciansData)
        setHolidays(holidaysData)
      })
      .catch((err) => {
        console.error('Erro ao carregar a agenda:', err)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  /** Grade do mês: sempre 6 semanas (42 dias), começando no domingo. */
  const gridDays = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1)
    const start = new Date(first)
    start.setDate(first.getDate() - first.getDay())
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [viewYear, viewMonth])

  const ordersByDay = useMemo(() => groupOrdersByDay(orders), [orders])
  const reservationsByDay = useMemo(() => groupReservationsByDay(reservations), [reservations])
  const holidaysByDay = useMemo(() => mapHolidaysByDay(holidays), [holidays])

  const technicianName = (id?: string) => {
    if (!id) return '—'
    return technicians.find((t) => t.id === id)?.name || '—'
  }

  const openOrder = (order: ServiceOrder) => {
    navigate(`/ordens-servico?os=${order.id}`)
  }

  const goPrev = () => {
    const d = new Date(viewYear, viewMonth - 1, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }
  const goNext = () => {
    const d = new Date(viewYear, viewMonth + 1, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }
  const goToday = () => {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
    setSelected(toKey(today))
  }

  const selectedOrders = ordersByDay.get(selected) || []
  const selectedReservations = reservationsByDay.get(selected) || []
  const selectedHoliday = holidaysByDay.get(selected)

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarDays className="h-7 w-7 text-blue-600" />
            Agenda
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Calendário mensal das ordens de serviço agendadas, com reservas de agenda e feriados.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goPrev} aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={goToday}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={goNext} aria-label="Mês seguinte">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Título do mês + legenda */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-800">
          {MONTHS[viewMonth]} de {viewYear}
        </h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
          {Object.entries(serviceOrderStatusLabels).map(([status, label]) => (
            <span key={status} className="flex items-center gap-1.5">
              <span
                className={cn(
                  'h-2.5 w-2.5 rounded-full',
                  statusDotClasses[status as ServiceOrder['status']],
                )}
              />
              {label}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-slate-400" /> Reserva
          </span>
          <span className="flex items-center gap-1.5">
            <Cake className="h-3 w-3 text-pink-400" /> Feriado
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 items-start">
        {/* Calendário */}
        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-2 sm:p-4">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400 py-1"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {gridDays.map((day) => {
                const key = toKey(day)
                const inMonth = day.getMonth() === viewMonth
                const isToday = key === toKey(today)
                const isSelected = key === selected
                const dayOrders = ordersByDay.get(key) || []
                const dayReservations = reservationsByDay.get(key) || []
                const holiday = holidaysByDay.get(key)
                const weekend = day.getDay() === 0 || day.getDay() === 6

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelected(key)}
                    className={cn(
                      'min-h-[84px] sm:min-h-[104px] rounded-lg border p-1.5 text-left align-top flex flex-col gap-1 transition-colors',
                      inMonth ? 'bg-white' : 'bg-slate-50/60 text-slate-400',
                      weekend && inMonth && 'bg-slate-50',
                      holiday && inMonth && 'bg-pink-50/60 border-pink-100',
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-100'
                        : 'border-slate-200 hover:border-slate-300',
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={cn(
                          'text-xs font-semibold',
                          inMonth ? 'text-slate-700' : 'text-slate-400',
                          isToday &&
                            'h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center',
                        )}
                      >
                        {day.getDate()}
                      </span>
                      {holiday && inMonth && (
                        <span title={holiday}>
                          <Cake className="h-3 w-3 text-pink-400 shrink-0" />
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      {dayOrders.slice(0, 3).map((order) => (
                        <span
                          key={order.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            openOrder(order)
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') openOrder(order)
                          }}
                          className={cn(
                            'truncate text-[10px] leading-tight rounded px-1 py-0.5 border cursor-pointer',
                            statusBlockClasses[order.status],
                          )}
                          title={`${agendamentoHora(order)} · ${order.client_name || 'Cliente'} · ${statusLabelOf(order)}`}
                        >
                          {agendamentoHora(order) && `${agendamentoHora(order)} `}
                          {order.client_name || 'Cliente'}
                        </span>
                      ))}
                      {dayOrders.length > 3 && (
                        <span className="text-[9px] text-slate-400 px-1">
                          +{dayOrders.length - 3} mais
                        </span>
                      )}
                      {dayReservations.slice(0, 2).map((r) => (
                        <span
                          key={r.id}
                          className="truncate text-[10px] leading-tight rounded px-1 py-0.5 border border-dashed border-slate-300 bg-slate-100 text-slate-500 flex items-center gap-1"
                          title={`Reservado: ${r.reason || 'bloqueado para o bot'}`}
                        >
                          <Lock className="h-2.5 w-2.5 shrink-0" />
                          {r.time ? `${r.time} ` : 'Dia '}
                          Reservado
                        </span>
                      ))}
                      {dayReservations.length > 2 && (
                        <span className="text-[9px] text-slate-400 px-1">
                          +{dayReservations.length - 2} reservas
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Painel do dia selecionado */}
        <Card className="border-slate-200 shadow-xs xl:sticky xl:top-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-blue-600" />
              Dia selecionado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800">
                  {(() => {
                    const [y, m, d] = selected.split('-').map(Number)
                    return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
                      weekday: 'long',
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })
                  })()}
                </p>
                {selectedHoliday && (
                  <p className="text-xs text-pink-600 flex items-center gap-1 mt-0.5">
                    <Cake className="h-3 w-3" /> {selectedHoliday}
                  </p>
                )}
              </div>
            </div>

            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <>
                {/* Ordens do dia */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Ordens de serviço ({selectedOrders.length})
                  </p>
                  {selectedOrders.length === 0 ? (
                    <p className="text-xs text-slate-400">Nenhuma OS agendada neste dia.</p>
                  ) : (
                    selectedOrders.map((order) => (
                      <button
                        key={order.id}
                        type="button"
                        onClick={() => openOrder(order)}
                        className={cn(
                          'w-full text-left rounded-lg border p-3 transition-colors cursor-pointer',
                          statusBlockClasses[order.status],
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold">
                            {agendamentoHora(order) || '—'} · {order.number || 'OS'}
                          </span>
                          <Badge className="text-[10px] px-1.5 py-0 bg-white/70 border-0">
                            {statusLabelOf(order)}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium mt-1 truncate">
                          {order.client_name || 'Cliente'}
                        </p>
                        <p className="text-[11px] flex items-center gap-1 mt-0.5 opacity-80">
                          <Wrench className="h-3 w-3 shrink-0" />
                          {technicianName(order.technician_id)}
                        </p>
                        {order.client_address && (
                          <p className="text-[11px] flex items-center gap-1 mt-0.5 opacity-70 truncate">
                            <MapPin className="h-3 w-3 shrink-0" /> {order.client_address}
                          </p>
                        )}
                        {order.client_phone && (
                          <p className="text-[11px] flex items-center gap-1 mt-0.5 opacity-70">
                            <Phone className="h-3 w-3 shrink-0" /> {order.client_phone}
                          </p>
                        )}
                      </button>
                    ))
                  )}
                </div>

                {/* Reservas do dia */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Reservas de agenda ({selectedReservations.length})
                  </p>
                  {selectedReservations.length === 0 ? (
                    <p className="text-xs text-slate-400">Nenhuma reserva neste dia.</p>
                  ) : (
                    selectedReservations.map((r) => (
                      <div
                        key={r.id}
                        className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 flex items-start gap-2"
                      >
                        <Lock className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-600">
                            {r.time ? `Horário ${r.time} bloqueado` : 'Dia inteiro bloqueado'}
                          </p>
                          {r.reason && (
                            <p className="text-[11px] text-slate-400 truncate">{r.reason}</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
