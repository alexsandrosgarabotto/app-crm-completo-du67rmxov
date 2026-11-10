import React, { useEffect, useState } from 'react'
import { KeyRound, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { whatsappTemplatesService } from '@/services/whatsappTemplates'
import { toast } from '@/hooks/use-toast'

/**
 * Token de acesso da Meta (Meta Cloud API), gerado em developers.facebook.com
 * > WhatsApp > API Setup > "Gerar token de acesso". Editável em
 * Configurações > Mensagens Automáticas. Quando configurado, o backend envia
 * direto pela Graph API com este token (em vez do conector Skip).
 */
export function MetaAccessTokenCard() {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const list = await whatsappTemplatesService.getAll()
      const row = list.find((tpl) => tpl.key === 'meta_access_token')
      setValue(row?.body || '')
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) {
      toast({
        title: 'Atenção',
        description: 'Informe o token de acesso da Meta (ou deixe vazio para usar o conector).',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      await whatsappTemplatesService.save('meta_access_token', trimmed)
      setValue(trimmed)
      toast({
        title: 'Token de acesso Meta salvo!',
        description: 'Os próximos envios de WhatsApp usam este token direto na API da Meta.',
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
          <KeyRound className="h-4 w-4 text-blue-600" />
          Token de acesso Meta
        </CardTitle>
        <CardDescription>
          Token de acesso do WhatsApp Business gerado em developers.facebook.com → WhatsApp → API
          Setup (botão "Gerar token de acesso"). Cole aqui o token gerado. Ele expira (~60 dias) —
          quando expirar, gere um novo no mesmo lugar e cole aqui. Enquanto ele estiver preenchido,
          o envio sai direto pela API da Meta com este token.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="space-y-1.5 flex-1">
            <Label htmlFor="wa-meta-access-token">Token de acesso Meta</Label>
            <Input
              id="wa-meta-access-token"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={loading ? 'Carregando...' : 'Cole aqui o token gerado na API Setup'}
              disabled={loading}
              type="password"
              autoComplete="off"
              className="font-mono text-xs"
            />
          </div>
          <Button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700"
            disabled={saving || loading}
          >
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? 'Salvando...' : 'Salvar token'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
