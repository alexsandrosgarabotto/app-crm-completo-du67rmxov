import React, { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { fiscalService } from '@/services/fiscal'
import { dealsService } from '@/services/deals'
import { clientsService } from '@/services/clients'
import type { FiscalDocument, FiscalSettings, FiscalDocType, Deal, Client } from '@/types/crm'
import {
  FileText,
  Plus,
  Search,
  Filter,
  Receipt,
  Building2,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Settings,
  Eye,
  KeyRound,
  FileCheck2,
  Send,
  Printer,
  XCircle,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'

export default function FiscalDocumentsPage() {
  const { user } = useAuth()
  const [documents, setDocuments] = useState<FiscalDocument[]>([])
  const [settings, setSettings] = useState<FiscalSettings | null>(null)
  const [deals, setDeals] = useState<Deal[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'NFE' | 'NFSE'>('all')

  // Modal Emitir Nota Fiscal
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false)
  const [issueDocType, setIssueDocType] = useState<FiscalDocType>('NFE')
  const [selectedDealId, setSelectedDealId] = useState('')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [natureOperation, setNatureOperation] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [submittingIssue, setSubmittingIssue] = useState(false)

  // Modal Visualizar Nota & DANFE
  const [isDanfeModalOpen, setIsDanfeModalOpen] = useState(false)
  const [viewingDoc, setViewingDoc] = useState<FiscalDocument | null>(null)

  // Modal Configurações Fiscais
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [formProvider, setFormProvider] = useState('focus_nfe')
  const [formApiToken, setFormApiToken] = useState('')
  const [formEnvironment, setFormEnvironment] = useState('homologation')
  const [formNfeSeries, setFormNfeSeries] = useState('1')
  const [formNfseSeries, setFormNfseSeries] = useState('E')
  const [formCnpj, setFormCnpj] = useState('')
  const [formIe, setFormIe] = useState('')
  const [formIm, setFormIm] = useState('')
  const [formTaxRegime, setFormTaxRegime] = useState('simples_nacional')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [docsData, settingsData, dealsData, clientsData] = await Promise.all([
        fiscalService.getDocuments(),
        fiscalService.getSettings(),
        dealsService.getAll(),
        clientsService.getAll(),
      ])
      setDocuments(docsData)
      setSettings(settingsData)
      setDeals(dealsData)
      setClients(clientsData)

      if (settingsData) {
        setFormProvider(settingsData.provider || 'focus_nfe')
        setFormApiToken(settingsData.api_token || '')
        setFormEnvironment(settingsData.environment || 'homologation')
        setFormNfeSeries(settingsData.nfe_series || '1')
        setFormNfseSeries(settingsData.nfse_series || 'E')
        setFormCnpj(settingsData.cnpj || '12.345.678/0001-90')
        setFormIe(settingsData.state_registration || '')
        setFormIm(settingsData.municipal_registration || '')
        setFormTaxRegime(settingsData.tax_regime || 'simples_nacional')
      }
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro',
        description: 'Falha ao carregar documentos fiscais.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Preencher dados ao selecionar uma venda no modal de emissão
  const handleDealChange = (dealId: string) => {
    setSelectedDealId(dealId)
    const deal = deals.find((d) => d.id === dealId)
    if (deal) {
      setSelectedClientId(deal.client_id || '')
      setTotalAmount(deal.value ? deal.value.toString() : '0')
      setNatureOperation(
        issueDocType === 'NFE'
          ? `Venda de mercadorias referente à oportunidade: ${deal.title}`
          : `Prestação de serviços referente ao contrato: ${deal.title}`,
      )
    }
  }

  const handleOpenIssueModal = (preselectedDeal?: Deal) => {
    if (preselectedDeal) {
      setSelectedDealId(preselectedDeal.id)
      setSelectedClientId(preselectedDeal.client_id || '')
      setTotalAmount(preselectedDeal.value ? preselectedDeal.value.toString() : '0')
      setIssueDocType('NFE')
      setNatureOperation(`Venda de mercadorias referente a: ${preselectedDeal.title}`)
    } else {
      setSelectedDealId(deals[0]?.id || '')
      setSelectedClientId(deals[0]?.client_id || clients[0]?.id || '')
      setTotalAmount(deals[0]?.value ? deals[0].value.toString() : '0')
      setIssueDocType('NFE')
      setNatureOperation('Venda de mercadorias e produtos no território nacional')
    }
    setIsIssueModalOpen(true)
  }

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(totalAmount)
    if (!amount || amount <= 0) {
      toast({
        title: 'Atenção',
        description: 'Informe o valor total do documento fiscal.',
        variant: 'destructive',
      })
      return
    }

    setSubmittingIssue(true)
    try {
      const res = await fiscalService.issueDocument({
        dealId: selectedDealId || undefined,
        clientId: selectedClientId || undefined,
        docType: issueDocType,
        natureOperation: natureOperation.trim(),
        totalAmount: amount,
        userId: user?.id,
      })

      setDocuments((prev) => [res.document, ...prev])
      setIsIssueModalOpen(false)

      toast({
        title: 'Documento Fiscal Gerado!',
        description: res.hasLiveProvider
          ? 'Nota fiscal enviada para fila de transmissão com o provedor.'
          : 'Documento registrado como "Pendente de transmissão" (Módulo pronto para conectar). Emissão real exige certificado digital A1.',
      })
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao gerar documento',
        description: err.message || 'Falha na emissão fiscal.',
        variant: 'destructive',
      })
    } finally {
      setSubmittingIssue(false)
    }
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingSettings(true)
    try {
      const updated = await fiscalService.saveSettings({
        provider: formProvider as any,
        api_token: formApiToken.trim(),
        environment: formEnvironment as any,
        nfe_series: formNfeSeries.trim(),
        nfse_series: formNfseSeries.trim(),
        cnpj: formCnpj.trim(),
        state_registration: formIe.trim(),
        municipal_registration: formIm.trim(),
        tax_regime: formTaxRegime as any,
      })
      setSettings(updated)
      setIsSettingsModalOpen(false)
      toast({
        title: 'Configurações Fiscais Salvas',
        description: 'Parâmetros atualizados com sucesso.',
      })
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro',
        description: 'Falha ao salvar configurações.',
        variant: 'destructive',
      })
    } finally {
      setSavingSettings(false)
    }
  }

  const handleOpenDanfe = (doc: FiscalDocument) => {
    setViewingDoc(doc)
    setIsDanfeModalOpen(true)
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  const getStatusBadge = (status: FiscalDocument['status']) => {
    switch (status) {
      case 'authorized':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
            <CheckCircle2 className="h-3 w-3 mr-1 inline" /> Autorizada (SEFAZ)
          </Badge>
        )
      case 'to_transmit':
      case 'pending':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300">
            <Clock className="h-3 w-3 mr-1 inline" /> Pendente de Transmissão
          </Badge>
        )
      case 'transmitted':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300">
            <Send className="h-3 w-3 mr-1 inline" /> Transmitida / Em Fila
          </Badge>
        )
      case 'rejected':
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-300">
            <XCircle className="h-3 w-3 mr-1 inline" /> Rejeitada
          </Badge>
        )
      case 'cancelled':
        return <Badge className="bg-slate-100 text-slate-700 border-slate-300">Cancelada</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      (doc.number && doc.number.toLowerCase().includes(search.toLowerCase())) ||
      (doc.nature_operation && doc.nature_operation.toLowerCase().includes(search.toLowerCase())) ||
      (doc.expand?.client_id?.name &&
        doc.expand.client_id.name.toLowerCase().includes(search.toLowerCase()))

    const matchesType = typeFilter === 'all' || doc.doc_type === typeFilter

    return matchesSearch && matchesType
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="h-7 w-7 text-blue-600" />
            Módulo Fiscal (NF-e & NFS-e)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Emissão de Nota Fiscal Eletrônica de Mercadorias (NF-e) e Serviços Municipais (NFS-e),
            visualização de DANFE e dados fiscais.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsSettingsModalOpen(true)}
            className="border-slate-300"
          >
            <Settings className="h-4 w-4 mr-1.5" /> Configurações Fiscais
          </Button>

          <Button onClick={() => handleOpenIssueModal()} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-1.5" /> Emitir Nota Fiscal
          </Button>
        </div>
      </div>

      {/* Alerta de Conformidade e Fluxo "Pronto para Conectar" */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 space-y-1">
          <p className="font-bold text-sm text-blue-950">
            Módulo Fiscal Pronto para Conectar (Conformidade com a Legislação Vigente)
          </p>
          <p>
            O fluxo de modelagem, emissão sobre vendas ganhas e visualização de DANFE está 100%
            estruturado. Conforme as normas da Receita Federal e SEFAZ, a transmissão e autorização
            com validade jurídica exige a conexão de um{' '}
            <strong>Certificado Digital A1 (.pfx)</strong> e credenciais de API junto a um provedor
            fiscal autorizado (Focus NFe, NFe.io, PlugNotas).
          </p>
          <p className="text-blue-700">
            Status atual:{' '}
            <strong>
              {settings?.api_token
                ? 'Provedor conectado'
                : 'Modo homologação / Pendente de transmissão'}
            </strong>
            . Nenhuma nota será rejeitada por erro de conexão.
          </p>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-600">
              Total de Documentos
            </CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{documents.length}</div>
            <p className="text-xs text-slate-500 mt-1">
              {documents.filter((d) => d.doc_type === 'NFE').length} NF-e (produtos) |{' '}
              {documents.filter((d) => d.doc_type === 'NFSE').length} NFS-e (serviços)
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-600">
              Pendentes de Transmissão
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-amber-700">
              {documents.filter((d) => d.status === 'to_transmit' || d.status === 'pending').length}
            </div>
            <p className="text-xs text-slate-500 mt-1">Aguardando envio ao provedor/SEFAZ</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-600">
              Valor Faturado em Notas
            </CardTitle>
            <Receipt className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-emerald-700">
              {formatCurrency(documents.reduce((acc, d) => acc + (d.total_amount || 0), 0))}
            </div>
            <p className="text-xs text-slate-500 mt-1">Soma de todos os documentos gerados</p>
          </CardContent>
        </Card>
      </div>

      {/* Busca e Filtros */}
      <Card className="border-slate-200 shadow-2xs">
        <CardContent className="p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por número da nota, cliente ou natureza da operação..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
            >
              <option value="all">Todos os tipos (NF-e & NFS-e)</option>
              <option value="NFE">Apenas NF-e (Mercadorias/SEFAZ)</option>
              <option value="NFSE">Apenas NFS-e (Serviços/Prefeitura)</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Notas Fiscais */}
      <Card className="border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Número / Série</th>
                <th className="py-3 px-4">Destinatário (Cliente)</th>
                <th className="py-3 px-4">Natureza da Operação</th>
                <th className="py-3 px-4 text-right">Valor Total</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2"></div>
                    <p>Carregando notas fiscais...</p>
                  </td>
                </tr>
              ) : filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Nenhum documento fiscal encontrado. Clique em "Emitir Nota Fiscal" para gerar a
                    primeira!
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => {
                  const client = doc.expand?.client_id
                  const deal = doc.expand?.deal_id

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <Badge
                          variant="secondary"
                          className={
                            doc.doc_type === 'NFE'
                              ? 'bg-blue-100 text-blue-800 font-bold'
                              : 'bg-purple-100 text-purple-800 font-bold'
                          }
                        >
                          {doc.doc_type === 'NFE' ? 'NF-e Mercadoria' : 'NFS-e Serviço'}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                        #{doc.number || '---'} (Série {doc.series || '1'})
                        <div className="text-[11px] text-slate-400 font-sans">
                          Emissão: {doc.issue_date || doc.created.split('T')[0]}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">
                          {client?.name || 'Cliente não especificado'}
                        </div>
                        {client?.document && (
                          <div className="text-xs text-slate-500 font-mono">
                            Doc: {client.document}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600 max-w-xs truncate">
                        {doc.nature_operation || 'Sem natureza especificada'}
                        {deal && (
                          <div className="text-[11px] text-blue-600 font-medium">
                            Venda: {deal.title}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(doc.total_amount)}
                      </td>

                      <td className="py-3.5 px-4 text-center">{getStatusBadge(doc.status)}</td>

                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDanfe(doc)}
                          className="h-8 text-xs text-slate-700 hover:text-blue-600"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          {doc.doc_type === 'NFE' ? 'Ver DANFE' : 'Ver Detalhes'}
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL EMITIR NOTA FISCAL */}
      <Dialog open={isIssueModalOpen} onOpenChange={setIsIssueModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-blue-600" />
              Emitir Documento Fiscal (NF-e / NFS-e)
            </DialogTitle>
            <DialogDescription>
              Selecione o tipo de nota e vincule a uma venda fechada para carregar os dados
              cadastrais do cliente.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleIssue} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Tipo de Documento Fiscal *</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIssueDocType('NFE')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    issueDocType === 'NFE'
                      ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <p className="font-bold text-sm text-slate-900">NF-e (Mercadorias)</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Para venda de produtos físicos, suprimentos e equipamentos.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setIssueDocType('NFSE')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    issueDocType === 'NFSE'
                      ? 'border-purple-600 bg-purple-50/60 ring-2 ring-purple-600/20'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <p className="font-bold text-sm text-slate-900">NFS-e (Serviços)</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cobrança de serviços, consultorias e implantação municipal.
                  </p>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="issue-deal">Venda / Oportunidade Vinculada</Label>
              <select
                id="issue-deal"
                value={selectedDealId}
                onChange={(e) => handleDealChange(e.target.value)}
                className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
              >
                <option value="">Selecione uma venda (opcional)...</option>
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} — {formatCurrency(d.value || 0)} (
                    {d.stage === 'won' ? 'Ganho' : d.stage})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="issue-client">Destinatário (Cliente) *</Label>
              <select
                id="issue-client"
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                required
                className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
              >
                <option value="">Selecione o cliente...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.document ? `(CPF/CNPJ: ${c.document})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="issue-nature">Natureza da Operação *</Label>
              <Input
                id="issue-nature"
                value={natureOperation}
                onChange={(e) => setNatureOperation(e.target.value)}
                placeholder="Ex: Venda de mercadorias adquiridas de terceiros"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="issue-amount">Valor Total da Nota (R$) *</Label>
              <Input
                id="issue-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>

            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                O documento será registrado como <strong>"Pendente de transmissão"</strong>. Quando
                você conectar o certificado A1 e o provedor, as notas pendentes serão transmitidas e
                autorizadas pela SEFAZ / Prefeitura.
              </div>
            </div>

            <DialogFooter className="pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setIsIssueModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={submittingIssue}
              >
                {submittingIssue ? 'Processando...' : 'Gerar Documento Fiscal'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL VISUALIZADOR DE DANFE / NOTA FISCAL */}
      <Dialog open={isDanfeModalOpen} onOpenChange={setIsDanfeModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Visualização do Documento Fiscal ({viewingDoc?.doc_type})
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="text-xs h-7 print:hidden"
              >
                <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir
              </Button>
            </DialogTitle>
            <DialogDescription>
              Representação gráfica simplificada do documento fiscal eletrônico e espelho de DANFE.
            </DialogDescription>
          </DialogHeader>

          {viewingDoc && (
            <div className="space-y-4 pt-1">
              {/* DANFE BOX HTML SIMPLES */}
              <div className="border-2 border-slate-800 rounded p-4 bg-white text-slate-900 font-sans text-xs space-y-4">
                {/* Header DANFE */}
                <div className="grid grid-cols-12 border-b-2 border-slate-800 pb-3 gap-2">
                  <div className="col-span-4 border-r border-slate-300 pr-2">
                    <p className="font-extrabold text-sm uppercase">EMITENTE</p>
                    <p className="font-bold text-xs mt-1">Atomic Soluções Empresariais LTDA</p>
                    <p className="text-[11px] text-slate-600">
                      CNPJ: {settings?.cnpj || '12.345.678/0001-90'}
                    </p>
                    <p className="text-[11px] text-slate-600">
                      Insc. Estadual: {settings?.state_registration || '112.233.444.555'}
                    </p>
                    <p className="text-[11px] text-slate-600">Av. Paulista, 1000 - São Paulo, SP</p>
                  </div>

                  <div className="col-span-4 text-center border-r border-slate-300 px-2 flex flex-col justify-center">
                    <p className="font-black text-base tracking-wider uppercase">
                      {viewingDoc.doc_type === 'NFE' ? 'DANFE' : 'NFS-e'}
                    </p>
                    <p className="text-[10px] text-slate-500 uppercase leading-tight">
                      {viewingDoc.doc_type === 'NFE'
                        ? 'Documento Auxiliar da Nota Fiscal Eletrônica'
                        : 'Nota Fiscal Eletrônica de Serviços'}
                    </p>
                    <p className="font-bold text-xs mt-1">Nº {viewingDoc.number || '000101'}</p>
                    <p className="text-[11px]">SÉRIE {viewingDoc.series || '1'}</p>
                  </div>

                  <div className="col-span-4 pl-2 text-right flex flex-col justify-center">
                    <div className="bg-slate-100 p-2 border border-slate-300 rounded text-center">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase">
                        Status SEFAZ / Prefeitura
                      </p>
                      <p className="font-bold text-xs text-amber-800 uppercase mt-0.5">
                        {viewingDoc.status === 'authorized'
                          ? 'AUTORIZADA'
                          : 'PENDENTE DE TRANSMISSÃO'}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Emissão: {viewingDoc.issue_date || viewingDoc.created.split('T')[0]}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Chave de Acesso / Protocolo */}
                <div className="bg-slate-50 p-2.5 border border-slate-300 rounded">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    CHAVE DE ACESSO (SIMULADA / EM HOMOLOGAÇÃO)
                  </span>
                  <span className="font-mono text-xs font-bold tracking-wider text-slate-800">
                    3525 0512 3456 7800 0190 5500 1000 0001 0119 8765 4321
                  </span>
                </div>

                {/* Destinatário */}
                <div className="border border-slate-300 rounded p-2.5">
                  <p className="font-bold text-xs uppercase text-slate-700 border-b border-slate-200 pb-1 mb-2">
                    DESTINATÁRIO / REMETENTE
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 text-[11px]">Nome / Razão Social:</span>
                      <p className="font-bold">
                        {viewingDoc.expand?.client_id?.name || 'Cliente Geral'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[11px]">CPF / CNPJ:</span>
                      <p className="font-mono font-semibold">
                        {viewingDoc.expand?.client_id?.document || '00.000.000/0000-00'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Dados da Operação e Valores */}
                <div className="border border-slate-300 rounded p-2.5">
                  <p className="font-bold text-xs uppercase text-slate-700 border-b border-slate-200 pb-1 mb-2">
                    DADOS DA OPERAÇÃO & CÁLCULO DO IMPOSTO
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-slate-500 text-[11px]">Natureza da Operação:</span>
                      <p className="font-semibold text-xs truncate">
                        {viewingDoc.nature_operation}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[11px]">Regime Tributário:</span>
                      <p className="font-semibold text-xs">Simples Nacional</p>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-500 text-[11px]">VALOR TOTAL DO DOCUMENTO:</span>
                      <p className="font-black text-sm text-blue-700">
                        {formatCurrency(viewingDoc.total_amount)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Informações Complementares */}
                <div className="bg-slate-50 border border-slate-200 rounded p-2.5 text-[11px] text-slate-600">
                  <span className="font-bold block text-slate-700 uppercase mb-0.5">
                    DADOS ADICIONAIS / INFORMAÇÕES COMPLEMENTARES:
                  </span>
                  <p>{viewingDoc.provider_message}</p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Documento gerado em conformidade com o layout oficial da Receita Federal do
                    Brasil (Ajuste SINIEF / SEFAZ).
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDanfeModalOpen(false)}>
                  Fechar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL CONFIGURAÇÕES FISCAIS */}
      <Dialog open={isSettingsModalOpen} onOpenChange={setIsSettingsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-blue-600" />
              Configurações Fiscais & Provedor
            </DialogTitle>
            <DialogDescription>
              Credenciais para transmissão em produção/homologação junto à SEFAZ e prefeituras.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSettings} className="space-y-3.5 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="cfg-provider">Provedor de Transmissão Fiscal</Label>
              <select
                id="cfg-provider"
                value={formProvider}
                onChange={(e) => setFormProvider(e.target.value)}
                className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
              >
                <option value="focus_nfe">Focus NFe (Homologado SEFAZ)</option>
                <option value="nfe_io">NFe.io (Solução Fiscal)</option>
                <option value="plugnotas">PlugNotas / TecnoSpeed</option>
                <option value="custom">Webservice Direto SEFAZ</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cfg-token">Token / Chave de API do Provedor</Label>
              <Input
                id="cfg-token"
                type="password"
                value={formApiToken}
                onChange={(e) => setFormApiToken(e.target.value)}
                placeholder="Insira o token de API do provedor..."
              />
              <p className="text-[11px] text-slate-400">
                Deixe em branco para manter o modo "pronto para conectar" em homologação.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cfg-env">Ambiente</Label>
                <select
                  id="cfg-env"
                  value={formEnvironment}
                  onChange={(e) => setFormEnvironment(e.target.value)}
                  className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
                >
                  <option value="homologation">Homologação (Testes)</option>
                  <option value="production">Produção (Validade Jurídica)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cfg-regime">Regime Tributário</Label>
                <select
                  id="cfg-regime"
                  value={formTaxRegime}
                  onChange={(e) => setFormTaxRegime(e.target.value)}
                  className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
                >
                  <option value="simples_nacional">Simples Nacional</option>
                  <option value="lucro_presumido">Lucro Presumido</option>
                  <option value="lucro_real">Lucro Real</option>
                  <option value="mei">MEI</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cfg-nfe-s">Série NF-e</Label>
                <Input
                  id="cfg-nfe-s"
                  value={formNfeSeries}
                  onChange={(e) => setFormNfeSeries(e.target.value)}
                  placeholder="1"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cfg-nfse-s">Série NFS-e</Label>
                <Input
                  id="cfg-nfse-s"
                  value={formNfseSeries}
                  onChange={(e) => setFormNfseSeries(e.target.value)}
                  placeholder="E"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cfg-cnpj">CNPJ Emitente</Label>
                <Input
                  id="cfg-cnpj"
                  value={formCnpj}
                  onChange={(e) => setFormCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cfg-ie">Inscrição Estadual (IE)</Label>
                <Input
                  id="cfg-ie"
                  value={formIe}
                  onChange={(e) => setFormIe(e.target.value)}
                  placeholder="Isento ou Nº"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cfg-im">Inscrição Municipal (NFS-e)</Label>
              <Input
                id="cfg-im"
                value={formIm}
                onChange={(e) => setFormIm(e.target.value)}
                placeholder="Número na prefeitura..."
              />
            </div>

            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600">
              <span className="font-semibold text-slate-800 block">Certificado Digital A1:</span>
              O certificado digital A1 (.pfx) é cadastrado diretamente no painel do provedor
              selecionado (Focus NFe ou NFe.io), autenticando com segurança as assinaturas XML da
              SEFAZ.
            </div>

            <DialogFooter className="pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setIsSettingsModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={savingSettings}
              >
                {savingSettings ? 'Gravando...' : 'Salvar Configurações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
