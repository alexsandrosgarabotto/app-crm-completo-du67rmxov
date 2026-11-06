import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MessageCircle,
  Send,
  User,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  formatWhatsAppPhone,
  statusLabels,
  useWhatsAppConversation,
  useWhatsAppInbox,
} from '@/hooks/useWhatsAppInbox'
import type { WhatsAppConversation, WhatsAppConversationStatus } from '@/types/crm'

const statusStyles: Record<WhatsAppConversationStatus, string> = {
  aberto: 'bg-amber-100 text-amber-800',
  em_atendimento: 'bg-blue-100 text-blue-800',
  finalizado: 'bg-emerald-100 text-emerald-800',
}

function formatTime(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function ConversationListItem({
  conversation,
  active,
  onClick,
}: {
  conversation: WhatsAppConversation
  active: boolean
  onClick: () => void
}) {
  const client = conversation.expand?.client_id
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-lg border transition-colors flex flex-col gap-1',
        active
          ? 'border-blue-300 bg-blue-50 shadow-xs'
          : 'border-slate-200 bg-white hover:bg-slate-50',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm text-slate-800 truncate">
          {client?.name || conversation.contact_name || formatWhatsAppPhone(conversation.phone)}
        </span>
        <Badge
          variant="secondary"
          className={cn('text-[10px] px-1.5', statusStyles[conversation.status])}
        >
          {statusLabels[conversation.status]}
        </Badge>
      </div>
      <p className="text-xs text-slate-500 line-clamp-2">
        {conversation.last_message || 'Sem mensagens'}
      </p>
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>{formatWhatsAppPhone(conversation.phone)}</span>
        <span>{formatTime(conversation.last_message_at)}</span>
      </div>
      {(conversation.unread_count || 0) > 0 && (
        <Badge className="bg-emerald-600 text-white text-[10px] w-fit">
          {conversation.unread_count} nova(s)
        </Badge>
      )}
    </button>
  )
}

