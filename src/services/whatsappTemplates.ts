import pb from '@/lib/pocketbase/client'
import type { WhatsAppStoredKey, WhatsAppTemplate, WhatsAppTemplateKey } from '@/types/crm'

export const whatsappTemplateDefaults: Record<WhatsAppTemplateKey, string> = {
  greeting:
    '{{saudacao}}{{nome}}! Aqui é da equipe de atendimento. Recebemos sua mensagem e já estamos te respondendo. Em que podemos ajudar?',
  menu: 'Digite o número da opção desejada:\n\n1 - Falar com um atendente\n2 - Solicitar um orçamento\n3 - Horários de atendimento\n4 - Outros assuntos',
}

export const whatsappTemplateLabels: Record<WhatsAppTemplateKey, { title: string; hint: string }> =
  {
    greeting: {
      title: 'Mensagem de saudação',
      hint: 'Enviada automaticamente quando o cliente manda uma mensagem. A mensagem de menu é enviada junto, logo abaixo.',
    },
    menu: {
      title: 'Mensagem de menu',
      hint: 'Lista de opções iniciais mostrada ao cliente. Use quebras de linha para separar as opções.',
    },
  }

export const whatsappTemplateVariables: { key: string; description: string }[] = [
  { key: '{{nome}}', description: 'Primeiro nome do cliente (ou nome do contato do WhatsApp)' },
  { key: '{{nome_completo}}', description: 'Nome completo do cliente cadastrado' },
  { key: '{{saudacao}}', description: 'Bom dia / Boa tarde / Boa noite, conforme o horário' },
  { key: '{{telefone}}', description: 'Telefone do cliente no formato (DD) 90000-0000' },
]

export const whatsappTemplatesService = {
  async getAll(): Promise<WhatsAppTemplate[]> {
    try {
      return await pb.collection('whatsapp_templates').getFullList<WhatsAppTemplate>({
        sort: 'key',
      })
    } catch {
      return []
    }
  },

  async save(key: WhatsAppStoredKey, body: string, updatedBy?: string): Promise<void> {
    const existing = await pb.collection('whatsapp_templates').getFullList<WhatsAppTemplate>({
      filter: `key = "${key}"`,
    })
    if (existing.length > 0) {
      await pb.collection('whatsapp_templates').update(existing[0].id, {
        body,
        updated_by: updatedBy || undefined,
      })
      return
    }
    await pb.collection('whatsapp_templates').create({
      key,
      body,
      active: true,
      updated_by: updatedBy || undefined,
    })
  },
}
