import pb from '@/lib/pocketbase/client'
import type { Task, TaskStatus } from '@/types/crm'

export const tasksService = {
  async getAll(): Promise<Task[]> {
    return await pb.collection('tasks').getFullList<Task>({
      sort: 'due_date,due_time',
      expand: 'client_id,deal_id,user_id',
    })
  },

  async getById(id: string): Promise<Task> {
    return await pb.collection('tasks').getOne<Task>(id, {
      expand: 'client_id,deal_id,user_id',
    })
  },

  async create(data: Partial<Task>): Promise<Task> {
    return await pb.collection('tasks').create<Task>(data, {
      expand: 'client_id,deal_id,user_id',
    })
  },

  async update(id: string, data: Partial<Task>): Promise<Task> {
    return await pb.collection('tasks').update<Task>(id, data, {
      expand: 'client_id,deal_id,user_id',
    })
  },

  async updateStatus(id: string, status: TaskStatus): Promise<Task> {
    return await pb.collection('tasks').update<Task>(
      id,
      { status },
      {
        expand: 'client_id,deal_id,user_id',
      },
    )
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('tasks').delete(id)
  },
}
