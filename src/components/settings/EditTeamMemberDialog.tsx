import { useState } from 'react'
import { ClientResponseError } from 'pocketbase'
import { UserCog } from 'lucide-react'
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

interface EditTeamMemberDialogProps {
  member: User | null
  onClose: () => void
  onSaved: (updated: User) => void
}

export function EditTeamMemberDialog({ member, onClose, onSaved }: EditTeamMemberDialogProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)

  // Preenche o formulário quando um membro é selecionado (dialog aberto).
  const [loadedId, setLoadedId] = useState<string | null>(null)
  if (member && member.id !== loadedId) {
    setLoadedId(member.id)
    setName(member.name || '')
    setEmail(member.email || '')
    setPhone(member.phone || '')
  }
  if (!member && loadedId) {
    setLoadedId(null)
  }

  const handleSave = async () => {
    if (!member) return

    if (!name.trim() || !email.trim()) {
      toast({
        title: 'Atenção',
        description: 'Nome e e-mail são obrigatórios.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const updated = await companyService.updateTeamMember(member.id, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
      })
      toast({
        title: 'Membro atualizado!',
        description: `Os dados de ${updated.name} foram salvos. O login passa a usar o e-mail ${updated.email}.`,
      })
      onSaved(updated)
      onClose()
    } catch (err) {
      let description = 'Não foi possível salvar os dados do membro. Tente novamente.'
      if (err instanceof ClientResponseError && err.response?.data?.email?.message) {
        description = 'Este e-mail já está cadastrado ou não é válido.'
      } else if (err instanceof ClientResponseError && err.response?.data?.name?.message) {
        description = 'Informe um nome válido.'
      }
      toast({ title: 'Erro ao salvar membro', description, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!member} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-4 w-4 text-blue-600" />
            Editar membro
          </DialogTitle>
          <DialogDescription>
            Altere o nome, o e-mail e o telefone de{' '}
            <span className="font-medium">{member?.name}</span>. O e-mail é o identificador de login
            — o membro passa a entrar com o novo e-mail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-member-name">Nome</Label>
            <Input
              id="edit-member-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: João Silva"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-member-email">E-mail (login)</Label>
            <Input
              id="edit-member-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="joao@minhaempresa.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-member-phone">Telefone / WhatsApp</Label>
            <Input
              id="edit-member-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 90000-0000"
            />
          </div>
        </div>

        <DialogFooter className="pt-3 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
