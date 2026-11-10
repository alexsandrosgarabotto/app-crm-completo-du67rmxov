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

// ================= ESTOQUE =================
export interface Product {
  id: string
  name: string
  sku?: string
  description?: string
  category?: string
  unit?: string // UN, KG, CX, PC, M
  sale_price?: number
  cost_price?: number
  stock_quantity?: number
  min_stock?: number
  active?: boolean
  created_by?: string
  created: string
  updated: string
}

export type StockMovementType = 'entry' | 'exit' | 'adjustment'

export interface StockMovement {
  id: string
  product_id: string
  type: StockMovementType
  quantity: number
  reason?: string
  deal_id?: string
  date?: string // YYYY-MM-DD
  user_id?: string
  created: string
  updated: string
  expand?: {
    product_id?: Product
    deal_id?: Deal
    user_id?: User
  }
}

// ================= SERVIÇOS =================
export interface Service {
  id: string
  name: string
  description?: string
  price?: number
  duration_minutes?: number
  category?: string
  iss_rate?: number
  active?: boolean
  created_by?: string
  created: string
  updated: string
}

// ================= ITENS DA VENDA =================
export type DealItemType = 'product' | 'service'

export interface DealItem {
  id: string
  deal_id: string
  item_type: DealItemType
  product_id?: string
  service_id?: string
  name_snapshot: string
  quantity: number
  unit_price: number
  total_price: number
  created: string
  updated: string
  expand?: {
    product_id?: Product
    service_id?: Service
  }
}

// ================= MÓDULO FISCAL (NF-e / NFS-e) =================
export type FiscalDocType = 'NFE' | 'NFSE'
export type FiscalDocStatus =
  | 'pending'
  | 'to_transmit'
  | 'transmitted'
  | 'authorized'
  | 'rejected'
  | 'cancelled'

export interface FiscalDocument {
  id: string
  doc_type: FiscalDocType
  deal_id?: string
  client_id?: string
  nature_operation?: string
  total_amount: number
  status: FiscalDocStatus
  number?: string
  series?: string
  access_key?: string
  provider_message?: string
  issue_date?: string // YYYY-MM-DD
  xml_payload?: string
  created_by?: string
  created: string
  updated: string
  expand?: {
    deal_id?: Deal
    client_id?: Client
    created_by?: User
  }
}

export type FiscalProvider = 'focus_nfe' | 'nfe_io' | 'plugnotas' | 'custom'
export type FiscalEnvironment = 'homologation' | 'production'
export type TaxRegime = 'simples_nacional' | 'lucro_presumido' | 'lucro_real' | 'mei'

export interface FiscalSettings {
  id: string
  provider?: FiscalProvider
  api_token?: string
  environment?: FiscalEnvironment
  nfe_series?: string
  nfse_series?: string
  cnpj?: string
  state_registration?: string
  municipal_registration?: string
  tax_regime?: TaxRegime
  certificate_info?: string
  created: string
  updated: string
}

// ================= CUSTOS FIXOS MENSAIS =================
export type FixedCostCategory =
  | 'salarios'
  | 'aluguel'
  | 'energia'
  | 'agua'
  | 'internet'
  | 'telefone'
  | 'marketing'
  | 'contabilidade'
  | 'outros'

export interface FixedCost {
  id: string
  name: string
  category: FixedCostCategory
  amount: number
  due_day?: number
  active: boolean
  notes?: string
  created_by?: string
  created: string
  updated: string
  expand?: {
    created_by?: User
  }
}

// ================= ATENDIMENTOS WHATSAPP =================
export type WhatsAppConversationStatus = 'aberto' | 'em_atendimento' | 'finalizado'
export type WhatsAppMessageDirection = 'inbound' | 'outbound'
export type WhatsAppMessageOrigin = 'auto' | 'manual'

export interface WhatsAppConversation {
  id: string
  client_id: string
  contact_name?: string
  phone: string
  status: WhatsAppConversationStatus
  assigned_to?: string
  last_message?: string
  last_message_at?: string
  last_inbound_at?: string
  unread_count?: number
  created: string
  updated: string
  expand?: {
    client_id?: Client
    assigned_to?: User
  }
}

export interface WhatsAppMessage {
  id: string
  conversation_id: string
  direction: WhatsAppMessageDirection
  origin: WhatsAppMessageOrigin
  body: string
  external_id?: string
  sent_by?: string
  created: string
  updated: string
  expand?: {
    sent_by?: User
  }
}

// ================= ORDENS DE SERVIÇO =================
export type ServiceOrderStatus =
  | 'aberta'
  | 'em_andamento'
  | 'aguardando_peca'
  | 'finalizada'
  | 'cancelada'

export interface ServiceOrderItem {
  item_type: 'product' | 'service'
  product_id?: string
  service_id?: string
  name_snapshot: string
  quantity: number
  unit_price: number
  total_price: number
}

export interface ServiceOrderStatusChange {
  de?: string
  para: string
  por?: string
  por_nome?: string
  quando: string
  /** 'enviado' ou o motivo pelo qual o aviso não saiu (ex.: 'não enviado', 'Modo validação'). */
  aviso_whatsapp?: string
}

export interface ServiceOrder {
  id: string
  number: string
  client_id: string
  conversation_id?: string
  status: ServiceOrderStatus
  opened_at?: string
  finished_at?: string
  responsible_id?: string
  problem_description?: string
  notes?: string
  items: ServiceOrderItem[]
  total_value?: number
  invoice_id?: string
  stock_released?: boolean
  created_by?: string
  agendamento_para?: string
  historico?: ServiceOrderStatusChange[]
  created: string
  updated: string
  expand?: {
    client_id?: Client
    responsible_id?: User
    created_by?: User
  }
}

export type WhatsAppTemplateKey = 'greeting' | 'menu'
// Configurações de WhatsApp guardadas na mesma coleção de mensagens automáticas
export type WhatsAppSettingKey =
  | 'phone_number_id'
  | 'meta_access_token'
  | 'validacao_apenas'
  | 'validacao_numero'
export type WhatsAppStoredKey = WhatsAppTemplateKey | WhatsAppSettingKey

export interface WhatsAppTemplate {
  id: string
  key: WhatsAppStoredKey
  body: string
  active?: boolean
  updated_by?: string
  created: string
  updated: string
  expand?: {
    updated_by?: User
  }
}

// ================= CONTROLE DE CAIXA =================
export type CashMovementType = 'entry' | 'exit'
export type CashPaymentMethod =
  | 'dinheiro'
  | 'pix'
  | 'cartao'
  | 'transferencia'
  | 'boleto'
  | 'outros'

export interface CashMovement {
  id: string
  date: string // YYYY-MM-DD
  type: CashMovementType
  description: string
  category?: string
  amount: number
  payment_method: CashPaymentMethod
  invoice_id?: string
  created_by?: string
  notes?: string
  created: string
  updated: string
  expand?: {
    invoice_id?: Invoice
    created_by?: User
  }
}
