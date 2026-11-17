import type { ServiceOrder, ScheduleReservation } from '@/types/crm'
import { serviceOrderStatusLabels } from '@/services/serviceOrders'

/** Mesmas cores dos badges da tela de Ordens de Serviço, no formato de bloco do calendário. */
export const statusBlockClasses: Record<ServiceOrder['status'], string> = {
  aberta: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200/80',
  em_andamento: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200/80',
  aguardando_peca: 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200/80',
  finalizada: 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200/80',
  cancelada: 'bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-200/80 line-through',
}

export const statusDotClasses: Record<ServiceOrder['status'], string> = {
  aberta: 'bg-blue-500',
  em_andamento: 'bg-amber-500',
  aguardando_peca: 'bg-purple-500',
  finalizada: 'bg-emerald-500',
  cancelada: 'bg-rose-500',
}

/** Data (local) em YYYY-MM-DD sem shift de fuso. */
export function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

/** YYYY-MM-DD → "dd/mm" para blocos compactos. */
export function shortDate(key: string): string {
  const [, m, d] = key.split('-')
  return `${d}/${m}`
}

/** Hora (HH:mm) do agendamento da OS, '' quando não tem. */
export function agendamentoHora(order: ServiceOrder): string {
  if (!order.agendamento_para) return ''
  const d = new Date(order.agendamento_para)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Agrupa por dia (YYYY-MM-DD) as OS com agendamento_para (não agendada não aparece). */
export function groupOrdersByDay(orders: ServiceOrder[]): Map<string, ServiceOrder[]> {
  const map = new Map<string, ServiceOrder[]>()
  for (const order of orders) {
    if (!order.agendamento_para) continue
    const key = toKey(new Date(order.agendamento_para))
    const list = map.get(key) || []
    list.push(order)
    map.set(key, list)
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.agendamento_para || '').localeCompare(b.agendamento_para || ''))
  }
  return map
}

/** Agrupa reservas por dia; dia inteiro (sem time) entra no grupo do dia. */
export function groupReservationsByDay(
  reservations: ScheduleReservation[],
): Map<string, ScheduleReservation[]> {
  const map = new Map<string, ScheduleReservation[]>()
  for (const r of reservations) {
    const key = (r.date || '').slice(0, 10)
    if (!key) continue
    const list = map.get(key) || []
    list.push(r)
    map.set(key, list)
  }
  return map
}

/** Agrupa feriados por dia (YYYY-MM-DD → nome). */
export function mapHolidaysByDay(holidays: { date: string; name?: string }[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const h of holidays) {
    const key = (h.date || '').slice(0, 10)
    if (key) map.set(key, h.name || 'Feriado')
  }
  return map
}

export function statusLabelOf(order: ServiceOrder): string {
  return serviceOrderStatusLabels[order.status] || order.status
}
