import { jsPDF } from 'jspdf'

const brl = (n: number) => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface PdfClient {
  name?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  document?: string
}

interface PdfItem {
  item_type: 'product' | 'service'
  name_snapshot: string
  quantity: number
  unit_price: number
  total_price: number
}

export interface ServiceOrderPdfData {
  number?: string
  status?: string
  statusLabel?: string
  openedAt?: string
  agendamento?: string
  problemDescription?: string
  client: PdfClient
  technicianName?: string
  items: PdfItem[]
  total?: number
  company?: { name?: string; phone?: string; address?: string }
}

const MARGIN = 40
const PAGE_W = 595.28 // A4 em pt

/**
 * Monta o PDF da ordem de serviço (jsPDF, A4, sem dependências de fonte —
 * texto latin-1 com acentos funciona nas fontes padrão do jsPDF).
 */
export function buildServiceOrderPdf(data: ServiceOrderPdfData): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const y0 = MARGIN

  // Cabeçalho
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('ORDEM DE SERVIÇO', MARGIN, y0 + 16)
  doc.setFontSize(11)
  doc.text(data.number || '—', PAGE_W - MARGIN, y0 + 16, { align: 'right' })

  let y = y0 + 30
  doc.setDrawColor(200)
  doc.line(MARGIN, y, PAGE_W - MARGIN, y)
  y += 18

  const linha = (label: string, valor: string) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(label, MARGIN, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const linhas = doc.splitTextToSize(valor || '—', PAGE_W - MARGIN * 2 - 90) as string[]
    doc.text(linhas, MARGIN + 90, y)
    y += linhas.length * 13
  }

  const endereco = [data.client.address, data.client.city, data.client.state]
    .filter(Boolean)
    .join(' — ')

  if (data.company?.name) linha('Empresa', data.company.name)
  linha('Cliente', data.client.name || '—')
  if (data.client.phone) linha('Telefone', data.client.phone)
  if (endereco) linha('Endereço', endereco)
  if (data.client.document) linha('CPF/CNPJ', data.client.document)
  if (data.technicianName) linha('Técnico responsável', data.technicianName)
  if (data.openedAt) linha('Abertura', data.openedAt)
  if (data.agendamento) linha('Agendamento', data.agendamento)
  if (data.statusLabel) linha('Status', data.statusLabel)
  if (data.problemDescription) linha('Descrição do problema', data.problemDescription)

  y += 6
  doc.setDrawColor(200)
  doc.line(MARGIN, y, PAGE_W - MARGIN, y)
  y += 16

  // Itens
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('ITEM', MARGIN, y)
  doc.text('QTD', PAGE_W - MARGIN - 190, y, { align: 'right' })
  doc.text('VL. UN.', PAGE_W - MARGIN - 105, y, { align: 'right' })
  doc.text('TOTAL', PAGE_W - MARGIN, y, { align: 'right' })
  y += 4
  doc.setDrawColor(220)
  doc.line(MARGIN, y, PAGE_W - MARGIN, y)
  y += 12

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  for (const item of data.items || []) {
    if (y > 760) {
      doc.addPage()
      y = MARGIN
    }
    const nome = `${item.item_type === 'service' ? '[Serviço] ' : ''}${item.name_snapshot || '—'}`
    const linhasNome = doc.splitTextToSize(nome, PAGE_W - MARGIN * 2 - 200) as string[]
    doc.text(linhasNome, MARGIN, y)
    doc.text(String(item.quantity ?? 0), PAGE_W - MARGIN - 190, y, { align: 'right' })
    doc.text(brl(item.unit_price), PAGE_W - MARGIN - 105, y, { align: 'right' })
    doc.text(brl(item.total_price), PAGE_W - MARGIN, y, { align: 'right' })
    y += Math.max(linhasNome.length * 13, 13)
  }

  // Total
  y += 8
  doc.setDrawColor(200)
  doc.line(PAGE_W - MARGIN - 180, y, PAGE_W - MARGIN, y)
  y += 16
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('TOTAL', PAGE_W - MARGIN - 110, y, { align: 'right' })
  doc.text(brl(data.total ?? 0), PAGE_W - MARGIN, y, { align: 'right' })

  // Rodapé
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(120)
  doc.text(data.company?.phone ? `Dúvidas: ${data.company.phone}` : '', MARGIN, 812)
  return doc
}

/** Nome de arquivo seguro para a OS. */
export function serviceOrderPdfFilename(number?: string): string {
  const limpo = (number || 'OS').replace(/[^\w-]+/g, '_')
  return `${limpo}.pdf`
}
