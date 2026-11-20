import { useState } from 'react'
import { ClientResponseError } from 'pocketbase'
import { KeyRound, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import { companyService } from '@/services/company'

const friendlyPasswordError = (err: unknown): string => {
  if (err instanceof ClientResponseError) {
    const data = (err.response?.data || {}) as Record<string, { message?: string }>
    if (data.oldPassword?.message) return 'A senha atual está incorreta.'
    if (data.password?.message) return 'A nova senha não é válida. Use pelo menos 8 caracteres.'
    if (data.passwordConfirm?.message) return 'A confirmação da nova senha não confere.'
  }
  return 'Não foi possível alterar a senha. Tente novamente.'
}

export function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: 'Atenção',
        description: 'Preencha a senha atual, a nova senha e a confirmação.',
        variant: 'destructive',
      })
      return
    }

    if (newPassword.length < 8) {
      toast({
        title: 'Atenção',
        description: 'A nova senha precisa ter pelo menos 8 caracteres.',
        variant: 'destructive',
      })
      return
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Atenção',
        description: 'A nova senha e a confirmação não são iguais.',
        variant: 'destructive',
      })
      return
    }

    if (newPassword === currentPassword) {
      toast({
        title: 'Atenção',
        description: 'A nova senha deve ser diferente da senha atual.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      await companyService.changeMyPassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast({
        title: 'Senha alterada!',
        description: 'Sua nova senha já está em uso. Sua sessão foi mantida.',
      })
    } catch (err) {
      toast({
        title: 'Erro ao alterar a senha',
        description: friendlyPasswordError(err),
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
          Alterar minha senha
        </CardTitle>
        <CardDescription>
          Use a senha atual para confirmar a troca. Sua sessão permanece ativa após alterar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pw-current">Senha atual</Label>
              <Input
                id="pw-current"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-new">Nova senha</Label>
              <Input
                id="pw-new"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-confirm">Confirmar nova senha</Label>
              <Input
                id="pw-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
              />
            </div>
          </div>

          <div className="pt-3 border-t flex justify-end">
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={saving}>
              <Save className="h-4 w-4 mr-1.5" />
              {saving ? 'Salvando...' : 'Salvar nova senha'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
