import React, { useEffect, useState } from 'react'
import { Phone, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { whatsappTemplatesService } from '@/services/whatsappTemplates'
import { toast } from '@/hooks/use-toast'

/**
 * Phone Number ID do WhatsApp Business (Meta Cloud API), editável em
 * Configurações > Mensagens Automáticas. É lido pelo backend no envio.
 */
export function PhoneNumberIdCard() {
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
      const row = list.find((tpl) => tpl.key === 'phone_number_id')
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
    if (!/^\d+$/.test(trimmed)) {
      toast({
        title: 'Atenção',
        description: 'O Phone Number ID deve conter apenas números.',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      await whatsappTemplatesService.save('phone_number_id', trimmed)
      setValue(trimmed)
      toast({
        title: 'Phone Number ID salvo!',
        description: 'Os próximos envios de WhatsApp usam este número.',
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
          <Phone className="h-4 w-4 text-blue-600" />
          Phone Number ID do WhatsApp
        </CardTitle>
        <CardDescription>
          Identificador do número de WhatsApp Business (Meta Cloud API) usado para enviar as
          mensagens automáticas. Troque aqui ao migrar do número de teste para o oficial.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="space-y-1.5 flex-1">
            <Label htmlFor="wa-phone-number-id">Phone Number ID</Label>
            <Input
              id="wa-phone-number-id"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={loading ? 'Carregando...' : 'Ex: 1433277493204874'}
              disabled={loading}
              inputMode="numeric"
              className="font-mono text-xs"
            />
          </div>
          <Button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700"
            disabled={saving || loading}
          >
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? 'Salvando...' : 'Salvar Phone Number ID'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
