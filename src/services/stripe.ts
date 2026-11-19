import { pb } from '@/lib/pocketbase/client'

/**
 * Serviço de cobranças Stripe do CRM.
 *
 * As cobranças são criadas na CONTA STRIPE DO BUILDER via conector Skip
 * (executeAsOwner dentro do hook stripe.pb.js). O link de pagamento é enviado
 * ao cliente pelo WhatsApp do CRM (Meta primária, conector Skip como fallback).
 */

const WEBHOOK_URL =
  'https://app-crm-completo-7ca4b.shrd01.internal.goskip.dev/backend/v1/stripe/webhook'

export interface StripeChargeResult {
  ok: boolean
  payment_url?: string
  whatsapp_sent?: boolean
  whatsapp_detail?: string
  invoice_id?: string
  payment_intent_id?: string
  checkout_session_id?: string
  error?: string
}

export interface StripeStatusResult {
  ok: boolean
  connected?: boolean
  mode?: 'test' | 'live' | ''
  detail?: string
}

export const stripeBillingService = {
  webhookUrl: WEBHOOK_URL,

  /** Cria o link de pagamento na conta Stripe e envia o link por WhatsApp. */
  async cobrar(invoiceId: string): Promise<StripeChargeResult> {
    return pb.send('/backend/v1/stripe/charge', {
      method: 'POST',
      body: { invoice_id: invoiceId },
    })
  },

  /** Status da integração (conta Stripe conectada nos Conectores?). */
  async status(): Promise<StripeStatusResult> {
    return pb.send('/backend/v1/stripe/status', {
      method: 'GET',
      query: { t: String(Date.now()) },
    })
  },

  /** Consulta o estado atual da sessão de checkout (usado ao reabrir a tela). */
  async sessionStatus(checkoutSessionId: string): Promise<StripeChargeResult> {
    return pb.send('/backend/v1/stripe/checkout-status', {
      method: 'GET',
      query: { session: checkoutSessionId },
    })
  },
}
