import pb from '@/lib/pocketbase/client'
import type { WhatsAppConversation, WhatsAppConversationStatus, WhatsAppMessage } from '@/types/crm'

export const whatsappService = {
  async getConversations(
    status?: WhatsAppConversationStatus | 'todos',
  ): Promise<WhatsAppConversation[]> {
    const filter = status && status !== 'todos' ? `status = "${status}"` : ''
    return await pb.collection('whatsapp_conversations').getFullList<WhatsAppConversation>({
      filter,
      sort: '-last_message_at,-created',
      expand: 'client_id,assigned_to',
    })
  },

  async getConversation(id: string): Promise<WhatsAppConversation> {
    return await pb.collection('whatsapp_conversations').getOne<WhatsAppConversation>(id, {
      expand: 'client_id,assigned_to',
    })
  },

  async getMessages(conversationId: string): Promise<WhatsAppMessage[]> {
    return await pb.collection('whatsapp_messages').getFullList<WhatsAppMessage>({
      filter: `conversation_id = "${conversationId}"`,
      sort: 'created',
      expand: 'sent_by',
    })
  },

  async updateStatus(
    id: string,
    status: WhatsAppConversationStatus,
  ): Promise<WhatsAppConversation> {
    return await pb
      .collection('whatsapp_conversations')
      .update<WhatsAppConversation>(id, { status })
  },

  async assign(id: string, userId: string | null): Promise<WhatsAppConversation> {
    return await pb.collection('whatsapp_conversations').update<WhatsAppConversation>(id, {
      assigned_to: userId,
      status: 'em_atendimento',
    })
  },

  async markAsRead(id: string): Promise<void> {
    await pb.collection('whatsapp_conversations').update<WhatsAppConversation>(id, {
      unread_count: 0,
    })
  },

  /**
   * Envia a mensagem do atendente pelo WhatsApp da empresa.
   * O envio externo acontece no backend (hook /backend/v1/crm/whatsapp/send)
   * usando o WhatsApp conectado nos conectores do builder; aqui apenas
   * registramos a mensagem e devolvemos o estado atualizado.
   */
  async sendMessage(conversationId: string, body: string): Promise<{ ok: boolean }> {
    return await pb.send('/backend/v1/crm/whatsapp/send', {
      method: 'POST',
      body: JSON.stringify({ conversation_id: conversationId, body }),
    })
  },

  /** URL do webhook que o conector do WhatsApp deve chamar a cada mensagem recebida. */
  inboundWebhookUrl(): string {
    const base = pb.buildUrl('').replace(/\/$/, '')
    return `${base}/backend/v1/crm/whatsapp/inbound`
  },
}
