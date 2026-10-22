import React, { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { clientsService } from '@/services/clients'
import { companyService } from '@/services/company'
import type { Client, User } from '@/types/crm'
import {
  Users,
  Plus,
  Search,
  Mail,
  Phone,
  Building,
  MapPin,
  Edit,
  Trash2,
  FileText,
  UserCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'

export default function ClientsPage() {
  const { user } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [teamMembers, setTeamMembers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Modal de Criar/Editar
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Ficha Detalhada do Cliente (Drawer/Sheet)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  // Form State
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formDocument, setFormDocument] = useState('')
  const [formCompany, setFormCompany] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formCity, setFormCity] = useState('')
  const [formState, setFormState] = useState('')
  const [formStatus, setFormStatus] = useState<'lead' | 'active' | 'inactive'>('active')
  const [formAssignedTo, setFormAssignedTo] = useState('')
  const [formNotes, setFormNotes] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [clientsData, teamData] = await Promise.all([
        clientsService.getAll(),
        companyService.getTeamMembers(),
      ])
      setClients(clientsData)
      setTeamMembers(teamData)
    } catch (err) {
      console.error('Erro ao carregar clientes:', err)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar a lista de clientes.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCreate = () => {
    setEditingClient(null)
    setFormName('')
    setFormEmail('')
    setFormPhone('')
    setFormDocument('')
    setFormCompany('')
    setFormAddress('')
    setFormCity('')
    setFormState('')
    setFormStatus('active')
    setFormAssignedTo(user?.id || '')
    setFormNotes('')
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (client: Client, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setEditingClient(client)
    setFormName(client.name || '')
    setFormEmail(client.email || '')
    setFormPhone(client.phone || '')
    setFormDocument(client.document || '')
    setFormCompany(client.company || '')
    setFormAddress(client.address || '')
    setFormCity(client.city || '')
    setFormState(client.state || '')
    setFormStatus(client.status || 'active')
    setFormAssignedTo(client.assigned_to || '')
    setFormNotes(client.notes || '')
    setIsDialogOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) {
      toast({
        title: 'Atenção',
        description: 'O nome do cliente é obrigatório.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      const payload: Partial<Client> = {
        name: formName.trim(),
        email: formEmail.trim() || undefined,
        phone: formPhone.trim() || undefined,
        document: formDocument.trim() || undefined,
        company: formCompany.trim() || undefined,
        address: formAddress.trim() || undefined,
        city: formCity.trim() || undefined,
        state: formState.trim() || undefined,
        status: formStatus,
        assigned_to: formAssignedTo || undefined,
        notes: formNotes.trim() || undefined,
      }

      if (editingClient) {
        const updated = await clientsService.update(editingClient.id, payload)
        toast({ title: 'Sucesso', description: 'Cliente atualizado com sucesso!' })
        setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
        if (selectedClient?.id === updated.id) {
          setSelectedClient(updated)
        }
      } else {
        payload.created_by = user?.id
        const created = await clientsService.create(payload)
        toast({ title: 'Sucesso', description: 'Cliente cadastrado com sucesso!' })
        setClients((prev) => [created, ...prev])
      }

      setIsDialogOpen(false)
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Ocorreu um erro ao salvar o cliente.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (
      !window.confirm(
        'Tem certeza que deseja excluir este cliente? Todas as vendas vinculadas poderão ser afetadas.',
      )
    ) {
      return
    }

    try {
      await clientsService.delete(id)
      toast({ title: 'Sucesso', description: 'Cliente removido.' })
      setClients((prev) => prev.filter((c) => c.id !== id))
      if (selectedClient?.id === id) {
        setIsDetailsOpen(false)
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir',
        description: 'Você não tem permissão ou o cliente possui registros dependentes.',
        variant: 'destructive',
      })
    }
  }

  const handleOpenDetails = (client: Client) => {
    setSelectedClient(client)
    setIsDetailsOpen(true)
  }

  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
      (c.company && c.company.toLowerCase().includes(search.toLowerCase())) ||
      (c.phone && c.phone.includes(search))

    const matchesStatus = statusFilter === 'all' || c.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0">
            Ativo
          </Badge>
        )
      case 'lead':
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-0">
            Lead / Prospect
          </Badge>
        )
      case 'inactive':
        return (
          <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 border-0">Inativo</Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="h-7 w-7 text-blue-600" />
            Clientes & Contatos
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Cadastre, edite e consulte a ficha cadastral de cada cliente.
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-1.5" /> Novo Cliente
        </Button>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome, e-mail, telefone ou empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs font-medium text-slate-500">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 text-sm rounded-md border border-input bg-background px-3 py-1 shadow-xs"
          >
            <option value="all">Todos os Status</option>
            <option value="active">Ativos</option>
            <option value="lead">Leads / Prospects</option>
            <option value="inactive">Inativos</option>
          </select>
        </div>
      </div>

      {/* Listagem em Tabela / Cards */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2"></div>
            <p className="text-sm">Carregando carteira de clientes...</p>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-700">Nenhum cliente encontrado</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {search
                ? 'Tente ajustar os termos de pesquisa ou filtros aplicados.'
                : 'Cadastre seu primeiro cliente para gerenciar negociações e tarefas.'}
            </p>
            {!search && (
              <Button
                onClick={handleOpenCreate}
                size="sm"
                className="mt-4 bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-1.5" /> Adicionar Cliente Agora
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Cliente / Razão</th>
                  <th className="py-3 px-4">Contato</th>
                  <th className="py-3 px-4">Localização</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Responsável</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.map((client) => {
                  const assignedUser = teamMembers.find((m) => m.id === client.assigned_to)
                  return (
                    <tr
                      key={client.id}
                      onClick={() => handleOpenDetails(client)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        <div>{client.name}</div>
                        {client.company && (
                          <div className="text-xs text-slate-400 font-normal flex items-center gap-1 mt-0.5">
                            <Building className="h-3 w-3" /> {client.company}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {client.email && (
                          <div className="text-xs flex items-center gap-1.5 text-slate-600">
                            <Mail className="h-3.5 w-3.5 text-slate-400" /> {client.email}
                          </div>
                        )}
                        {client.phone && (
                          <div className="text-xs flex items-center gap-1.5 text-slate-600 mt-1">
                            <Phone className="h-3.5 w-3.5 text-slate-400" /> {client.phone}
                          </div>
                        )}
                        {!client.email && !client.phone && (
                          <span className="text-xs text-slate-400 italic">Sem contato direto</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 text-xs">
                        {client.city || client.state ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            {[client.city, client.state].filter(Boolean).join(' - ')}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">{getStatusBadge(client.status)}</td>
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {assignedUser ? (
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md font-medium">
                            <UserCheck className="h-3 w-3 text-blue-600" />
                            {assignedUser.name}
                          </span>
                        ) : (
                          <span className="text-slate-400">Não atribuído</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-blue-600"
                            onClick={(e) => handleOpenEdit(client, e)}
                            title="Editar"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-rose-600"
                            onClick={(e) => handleDelete(client.id, e)}
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE CADASTRO / EDIÇÃO */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingClient ? 'Editar Cadastro de Cliente' : 'Novo Cliente'}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados cadastrais, informações de contato e vínculo da equipe.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="client-name">Nome / Razão Social *</Label>
                <Input
                  id="client-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: João da Silva ou Empresa ABC Ltda"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client-company">Nome Fantasia / Empresa</Label>
                <Input
                  id="client-company"
                  value={formCompany}
                  onChange={(e) => setFormCompany(e.target.value)}
                  placeholder="Ex: Grupo ABC"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client-doc">CPF ou CNPJ</Label>
                <Input
                  id="client-doc"
                  value={formDocument}
                  onChange={(e) => setFormDocument(e.target.value)}
                  placeholder="00.000.000/0001-00"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client-email">E-mail de Contato</Label>
                <Input
                  id="client-email"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="contato@cliente.com"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client-phone">Telefone / WhatsApp</Label>
                <Input
                  id="client-phone"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="(00) 90000-0000"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="client-address">Endereço Completo</Label>
                <Input
                  id="client-address"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Rua, número, complemento, bairro"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client-city">Cidade</Label>
                <Input
                  id="client-city"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  placeholder="São Paulo"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client-state">Estado (UF)</Label>
                <Input
                  id="client-state"
                  value={formState}
                  onChange={(e) => setFormState(e.target.value)}
                  placeholder="SP"
                  maxLength={2}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client-status">Status do Cliente</Label>
                <select
                  id="client-status"
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
                >
                  <option value="active">Ativo (Cliente da Carteira)</option>
                  <option value="lead">Lead (Em Prospecção)</option>
                  <option value="inactive">Inativo (Sem Compras Recentes)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client-assigned">Responsável Comercial</Label>
                <select
                  id="client-assigned"
                  value={formAssignedTo}
                  onChange={(e) => setFormAssignedTo(e.target.value)}
                  className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
                >
                  <option value="">Não atribuído</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role === 'owner' ? 'Dono' : 'Vendedor'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="client-notes">Observações Gerais</Label>
                <Textarea
                  id="client-notes"
                  rows={3}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Preferências do cliente, histórico de conversas, particularidades..."
                />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={submitting}>
                {submitting
                  ? 'Salvando...'
                  : editingClient
                    ? 'Atualizar Cliente'
                    : 'Cadastrar Cliente'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* FICHA DETALHADA DO CLIENTE (SHEET / DRAWER) */}
      <Sheet open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedClient && (
            <div className="space-y-6">
              <SheetHeader className="text-left border-b pb-4">
                <div className="flex items-center justify-between">
                  {getStatusBadge(selectedClient.status)}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      setIsDetailsOpen(false)
                      handleOpenEdit(selectedClient)
                    }}
                  >
                    <Edit className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                </div>
                <SheetTitle className="text-xl font-bold text-slate-900 mt-2">
                  {selectedClient.name}
                </SheetTitle>
                {selectedClient.company && (
                  <SheetDescription className="text-sm font-medium text-slate-600 flex items-center gap-1">
                    <Building className="h-3.5 w-3.5" /> {selectedClient.company}
                  </SheetDescription>
                )}
              </SheetHeader>

              {/* Informações de Contato */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Contato & Documentos
                </h3>
                <div className="rounded-lg bg-slate-50 p-3 space-y-2 text-sm border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 text-xs">E-mail:</span>
                    <span className="font-medium text-slate-800">
                      {selectedClient.email || 'Não informado'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 text-xs">Telefone:</span>
                    <span className="font-medium text-slate-800">
                      {selectedClient.phone || 'Não informado'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 text-xs">CPF/CNPJ:</span>
                    <span className="font-mono text-xs text-slate-800">
                      {selectedClient.document || 'Não informado'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Localização */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Endereço
                </h3>
                <div className="rounded-lg bg-slate-50 p-3 space-y-1.5 text-sm border border-slate-100">
                  <p className="text-slate-800">
                    {selectedClient.address || 'Endereço não cadastrado'}
                  </p>
                  {(selectedClient.city || selectedClient.state) && (
                    <p className="text-xs text-slate-500">
                      {[selectedClient.city, selectedClient.state].filter(Boolean).join(' - ')}
                    </p>
                  )}
                </div>
              </div>

              {/* Responsável */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Equipe Responsável
                </h3>
                <div className="rounded-lg bg-slate-50 p-3 text-sm border border-slate-100">
                  <p className="text-slate-800 font-medium">
                    {teamMembers.find((m) => m.id === selectedClient.assigned_to)?.name ||
                      'Nenhum membro atribuído'}
                  </p>
                </div>
              </div>

              {/* Observações */}
              {selectedClient.notes && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" /> Observações & Histórico
                  </h3>
                  <div className="rounded-lg bg-amber-50/50 p-3 text-xs text-slate-700 border border-amber-200/60 whitespace-pre-wrap leading-relaxed">
                    {selectedClient.notes}
                  </div>
                </div>
              )}

              {/* Ações Rápidas */}
              <div className="pt-4 border-t flex flex-col gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(selectedClient.id)}
                  className="w-full text-xs"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir Cliente
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