function MessageBubble({
  message,
}: {
  message: { direction: string; origin: string; body: string; created: string }
}) {
  const isOutbound = message.direction === 'outbound'
  return (
    <div className={cn('flex flex-col', isOutbound ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm',
          isOutbound
            ? 'bg-emerald-600 text-white'
            : 'bg-white border border-slate-200 text-slate-800',
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        {isOutbound && (
          <p className={cn('text-[10px] mt-1', isOutbound ? 'text-emerald-100' : 'text-slate-400')}>
            {message.origin === 'auto' ? 'Resposta automática' : 'Atendente'}
          </p>
        )}
      </div>
      <span className="text-[10px] text-slate-400 mt-1">{formatTime(message.created)}</span>
    </div>
  )
}

export default function WhatsAppPage() {
  const inbox = useWhatsAppInbox()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const conversationView = useWhatsAppConversation(selectedId)
  const [draft, setDraft] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const handleSelect = (id: string) => {
    setSelectedId(id)
    setDraft('')
    setActionError(null)
  }

  const handleSend = async () => {
    if (!draft.trim()) return
    setActionError(null)
    try {
      await conversationView.sendMessage(draft)
      setDraft('')
    } catch (err) {
      console.error(err)
      setActionError('Não foi possível enviar a mensagem pelo WhatsApp da empresa.')
    }
  }

  const handleStatus = async (status: WhatsAppConversationStatus) => {
    if (!selectedId) return
    setActionError(null)
    try {
      await conversationView.changeStatus(status)
    } catch (err) {
      console.error(err)
      setActionError('Não foi possível atualizar o status do atendimento.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-emerald-600" />
            Atendimentos WhatsApp
          </h1>
          <p className="text-sm text-slate-500">
            Conversas do WhatsApp da empresa, respondidas automaticamente e acompanhadas pela
            equipe.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
            {inbox.totals.aberto} aberto(s)
          </Badge>
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            {inbox.totals.em_atendimento} em atendimento
          </Badge>
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
            {inbox.totals.finalizado} finalizado(s)
          </Badge>
        </div>
      </div>

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
        {/* Lista de conversas */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 space-y-3">
            <CardTitle className="text-base">Caixa de entrada</CardTitle>
            <Input
              placeholder="Buscar por cliente, telefone ou mensagem..."
              value={inbox.search}
              onChange={(e) => inbox.setSearch(e.target.value)}
              className="h-9"
            />
            <Tabs
              value={inbox.statusFilter}
              onValueChange={(v) =>
                inbox.setStatusFilter(v as WhatsAppConversationStatus | 'todos')
              }
            >
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="todos" className="text-xs">
                  Todos
                </TabsTrigger>
                <TabsTrigger value="aberto" className="text-xs">
                  Abertos
                </TabsTrigger>
                <TabsTrigger value="em_atendimento" className="text-xs">
                  Em atendimento
                </TabsTrigger>
                <TabsTrigger value="finalizado" className="text-xs">
                  Finalizados
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="max-h-[65vh] overflow-y-auto space-y-2">
            {inbox.loading ? (
              <div className="space-y-2">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : inbox.error ? (
              <p className="text-sm text-red-600">{inbox.error}</p>
            ) : inbox.conversations.length === 0 ? (
              <div className="text-center py-10 text-sm text-slate-500">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                Nenhum atendimento encontrado.
              </div>
            ) : (
              inbox.conversations.map((c) => (
                <ConversationListItem
                  key={c.id}
                  conversation={c}
                  active={c.id === selectedId}
                  onClick={() => handleSelect(c.id)}
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* Visualização da conversa */}
        <Card className="flex flex-col">
          {selectedId && conversationView.conversation ? (
            <>
              <CardHeader className="pb-2 border-b border-slate-100">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="lg:hidden"
                      onClick={() => setSelectedId(null)}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-400" />
                        {conversationView.conversation.expand?.client_id?.name ||
                          conversationView.conversation.contact_name ||
                          formatWhatsAppPhone(conversationView.conversation.phone)}
                      </CardTitle>
                      <p className="text-xs text-slate-500">
                        {formatWhatsAppPhone(conversationView.conversation.phone)}
                        {conversationView.conversation.expand?.client_id && (
                          <>
                            {' · '}
                            <Link
                              to={`/clientes?cliente=${conversationView.conversation.expand.client_id.id}`}
                              className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                            >
                              Ver ficha do cliente
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(
                      ['aberto', 'em_atendimento', 'finalizado'] as WhatsAppConversationStatus[]
                    ).map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={
                          conversationView.conversation?.status === s ? 'default' : 'outline'
                        }
                        onClick={() => handleStatus(s)}
                        disabled={conversationView.conversation?.status === s}
                      >
                        {s === 'finalizado' && <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                        {statusLabels[s]}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 max-h-[50vh] overflow-y-auto space-y-3 bg-slate-50">
                {conversationView.loading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                  </div>
                ) : conversationView.messages.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-10">
                    Nenhuma mensagem nesta conversa.
                  </p>
                ) : (
                  conversationView.messages.map((m) => <MessageBubble key={m.id} message={m} />)
                )}
                <div ref={conversationView.bottomRef} />
              </CardContent>

              <div className="border-t border-slate-100 p-3 flex items-center gap-2">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder="Digite sua resposta como atendente..."
                  disabled={conversationView.sending}
                />
                <Button onClick={handleSend} disabled={conversationView.sending || !draft.trim()}>
                  {conversationView.sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span className="sr-only">Enviar mensagem</span>
                </Button>
              </div>
            </>
          ) : (
            <CardContent className="flex flex-col items-center justify-center py-20 text-center text-slate-500">
              <MessageCircle className="h-10 w-10 mb-3 text-slate-300" />
              <p className="text-sm">Selecione um atendimento à esquerda para ver a conversa.</p>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}
