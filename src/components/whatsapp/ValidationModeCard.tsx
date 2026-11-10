import React, { useEffect, useState } from 'react'
import { FlaskConical, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { whatsappTemplatesService } from '@/services/whatsappTemplates'
import { toast } from '@/hooks/use-toast'

/**
 * Modo de validação do atendimento automático: enquanto o interruptor estiver
 * ligado, SOMENTE o número de teste autorizado (validacao_numero) recebe as
 * respostas automáticas (saudação + menu e opções 1-4). Mensagens de outros
 * clientes continuam sendo gravadas no CRM, mas ficam para resposta manual do
 * atendente. Desligado, todos os clientes recebem as respostas automáticas.
 */
export function ValidationModeCard() {
  const [enabled, setEnabled] = useState(false)
  const [number, setNumber] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const list = await whatsappTemplatesService.getAll()
      const onlyRow = list.find((tpl) => tpl.key === 'validacao_apenas')
      const numberRow = list.find((tpl) => tpl.key === 'validacao_numero')
      setEnabled((onlyRow?.body || '').trim().toLowerCase() === 'true')
      setNumber(numberRow?.body || '')
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const digits = number.replace(/\D/g, '')
    if (enabled && !digits) {
      toast({
        title: 'Atenção',
        description:
          'Com o modo de validação ligado, informe o número autorizado a receber as respostas automáticas.',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      await whatsappTemplatesService.save('validacao_apenas', enabled ? 'true' : 'false')
      await whatsappTemplatesService.save('validacao_numero', digits)
      setNumber(digits)
      toast({
        title: 'Modo de validação salvo!',
        description: enabled
          ? 'Somente o número de teste recebe as respostas automáticas.'
          : 'Todos os clientes voltam a receber as respostas automáticas.',
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
          <FlaskConical className="h-4 w-4 text-blue-600" />
          Modo de validação
        </CardTitle>
        <CardDescription>
          Ligado: só o número de teste recebe as respostas automáticas do atendimento (saudação,
          menu e opções) — mensagens de outros clientes são registradas no CRM e aguardam resposta
          manual do atendente. Desligado: todos os clientes recebem as respostas automáticas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="wa-validacao-apenas" className="cursor-pointer">
              Responder automaticamente só ao número de teste
            </Label>
            <Switch
              id="wa-validacao-apenas"
              checked={enabled}
              onCheckedChange={setEnabled}
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa-validacao-numero">Número autorizado (número de teste)</Label>
            <Input
              id="wa-validacao-numero"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder={loading ? 'Carregando...' : 'Ex: 5566999830114'}
              disabled={loading}
              inputMode="tel"
              className="font-mono text-xs"
            />
            <p className="text-xs text-slate-500">
              Somente dígitos, com ou sem o código do país (55). Ex: 5566999830114 ou 66999830114.
            </p>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={saving || loading}
            >
              <Save className="h-4 w-4 mr-1.5" />
              {saving ? 'Salvando...' : 'Salvar modo de validação'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
