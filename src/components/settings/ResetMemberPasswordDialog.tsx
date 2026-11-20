import { useState } from 'react'
import { ClientResponseError } from 'pocketbase'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { companyService } from '@/services/company'
import type { User } from '@/types/crm'

interface ResetMemberPasswordDialogProps {
  member: User | null
  onClose: () => void
  onSaved: () => void
}

export function ResetMemberPasswordDialog({
  member,
  onClose,
  onSaved,
}: ResetMemberPasswordDialogProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!member) return

    if (password.length < 8) {
      toast({
        title: 'Atenção',
        description: 'A nova senha precisa ter pelo menos 8 caracteres.',
        variant: 'destructive',
      })
      return
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Atenção',
        description: 'A nova senha e a confirmação não são iguais.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      await companyService.resetMemberPassword(member.id, password)
      toast({
        title: 'Senha redefinida!',
        description: `Repasse a nova senha para ${member.name} (e-mail: ${member.email}).`,
      })
      setPassword('')
      setConfirmPassword('')
      onSaved()
      onClose()
    } catch (err) {
      const msg =
        err instanceof ClientResponseError && err.response?.data?.password?.message
          ? 'A nova senha não é válida. Use pelo menos 8 caracteres.'
          : 'Não foi possível redefinir a senha. Tente novamente.'
      toast({ title: 'Erro ao redefinir senha', description: msg, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!member} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-blue-600" />
            Redefinir senha
          </DialogTitle>
          <DialogDescription>
            Defina uma nova senha para <span className="font-medium">{member?.name}</span>. Ela será
            usada no próximo login — repasse por WhatsApp ou pessoalmente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="reset-pass">Nova senha</Label>
            <Input
              id="reset-pass"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reset-pass-confirm">Confirmar nova senha</Label>
            <Input
              id="reset-pass-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
            />
          </div>
        </div>

        <DialogFooter className="pt-3 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar nova senha'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
