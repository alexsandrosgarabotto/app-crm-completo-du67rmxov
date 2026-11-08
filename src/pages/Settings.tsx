import React, { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { companyService } from '@/services/company'
import { whatsappTemplatesService } from '@/services/whatsappTemplates'
import type { CompanySettings, User, WhatsAppTemplateKey } from '@/types/crm'
import {
  Building2,
  Users,
  ShieldCheck,
  UserCheck,
  Plus,
  Mail,
  Phone,
  Save,
  Trash2,
  MessageSquareText,
  Bot,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { PhoneNumberIdCard } from '@/components/whatsapp/PhoneNumberIdCard'
import { ZenviaIntegrationCard } from '@/components/whatsapp/ZenviaIntegrationCard'

const templateMeta: Record<WhatsAppTemplateKey, { title: string; hint: string }> = {
  greeting: {
    title: 'Mensagem de saudação',
    hint: 'Enviada automaticamente sempre que o cliente manda uma mensagem. A mensagem de menu é enviada logo em seguida.',
  },
  menu: {
    title: 'Mensagem de menu',
    hint: 'Lista de opções iniciais mostrada ao cliente logo após a saudação. Use quebras de linha para separar as opções.',
  },
}

const templateVariables: { key: string; description: string }[] = [
  { key: '{{nome}}', description: 'Primeiro nome do cliente (ex: ", João")' },
  { key: '{{nome_completo}}', description: 'Nome completo do cliente cadastrado' },
  { key: '{{saudacao}}', description: 'Bom dia / Boa tarde / Boa noite, conforme o horário' },
  { key: '{{telefone}}', description: 'Telefone do cliente formatado' },
]

function AutomaticMessagesTab() {
  const [templates, setTemplates] = useState<Record<WhatsAppTemplateKey, string>>({
    greeting: '',
    menu: '',
  })
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<WhatsAppTemplateKey | null>(null)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const list = await whatsappTemplatesService.getAll()
      const next = { greeting: '', menu: '' }
      for (const tpl of list) {
        if (tpl.key === 'greeting' || tpl.key === 'menu') next[tpl.key] = tpl.body || ''
      }
      setTemplates(next)
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro',
        description: 'Falha ao carregar as mensagens automáticas.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (key: WhatsAppTemplateKey) => {
    if (!templates[key].trim()) {
      toast({
        title: 'Atenção',
        description: 'A mensagem não pode ficar vazia.',
        variant: 'destructive',
      })
      return
    }
    setSavingKey(key)
    try {
      await whatsappTemplatesService.save(key, templates[key])
      toast({
        title: 'Mensagem salva!',
        description: 'As próximas respostas automáticas já usam este texto.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Verifique as permissões de acesso.',
        variant: 'destructive',
      })
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-start gap-3">
        <Bot className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
        <div>
          <h3 className="font-bold text-slate-800 text-base">Mensagens automáticas do WhatsApp</h3>
          <p className="text-xs text-slate-500">
            Edite a qualquer momento os textos enviados automaticamente no atendimento. Use as
            variáveis abaixo para personalizar cada mensagem com os dados do cliente.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {templateVariables.map((v) => (
              <Badge
                key={v.key}
                variant="outline"
                className="bg-blue-50 text-blue-700 border-blue-200 font-mono text-[11px]"
                title={v.description}
              >
                {v.key} — {v.description}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <PhoneNumberIdCard />

      <ZenviaIntegrationCard />

      {loading ? (
        <div className="p-10 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2"></div>
          <p className="text-sm">Carregando mensagens...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(Object.keys(templateMeta) as WhatsAppTemplateKey[]).map((key) => (
            <Card key={key} className="border-slate-200 shadow-xs">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquareText className="h-4 w-4 text-blue-600" />
                  {templateMeta[key].title}
                </CardTitle>
                <CardDescription>{templateMeta[key].hint}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={templates[key]}
                  onChange={(e) => setTemplates((prev) => ({ ...prev, [key]: e.target.value }))}
                  rows={key === 'menu' ? 8 : 4}
                  placeholder="Digite o texto da mensagem..."
                  className="font-mono text-xs"
                />
                <div className="flex justify-end">
                  <Button
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => handleSave(key)}
                    disabled={savingKey === key}
                  >
                    <Save className="h-4 w-4 mr-1.5" />
                    {savingKey === key ? 'Salvando...' : 'Salvar mensagem'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'company' | 'team' | 'auto-messages'>('company')

  // Empresa
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [name, setName] = useState('')
  const [tradeName, setTradeName] = useState('')
  const [documentNumber, setDocumentNumber] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [website, setWebsite] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)

  // Equipe
  const [team, setTeam] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  // Modal Convidar Membro
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePhone, setInvitePhone] = useState('')
  const [inviteRole, setInviteRole] = useState<'owner' | 'seller'>('seller')
  const [submittingInvite, setSubmittingInvite] = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [compData, teamData] = await Promise.all([
        companyService.getSettings(),
        companyService.getTeamMembers(),
      ])

      if (compData) {
        setSettings(compData)
        setName(compData.name || '')
        setTradeName(compData.trade_name || '')
        setDocumentNumber(compData.document || '')
        setEmail(compData.email || '')
        setPhone(compData.phone || '')
        setAddress(compData.address || '')
        setWebsite(compData.website || '')
      }

      setTeam(teamData)
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro',
        description: 'Falha ao carregar configurações.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast({
        title: 'Atenção',
        description: 'A Razão Social é obrigatória.',
        variant: 'destructive',
      })
      return
    }

    setSavingSettings(true)
    try {
      const payload: Partial<CompanySettings> = {
        name: name.trim(),
        trade_name: tradeName.trim() || undefined,
        document: documentNumber.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        website: website.trim() || undefined,
      }

      if (settings?.id) {
        const updated = await companyService.updateSettings(settings.id, payload)
        setSettings(updated)
        toast({ title: 'Sucesso', description: 'Dados da empresa salvos com sucesso!' })
      } else {
        const created = await companyService.createSettings(payload)
        setSettings(created)
        toast({ title: 'Sucesso', description: 'Dados da empresa cadastrados!' })
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar empresa',
        description: err.message || 'Verifique as permissões de acesso.',
        variant: 'destructive',
      })
    } finally {
      setSavingSettings(false)
    }
  }

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteName.trim() || !inviteEmail.trim()) {
      toast({
        title: 'Atenção',
        description: 'Nome e e-mail são obrigatórios.',
        variant: 'destructive',
      })
      return
    }

    setSubmittingInvite(true)
    try {
      const newMember = await companyService.inviteOrAddMember({
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
        phone: invitePhone.trim() || undefined,
      })

      toast({
        title: 'Colaborador adicionado!',
        description: `E-mail de acesso e instruções enviados para ${inviteEmail}.`,
      })
      setTeam((prev) => [...prev, newMember])
      setIsInviteOpen(false)
      setInviteName('')
      setInviteEmail('')
      setInvitePhone('')
      setInviteRole('seller')
    } catch (err: any) {
      toast({
        title: 'Erro ao convidar membro',
        description: err.message || 'Este e-mail já pode estar cadastrado na plataforma.',
        variant: 'destructive',
      })
    } finally {
      setSubmittingInvite(false)
    }
  }

  const handleToggleRole = async (member: User) => {
    if (member.id === user?.id) {
      toast({
        title: 'Atenção',
        description: 'Você não pode alterar seu próprio papel.',
        variant: 'destructive',
      })
      return
    }
    const nextRole = member.role === 'owner' ? 'seller' : 'owner'
    try {
      setTeam((prev) => prev.map((m) => (m.id === member.id ? { ...m, role: nextRole } : m)))
      await companyService.updateUserRole(member.id, nextRole)
      toast({
        title: 'Papel atualizado',
        description: `${member.name} agora é ${nextRole === 'owner' ? 'Dono' : 'Vendedor'}.`,
      })
    } catch {
      setTeam((prev) => prev.map((m) => (m.id === member.id ? { ...m, role: member.role } : m)))
      toast({
        title: 'Erro',
        description: 'Não foi possível alterar o papel.',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteMember = async (member: User) => {
    if (member.id === user?.id) {
      toast({
        title: 'Atenção',
        description: 'Você não pode excluir a sua própria conta.',
        variant: 'destructive',
      })
      return
    }

    if (!window.confirm(`Tem certeza que deseja remover o membro "${member.name}" da equipe?`))
      return

    try {
      await companyService.deleteTeamMember(member.id)
      toast({ title: 'Membro removido', description: 'Colaborador desconectado do sistema.' })
      setTeam((prev) => prev.filter((m) => m.id !== member.id))
    } catch {
      toast({ title: 'Erro', description: 'Falha ao remover colaborador.', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Building2 className="h-7 w-7 text-blue-600" />
          Configurações da Empresa & Equipe
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Gerencie os dados cadastrais do seu negócio e controle os membros da equipe e permissões.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)}>
        <TabsList className="grid w-full lg:w-fit grid-cols-2 lg:grid-cols-3 gap-1">
          <TabsTrigger value="company" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Dados da Empresa
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Gestão da Equipe ({team.length})
          </TabsTrigger>
          <TabsTrigger value="auto-messages" className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4" /> Mensagens Automáticas
          </TabsTrigger>
        </TabsList>

        {/* ABA: DADOS DA EMPRESA */}
        <TabsContent value="company" className="pt-4">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader>
              <CardTitle className="text-lg">Perfil do Negócio</CardTitle>
              <CardDescription>
                Informações cadastrais e de contato exibidas nas faturas e propostas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveCompany} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="company-name">Razão Social *</Label>
                    <Input
                      id="company-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Minha Empresa Soluções LTDA"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="company-trade">Nome Fantasia</Label>
                    <Input
                      id="company-trade"
                      value={tradeName}
                      onChange={(e) => setTradeName(e.target.value)}
                      placeholder="Ex: Marca Comercial"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="company-doc">CNPJ</Label>
                    <Input
                      id="company-doc"
                      value={documentNumber}
                      onChange={(e) => setDocumentNumber(e.target.value)}
                      placeholder="00.000.000/0001-00"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="company-email">E-mail Comercial</Label>
                    <Input
                      id="company-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contato@minhaempresa.com.br"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="company-phone">Telefone Principal</Label>
                    <Input
                      id="company-phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(11) 3000-0000"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="company-web">Website Institucional</Label>
                    <Input
                      id="company-web"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://minhaempresa.com.br"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="company-addr">Endereço Comercial</Label>
                    <Input
                      id="company-addr"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Av. Paulista, 1000 - São Paulo, SP"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t flex justify-end">
                  <Button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={savingSettings}
                  >
                    <Save className="h-4 w-4 mr-1.5" />
                    {savingSettings ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: GESTÃO DA EQUIPE */}
        <TabsContent value="team" className="pt-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Membros e Vendedores</h3>
              <p className="text-xs text-slate-500">
                Cada colaborador possui seu login individual e gerencia seus próprios clientes e
                vendas.
              </p>
            </div>
            <Button onClick={() => setIsInviteOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-1.5" /> Convidar Colaborador
            </Button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            {loading ? (
              <div className="p-10 text-center text-slate-500">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2"></div>
                <p className="text-sm">Carregando membros da equipe...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                    <tr>
                      <th className="py-3 px-4">Nome</th>
                      <th className="py-3 px-4">E-mail</th>
                      <th className="py-3 px-4">Telefone</th>
                      <th className="py-3 px-4">Papel / Nível</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {team.map((member) => (
                      <tr key={member.id} className="hover:bg-slate-50/70">
                        <td className="py-3.5 px-4 font-medium text-slate-900">
                          {member.name}
                          {member.id === user?.id && (
                            <span className="ml-2 text-[10px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded">
                              Você
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 text-xs">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-slate-400" />
                            {member.email}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 text-xs">
                          {member.phone ? (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-slate-400" />
                              {member.phone}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {member.role === 'owner' ? (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-0 text-xs">
                              <ShieldCheck className="h-3.5 w-3.5 mr-1 inline" /> Dono (Acesso
                              Total)
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 border-0 text-xs">
                              <UserCheck className="h-3.5 w-3.5 mr-1 inline" /> Vendedor (Seus
                              Dados)
                            </Badge>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {member.id !== user?.id && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs text-blue-600 h-8"
                                  onClick={() => handleToggleRole(member)}
                                >
                                  Mudar para {member.role === 'owner' ? 'Vendedor' : 'Dono'}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                  onClick={() => handleDeleteMember(member)}
                                  title="Remover da equipe"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ABA: MENSAGENS AUTOMÁTICAS */}
        <TabsContent value="auto-messages" className="pt-4">
          <AutomaticMessagesTab />
        </TabsContent>
      </Tabs>

      {/* MODAL CONVIDAR MEMBRO */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar Membro da Equipe</DialogTitle>
            <DialogDescription>
              O novo colaborador receberá as instruções por e-mail para definir sua senha e acessar
              o CRM.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleInviteMember} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="inv-name">Nome do Colaborador *</Label>
              <Input
                id="inv-name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Ex: João Silva"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inv-email">E-mail Profissional *</Label>
              <Input
                id="inv-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="joao@minhaempresa.com"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inv-phone">Telefone / WhatsApp</Label>
              <Input
                id="inv-phone"
                value={invitePhone}
                onChange={(e) => setInvitePhone(e.target.value)}
                placeholder="(00) 90000-0000"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inv-role">Papel e Permissões</Label>
              <select
                id="inv-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as any)}
                className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
              >
                <option value="seller">Vendedor (visualiza apenas seus clientes e vendas)</option>
                <option value="owner">Dono / Gestor (visualiza tudo e gerencia equipe)</option>
              </select>
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={submittingInvite}
              >
                {submittingInvite ? 'Enviando convite...' : 'Enviar Convite'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
