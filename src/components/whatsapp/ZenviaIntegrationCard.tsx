import React, { useEffect, useState } from 'react'
import { Save, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { whatsappTemplatesService } from '@/services/whatsappTemplates'
import { toast } from '@/hooks/use-toast'

/**
 * Integração Zenvia (envio de WhatsApp): API Token e Sender ID, editáveis
 * em Configurações > Mensagens Automáticas. O backend envia pela Zenvia
 * (POST api.zenvia.com/v2/channels/whatsapp/messages, header X-API-TOKEN)
 * quando ambos estiverem preenchidos; senão usa o conector Skip como fallback.
 */
export function ZenviaIntegrationCard() {
  const [apiToken, setApiToken] = useState('')
  const [sender, setSender] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const list = await whatsappTemplatesService.getAll()
      const tokenRow = list.find((tpl) => tpl.key === 'zenvia_api_token')
      const senderRow = list.find((tpl) => tpl.key === 'zenvia_sender')
      setApiToken(tokenRow?.body || '')
      setSender(senderRow?.body || '')
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedToken = apiToken.trim()
    const trimmedSender = sender.trim()
    if (!trimmedToken || !trimmedSender) {
      toast({
        title: 'Atenção',
        description: 'Preencha o API Token e o Sender ID da Zenvia (ou deixe ambos vazios).',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      await whatsappTemplatesService.save('zenvia_api_token', trimmedToken)
      await whatsappTemplatesService.save('zenvia_sender', trimmedSender)
      toast({
        title: 'Integração Zenvia salva!',
        description: 'Os próximos envios de WhatsApp saem via API da Zenvia.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Verifique as permissões de acesso.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-slate-200 shadow-xs">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4 text-blue-600" />
          Integração Zenvia
        </CardTitle>
        <CardDescription>
          Envio de mensagens do WhatsApp via API da Zenvia. Preencha o API Token (gerado em
          app.zenvia.com/home/api) e o Sender ID do canal WhatsApp (listado em
          app.zenvia.com/home/credentials/whatsapp/list). Com ambos preenchidos, os envios saem pela
          Zenvia; sem eles, o envio continua pelo conector Skip.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="space-y-1.5 flex-1">
            <Label htmlFor="zenvia-api-token">API Token</Label>
            <Input
              id="zenvia-api-token"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder={loading ? 'Carregando...' : 'Token da API Zenvia'}
              disabled={loading}
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5 flex-1">
            <Label htmlFor="zenvia-sender">Sender ID</Label>
            <Input
              id="zenvia-sender"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              placeholder={loading ? 'Carregando...' : 'Ex: atomicsorriso'}
              disabled={loading}
              className="font-mono text-xs"
            />
          </div>
          <Button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700"
            disabled={saving || loading}
          >
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? 'Salvando...' : 'Salvar Integração Zenvia'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
