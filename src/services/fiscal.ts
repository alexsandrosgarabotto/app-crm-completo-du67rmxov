import pb from '@/lib/pocketbase/client'
import type { FiscalDocument, FiscalSettings, FiscalDocType } from '@/types/crm'

export const fiscalService = {
  async getDocuments(): Promise<FiscalDocument[]> {
    return await pb.collection('fiscal_documents').getFullList<FiscalDocument>({
      sort: '-created',
      expand: 'deal_id,client_id,created_by',
    })
  },

  async getDocumentById(id: string): Promise<FiscalDocument> {
    return await pb.collection('fiscal_documents').getOne<FiscalDocument>(id, {
      expand: 'deal_id,client_id,created_by',
    })
  },

  async createDocument(data: Partial<FiscalDocument>): Promise<FiscalDocument> {
    return await pb.collection('fiscal_documents').create<FiscalDocument>(data, {
      expand: 'deal_id,client_id,created_by',
    })
  },

  async updateDocument(id: string, data: Partial<FiscalDocument>): Promise<FiscalDocument> {
    return await pb.collection('fiscal_documents').update<FiscalDocument>(id, data, {
      expand: 'deal_id,client_id,created_by',
    })
  },

  async deleteDocument(id: string): Promise<boolean> {
    return await pb.collection('fiscal_documents').delete(id)
  },

  // Configurações Fiscais
  async getSettings(): Promise<FiscalSettings | null> {
    const list = await pb.collection('fiscal_settings').getFullList<FiscalSettings>({
      sort: '-created',
      requestKey: null,
    })
    return list[0] || null
  },

  async saveSettings(data: Partial<FiscalSettings>): Promise<FiscalSettings> {
    const existing = await this.getSettings()
    if (existing) {
      return await pb.collection('fiscal_settings').update<FiscalSettings>(existing.id, data)
    }
    return await pb.collection('fiscal_settings').create<FiscalSettings>(data)
  },

  // Ação de emissão (preparada para conectar com provedor certificado)
  async issueDocument(params: {
    dealId?: string
    clientId?: string
    docType: FiscalDocType
    natureOperation?: string
    totalAmount: number
    userId?: string
  }): Promise<{ document: FiscalDocument; hasLiveProvider: boolean; message: string }> {
    const settings = await this.getSettings()
    const hasLiveProvider = Boolean(settings?.api_token && settings.api_token.trim().length > 0)

    // Gerar número sequencial amigável
    const randomNum = Math.floor(1000 + Math.random() * 9000).toString()
    const series =
      params.docType === 'NFE' ? settings?.nfe_series || '1' : settings?.nfse_series || 'E'

    let status: FiscalDocument['status'] = 'to_transmit'
    let providerMessage = ''

    if (hasLiveProvider) {
      // Se houver token configurado no futuro, conecta via provedor
      status = 'to_transmit'
      providerMessage = `Pronto para envio ao provedor ${settings?.provider || 'SEFAZ'} em ambiente de ${settings?.environment === 'production' ? 'PRODUÇÃO' : 'HOMOLOGAÇÃO'}.`
    } else {
      // Modo "Pronto para Conectar" solicitado pelo usuário
      status = 'to_transmit'
      providerMessage =
        params.docType === 'NFE'
          ? 'Pendente de transmissão: para envio e autorização junto à SEFAZ, conecte o Certificado Digital A1 e as credenciais de API do provedor fiscal nas Configurações Fiscais.'
          : 'Pendente de transmissão: para envio e homologação da NFS-e municipal junto à Prefeitura, conecte as credenciais do provedor de NFS-e nas Configurações Fiscais.'
    }

    const today = new Date().toISOString().split('T')[0]

    const doc = await this.createDocument({
      doc_type: params.docType,
      deal_id: params.dealId || undefined,
      client_id: params.clientId || undefined,
      nature_operation:
        params.natureOperation ||
        (params.docType === 'NFE'
          ? 'Venda de mercadorias / produtos'
          : 'Prestação de serviços tributados no município'),
      total_amount: params.totalAmount,
      status,
      number: `00${randomNum}`,
      series,
      provider_message: providerMessage,
      issue_date: today,
      created_by: params.userId || undefined,
    })

    return {
      document: doc,
      hasLiveProvider,
      message: providerMessage,
    }
  },
}
