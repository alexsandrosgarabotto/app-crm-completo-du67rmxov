import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import useRealtime from '@/hooks/use-realtime'
import { whatsappService } from '@/services/whatsapp'
import type { RecordModel } from 'pocketbase'
import type { WhatsAppConversation, WhatsAppConversationStatus, WhatsAppMessage } from '@/types/crm'

type ConversationRecord = WhatsAppConversation & RecordModel
type MessageRecord = WhatsAppMessage & RecordModel

export const statusLabels: Record<WhatsAppConversationStatus, string> = {
  aberto: 'Aberto',
  em_atendimento: 'Em atendimento',
  finalizado: 'Finalizado',
}

function formatPhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '')
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return raw
}

export function useWhatsAppInbox() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([])
  const [statusFilter, setStatusFilter] = useState<WhatsAppConversationStatus | 'todos'>('todos')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const data = await whatsappService.getConversations(statusFilter)
      setConversations(data)
    } catch (err) {
      console.error(err)
      setError('Não foi possível carregar os atendimentos.')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    load()
  }, [load])

  useRealtime<ConversationRecord>('whatsapp_conversations', () => {
    load()
  })

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return conversations
    return conversations.filter((c) => {
      const clientName = c.expand?.client_id?.name || ''
      const contact = c.contact_name || ''
      return (
        clientName.toLowerCase().includes(term) ||
        contact.toLowerCase().includes(term) ||
        formatPhone(c.phone).includes(term) ||
        (c.last_message || '').toLowerCase().includes(term)
      )
    })
  }, [conversations, search])

  const totals = useMemo(() => {
    const counts = { aberto: 0, em_atendimento: 0, finalizado: 0 }
    for (const c of conversations) {
      counts[c.status] = (counts[c.status] || 0) + 1
    }
    return counts
  }, [conversations])

  const unreadTotal = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0),
    [conversations],
  )

  return {
    user,
    conversations: filtered,
    totals,
    unreadTotal,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    loading,
    error,
    reload: load,
    formatPhone,
  }
}

export function useWhatsAppConversation(conversationId: string | null) {
  const [conversation, setConversation] = useState<WhatsAppConversation | null>(null)
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const loadMessages = useCallback(async () => {
    if (!conversationId) return
    setLoading(true)
    try {
      const [conv, msgs] = await Promise.all([
        whatsappService.getConversation(conversationId),
        whatsappService.getMessages(conversationId),
      ])
      setConversation(conv)
      setMessages(msgs)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  useRealtime<MessageRecord>(
    'whatsapp_messages',
    (event) => {
      if (!conversationId) return
      if (event.record.conversation_id !== conversationId) return
      setMessages((prev) => {
        if (prev.some((m) => m.id === event.record.id)) return prev
        const incoming = event.record as unknown as WhatsAppMessage
        return [...prev, incoming].sort(
          (a, b) => new Date(a.created).getTime() - new Date(b.created).getTime(),
        )
      })
      setConversation((prev) =>
        prev
          ? { ...prev, last_message: event.record.body, last_message_at: event.record.created }
          : prev,
      )
    },
    !!conversationId,
  )

  useEffect(() => {
    if (conversationId && !loading) {
      whatsappService.markAsRead(conversationId).catch(() => {})
    }
  }, [conversationId, loading])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const changeStatus = useCallback(
    async (status: WhatsAppConversationStatus) => {
      if (!conversationId) return
      const updated = await whatsappService.updateStatus(conversationId, status)
      setConversation(updated)
    },
    [conversationId],
  )

  const sendMessage = useCallback(
    async (text: string) => {
      if (!conversationId || !text.trim()) return
      setSending(true)
      try {
        await whatsappService.sendMessage(conversationId, text.trim())
        await loadMessages()
      } finally {
        setSending(false)
      }
    },
    [conversationId, loadMessages],
  )

  return {
    conversation,
    messages,
    loading,
    sending,
    bottomRef,
    changeStatus,
    sendMessage,
    reload: loadMessages,
  }
}

export { formatPhone as formatWhatsAppPhone }
