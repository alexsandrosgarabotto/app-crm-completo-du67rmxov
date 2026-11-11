import { useEffect, useState } from 'react'
import { Loader2, Pencil, Save, User, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { clientsService } from '@/services/clients'
import type { Client, ServiceOrder } from '@/types/crm'

interface ServiceOrderClientDataProps {
  order: ServiceOrder
  client: Client | null
  onSaved: (client: Client) => void
}

/**
 * Seção "Dados do cliente" da ficha da OS: nome completo, telefone,
 * endereço (rua/número, bairro, cidade), documento e e-mail — os campos
 * reais da coleção clients. Editar e salvar grava na coleção clients.
 */
export function ServiceOrderClientData({ order, client, onSaved }: ServiceOrderClientDataProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    addressDistrict: '',
    city: '',
    state: '',
    document: '',
    email: '',
  })

  // Snapshot da OS como fallback quando o cliente ainda não tem o dado.
  const snapshotName = order.client_name || ''
  const snapshotPhone = order.client_phone || ''
  const snapshotAddress = order.client_address || ''

  const readAddressParts = (full: string) => {
    // Formato gravado pelo hook do WhatsApp: "Rua X, 123 — Bairro — Cidade/UF".
    const [ruaENumero = '', bairro = '', resto = ''] = full.split('—')
    let city = client?.city || ''
    let state = client?.state || ''
    if (resto.includes('/')) {
      const [c = '', s = ''] = resto.split('/')
      city = c.trim()
      state = s.trim()
    }
    return { ruaENumero: ruaENumero.trim(), bairro: bairro.trim(), city, state }
  }

  useEffect(() => {
    const parts = readAddressParts(snapshotAddress)
    setForm({
      name: client?.name || snapshotName,
      phone: client?.phone || snapshotPhone,
      address: parts.ruaENumero || '',
      addressDistrict: parts.bairro || '',
      city: parts.city,
      state: parts.state,
      document: client?.document || '',
      email: client?.email || '',
    })
    // Recarrega o formulário quando o cliente (ou o snapshot) muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id, snapshotName, snapshotPhone, snapshotAddress])

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const save = async () => {
    if (!client || !client.id) {
      setError('OS sem cliente vinculado — impossível salvar o cadastro.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const enderecoCompleto = [form.address, form.addressDistrict]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(', ')
      const updated = await clientsService.update(client.id, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: enderecoCompleto,
        city: form.city.trim(),
        state: form.state.trim().toUpperCase().slice(0, 2),
        document: form.document.trim(),
        email: form.email.trim(),
      } as Partial<Client>)
      onSaved(updated)
      setEditing(false)
    } catch (err: any) {
      setError(err?.message || 'Falha ao salvar os dados do cliente.')
    } finally {
      setSaving(false)
    }
  }

  const displayAddress =
    [client?.address, client?.city && `— ${client.city}`, client?.state && `/${client.state}`]
      .filter(Boolean)
      .join(' ')
      .replace(/^— /, '') || snapshotAddress

  return (
    <div className="space-y-3">
      {editing ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nome completo</label>
            <Input value={form.name} onChange={set('name')} placeholder="Nome do cliente" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Telefone</label>
            <Input value={form.phone} onChange={set('phone')} placeholder="(00) 00000-0000" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Endereço (rua e número)</label>
            <Input value={form.address} onChange={set('address')} placeholder="Rua, número" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Bairro</label>
            <Input
              value={form.addressDistrict}
              onChange={set('addressDistrict')}
              placeholder="Bairro"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Cidade</label>
            <Input value={form.city} onChange={set('city')} placeholder="Cidade" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">UF</label>
            <Input value={form.state} onChange={set('state')} placeholder="UF" maxLength={2} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">CPF / CNPJ</label>
            <Input value={form.document} onChange={set('document')} placeholder="CPF ou CNPJ" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">E-mail</label>
            <Input
              value={form.email}
              onChange={set('email')}
              type="email"
              placeholder="email@exemplo.com"
            />
          </div>
          {error && <p className="text-sm text-destructive sm:col-span-2 sm:text-right">{error}</p>}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button variant="outline" size="sm" disabled={saving} onClick={() => setEditing(false)}>
              <X className="h-4 w-4" />
              Cancelar
            </Button>
            <Button size="sm" disabled={saving} onClick={() => void save()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar no cadastro
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{client?.name || snapshotName || '—'}</p>
              <p className="text-xs text-muted-foreground">
                {snapshotName && client?.name && client.name !== snapshotName
                  ? 'Cadastro atualizado desde a abertura da OS'
                  : 'Nome do cliente'}
              </p>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">{client?.phone || snapshotPhone || '—'}</p>
            <p className="text-xs text-muted-foreground">Telefone</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-sm font-medium whitespace-pre-line">{displayAddress || '—'}</p>
            <p className="text-xs text-muted-foreground">Endereço</p>
          </div>
          {client?.document && (
            <div>
              <p className="text-sm font-medium">{client.document}</p>
              <p className="text-xs text-muted-foreground">CPF / CNPJ</p>
            </div>
          )}
          {client?.email && (
            <div>
              <p className="text-sm font-medium">{client.email}</p>
              <p className="text-xs text-muted-foreground">E-mail</p>
            </div>
          )}
          <div className="flex justify-end sm:col-span-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              disabled={!client?.id}
            >
              <Pencil className="h-4 w-4" />
              Editar dados
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
