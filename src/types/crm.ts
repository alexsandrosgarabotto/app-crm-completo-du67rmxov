export type UserRole = 'owner' | 'seller'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  phone?: string
  avatar?: string
  created: string
  updated: string
}

export type ClientStatus = 'lead' | 'active' | 'inactive'

export interface Client {
  id: string
  name: string
  email?: string
  phone?: string
  document?: string
  company?: string
  address?: string
  city?: string
  state?: string
  notes?: string
  status: ClientStatus
  assigned_to?: string
  created_by?: string
  created: string
  updated: string
  expand?: {
    assigned_to?: User
    created_by?: User
  }
}

export type DealStage = 'lead' | 'in_progress' | 'won' | 'lost'

export interface Deal {
  id: string
  title: string
  client_id: string
  value: number
  stage: DealStage
  expected_close_date?: string
  closed_date?: string
  user_id?: string
  created_by?: string
  notes?: string
  created: string
  updated: string
  expand?: {
    client_id?: Client
    user_id?: User
    created_by?: User
  }
}

export type TaskPriority = 'low' | 'medium' | 'high'
export type TaskStatus = 'pending' | 'completed' | 'cancelled'

export interface Task {
  id: string
  title: string
  description?: string
  due_date: string // YYYY-MM-DD
  due_time?: string // HH:MM
  client_id?: string
  deal_id?: string
  user_id?: string
  created_by?: string
  priority: TaskPriority
  status: TaskStatus
  created: string
  updated: string
  expand?: {
    client_id?: Client
    deal_id?: Deal
    user_id?: User
  }
}

export type InvoiceType = 'receivable' | 'payable'
export type InvoiceStatus = 'pending' | 'paid' | 'cancelled'

export interface Invoice {
  id: string
  description: string
  type: InvoiceType
  amount: number
  status: InvoiceStatus
  due_date: string // YYYY-MM-DD
  paid_date?: string
  client_id?: string
  deal_id?: string
  category?: string
  created_by?: string
  notes?: string
  created: string
  updated: string
  expand?: {
    client_id?: Client
    deal_id?: Deal
  }
}

export interface CompanySettings {
  id: string
  name: string
  trade_name?: string
  document?: string
  email?: string
  phone?: string
  address?: string
  currency?: string
  website?: string
  created: string
  updated: string
}
