import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CreditCard, Copy, RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { stripeBillingService, type StripeStatusResult } from '@/services/stripe'

/**
 * Card "Cobranças (Stripe)" em Configurações.
 * Mostra o status da integração (conta Stripe do builder nos Conectores),
 * a URL do webhook para copiar no painel do Stripe e explica Pix/boleto/cartão.
 */
export default function StripeBillingCard() {
  const [status, setStatus] = useState<StripeStatusResult | null>(null)
  const [loading, setLoading] = useState(true)

  const loadStatus = async () => {
    setLoading(true)
    try {
      const res = await stripeBillingService.status()
      setStatus(res)
    } catch {
      setStatus({ ok: false, detail: 'Falha ao consultar o backend.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const copyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(stripeBillingService.webhookUrl)
      toast({ title: 'Copiado!', description: 'URL do webhook copiada.' })
    } catch {
      toast({
        title: 'Não foi possível copiar',
        description: stripeBillingService.webhookUrl,
      })
    }
  }

  const connected = status?.connected === true

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-indigo-600" /> Cobranças (Stripe)
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={loadStatus}
            title="Atualizar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {loading ? (
            <Badge variant="secondary">Verificando…</Badge>
          ) : connected ? (
            <Badge className="bg-emerald-100 text-emerald-800 border-0 gap-1">
              <CheckCircle className="h-3 w-3" /> Conectado{status?.mode ? ` (${status.mode})` : ''}
            </Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-800 border-0 gap-1">
              <XCircle className="h-3 w-3" /> Não conectado
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-600">
        <p>
          Gere links de pagamento Stripe nas <strong>contas a receber</strong> do Financeiro (botão
          “Cobrar”) e envie o link ao cliente pelo WhatsApp do CRM. O cliente pode pagar com{' '}
          <strong>Pix</strong>, <strong>boleto</strong> ou <strong>cartão</strong> direto no link.
          Quando o pagamento cai, a conta é marcada como PAGA e o valor entra no Caixa
          automaticamente.
        </p>

        <div>
          <p className="font-medium text-slate-700 mb-1">Passo 1 — Conectar a conta Stripe</p>
          <p className="text-xs">
            Abra <strong>Conectores</strong> (canto inferior da barra lateral) e conecte o conector{' '}
            <strong>Stripe</strong> com a conta que vai receber os pagamentos.
          </p>
        </div>

        <div>
          <p className="font-medium text-slate-700 mb-1">
            Passo 2 — Registrar a URL do webhook no painel do Stripe
          </p>
          <p className="text-xs mb-2">
            No painel Stripe: <em>Developers → Webhooks → Add endpoint</em>, cole a URL abaixo e
            selecione o evento <code className="text-[11px]">checkout.session.completed</code>. É
            ela que marca a conta como paga e lança no caixa.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] bg-slate-100 rounded px-2 py-1.5 break-all select-all">
              {stripeBillingService.webhookUrl}
            </code>
            <Button size="sm" variant="outline" onClick={copyWebhookUrl}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
            </Button>
          </div>
        </div>

        {status?.detail && !connected && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1.5">{status.detail}</p>
        )}
      </CardContent>
    </Card>
  )
}
