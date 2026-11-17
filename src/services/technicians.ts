import pb from '@/lib/pocketbase/client'
import type { Technician, ScheduleReservation } from '@/types/crm'

export const techniciansService = {
  async list(activeOnly = false): Promise<Technician[]> {
    const filter = activeOnly ? 'active = true' : ''
    return await pb
      .collection('technicians')
      .getList<Technician>(1, 200, { filter, sort: 'created' })
      .then((r) => r.items)
  },
  async create(data: { name: string; phone?: string; active?: boolean }): Promise<Technician> {
    return await pb.collection('technicians').create<Technician>(data)
  },
  async update(
    id: string,
    data: Partial<{ name: string; phone: string; active: boolean }>,
  ): Promise<Technician> {
    return await pb.collection('technicians').update<Technician>(id, data)
  },
  async remove(id: string): Promise<void> {
    await pb.collection('technicians').delete(id)
  },
}

export const scheduleReservationsService = {
  async list(): Promise<ScheduleReservation[]> {
    return await pb
      .collection('schedule_reservations')
      .getList<ScheduleReservation>(1, 200, { sort: 'date' })
      .then((r) => r.items)
  },
  async create(data: {
    date: string
    time?: string
    reason?: string
  }): Promise<ScheduleReservation> {
    return await pb.collection('schedule_reservations').create<ScheduleReservation>(data)
  },
  async remove(id: string): Promise<void> {
    await pb.collection('schedule_reservations').delete(id)
  },
}
