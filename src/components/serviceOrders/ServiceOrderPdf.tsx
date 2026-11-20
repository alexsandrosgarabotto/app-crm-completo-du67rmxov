import { useState } from 'react'
import { FileText, Loader2, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildServiceOrderPdf, serviceOrderPdfFilename, type ServiceOrderPdfData } from './pdf'
import { toast } from '@/hooks/use-toast'
import { serviceOrderStatusLabels } from '@/services/serviceOrders'
import type { ServiceOrder, ServiceOrderStatus } from '@/types/crm'

interface ServiceOrderPdfButtonProps {
  order: ServiceOrder
  clientName?: string
  clientPhone?: string
  clientAddress?: string
  clientCity?: string
  clientState?: string
  clientDocument?: string
  technicianName?: string
  /** Classe extra (o pai controla o layout do botão). */
  className?: string
  label?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'icon'
}

/**
 * Botão "Gerar PDF" da OS: monta um PDF (jsPDF) com número, cliente
 * (endereço/telefone), técnico responsável, agendamento, itens de material
 * e serviço com valores e total — e oferece compartilhar (navigator.share
 * com arquivo, quando o celular suporta) ou baixar (fallback).
 */
export function ServiceOrderPdfButton({
  order,
  clientName,
  clientPhone,
  clientAddress,
  clientCity,
  clientState,
  clientDocument,
  technicianName,
  className,
  label = 'Gerar PDF',
  variant = 'outline',
  size = 'sm',
}: ServiceOrderPdfButtonProps) {
  const [busy, setBusy] = useState(false)

  const data = (): ServiceOrderPdfData => {
    const ag = order.agendamento_para ? new Date(order.agendamento_para) : null
    const agendamento =
      ag && !isNaN(ag.getTime())
        ? ag.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : undefined
    return {
      number: order.number,
      status: order.status,
      statusLabel: serviceOrderStatusLabels[order.status as ServiceOrderStatus],
      openedAt: (order.opened_at || order.created || '')
        .slice(0, 10)
        .split('-')
        .reverse()
        .join('/'),
      agendamento,
      problemDescription: order.problem_description || undefined,
      client: {
        name: clientName,
        phone: clientPhone,
        address: clientAddress,
        city: clientCity,
        state: clientState,
        document: clientDocument,
      },
      technicianName,
      items: (order.items || []).map((i) => ({
        item_type: i.item_type,
        name_snapshot: i.name_snapshot,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total_price: i.total_price,
      })),
      total: order.total_value,
    }
  }

  const gerar = async () => {
    setBusy(true)
    try {
      const doc = buildServiceOrderPdf(data())
      const filename = serviceOrderPdfFilename(order.number)
      const blob = doc.output('blob')
      const file = new File([blob], filename, { type: 'application/pdf' })

      // Compartilhar nativo (celular / PWA): permite mandar direto no WhatsApp.
      const nav = navigator as Navigator & {
        canShare?: (d: { files?: File[] }) => boolean
      }
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({
          files: [file],
          title: `Ordem de Serviço ${order.number || ''}`.trim(),
          text: `Ordem de Serviço ${order.number || ''}`.trim(),
        })
        return
      }

      // Fallback: download direto.
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast({
        title: 'PDF baixado',
        description: 'Envie o arquivo ao cliente pelo WhatsApp ou outro canal.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar o PDF',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={() => void gerar()}
      disabled={busy}
      title="Gerar o PDF da OS para enviar ao cliente"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
      {size !== 'icon' && <span className="ml-1.5">{label}</span>}
      {size === 'icon' && <Share2 className="hidden" />}
    </Button>
  )
}
