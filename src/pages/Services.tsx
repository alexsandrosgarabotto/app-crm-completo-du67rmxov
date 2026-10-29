import React, { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { servicesCatalogService } from '@/services/servicesCatalog'
import type { Service } from '@/types/crm'
import {
  Wrench,
  Plus,
  Search,
  Clock,
  DollarSign,
  Percent,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  Tag,
  Briefcase,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'

export default function ServicesPage() {
  const { user } = useAuth()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // Modal Criar / Editar Serviço
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form State
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formPrice, setFormPrice] = useState('')
  const [formDuration, setFormDuration] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formIssRate, setFormIssRate] = useState('')
  const [formActive, setFormActive] = useState(true)

  useEffect(() => {
    loadServices()
  }, [])

  const loadServices = async () => {
    setLoading(true)
    try {
      const data = await servicesCatalogService.getAll()
      setServices(data)
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os serviços cadastrados.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const categories = Array.from(
    new Set(services.map((s) => s.category).filter(Boolean) as string[]),
  )

  const filteredServices = services.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.description && s.description.toLowerCase().includes(search.toLowerCase())) ||
      (s.category && s.category.toLowerCase().includes(search.toLowerCase()))

    const matchesCategory = categoryFilter === 'all' || s.category === categoryFilter

    return matchesSearch && matchesCategory
  })

  const handleOpenCreate = () => {
    setEditingService(null)
    setFormName('')
    setFormDesc('')
    setFormPrice('')
    setFormDuration('60')
    setFormCategory('')
    setFormIssRate('5')
    setFormActive(true)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (s: Service) => {
    setEditingService(s)
    setFormName(s.name || '')
    setFormDesc(s.description || '')
    setFormPrice(s.price !== undefined ? s.price.toString() : '')
    setFormDuration(s.duration_minutes !== undefined ? s.duration_minutes.toString() : '60')
    setFormCategory(s.category || '')
    setFormIssRate(s.iss_rate !== undefined ? s.iss_rate.toString() : '5')
    setFormActive(s.active !== false)
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) {
      toast({
        title: 'Atenção',
        description: 'O nome do serviço é obrigatório.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      const payload: Partial<Service> = {
        name: formName.trim(),
        description: formDesc.trim() || undefined,
        price: formPrice ? parseFloat(formPrice) : 0,
        duration_minutes: formDuration ? parseInt(formDuration) : 0,
        category: formCategory.trim() || undefined,
        iss_rate: formIssRate ? parseFloat(formIssRate) : 0,
        active: formActive,
      }

      if (editingService) {
        const updated = await servicesCatalogService.update(editingService.id, payload)
        setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
        toast({ title: 'Sucesso', description: 'Serviço atualizado!' })
      } else {
        payload.created_by = user?.id
        const created = await servicesCatalogService.create(payload)
        setServices((prev) => [created, ...prev])
        toast({ title: 'Sucesso', description: 'Novo serviço adicionado ao catálogo!' })
      }

      setIsModalOpen(false)
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao salvar serviço',
        description: err.message || 'Verifique os dados preenchidos.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este serviço?')) return
    try {
      await servicesCatalogService.delete(id)
      setServices((prev) => prev.filter((s) => s.id !== id))
      toast({ title: 'Excluído', description: 'Serviço removido do catálogo.' })
    } catch {
      toast({ title: 'Erro', description: 'Falha ao remover o serviço.', variant: 'destructive' })
    }
  }

  const formatCurrency = (val?: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  const formatDuration = (min?: number) => {
    if (!min) return 'Sob demanda'
    if (min < 60) return `${min} min`
    const hours = Math.floor(min / 60)
    const remMin = min % 60
    return remMin > 0 ? `${hours}h ${remMin}m` : `${hours}h`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Wrench className="h-7 w-7 text-blue-600" />
            Catálogo de Serviços
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Cadastre consultorias, manutenções, implantações e cobranças via NFS-e municipal.
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-1.5" /> Novo Serviço
        </Button>
      </div>

      {/* Busca e Filtro */}
      <Card className="border-slate-200 shadow-2xs">
        <CardContent className="p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar serviço por nome, descrição ou categoria..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
          >
            <option value="all">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Grid de Serviços (Cards) */}
      {loading ? (
        <div className="p-16 text-center text-slate-400">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2"></div>
          <p>Carregando catálogo de serviços...</p>
        </div>
      ) : filteredServices.length === 0 ? (
        <Card className="border-dashed border-2 p-12 text-center text-slate-400">
          Nenhum serviço encontrado. Clique em "Novo Serviço" para adicionar itens ao catálogo.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map((s) => (
            <Card
              key={s.id}
              className="border-slate-200 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900 leading-snug">
                      {s.name}
                    </CardTitle>
                    {s.category && (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium mt-0.5">
                        <Tag className="h-3 w-3" />
                        {s.category}
                      </span>
                    )}
                  </div>
                  <Badge
                    variant={s.active !== false ? 'secondary' : 'outline'}
                    className={
                      s.active !== false
                        ? 'bg-emerald-50 text-emerald-700 text-[10px]'
                        : 'text-slate-400 text-[10px]'
                    }
                  >
                    {s.active !== false ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-4 pt-1 space-y-3">
                {s.description && (
                  <p className="text-xs text-slate-500 line-clamp-2">{s.description}</p>
                )}

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Preço padrão</span>
                    <span className="text-base font-extrabold text-blue-700">
                      {formatCurrency(s.price)}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Duração estimada</span>
                    <span className="font-semibold text-slate-700 flex items-center gap-1 mt-0.5">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {formatDuration(s.duration_minutes)}
                    </span>
                  </div>
                </div>

                {s.iss_rate !== undefined && s.iss_rate > 0 && (
                  <div className="text-[11px] text-slate-500 bg-slate-50 px-2 py-1 rounded flex items-center justify-between">
                    <span>Alíquota ISS (NFS-e municipal):</span>
                    <span className="font-bold text-slate-700">{s.iss_rate}%</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEdit(s)}
                    className="h-8 text-xs text-slate-600 hover:text-blue-600"
                  >
                    <Edit className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(s.id)}
                    className="h-8 text-xs text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* MODAL CRIAR / EDITAR SERVIÇO */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingService ? 'Editar Serviço' : 'Novo Serviço no Catálogo'}
            </DialogTitle>
            <DialogDescription>
              Defina o nome, valor de cobrança, duração e alíquota de ISS para NFS-e.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-3.5 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="srv-name">Nome do Serviço *</Label>
              <Input
                id="srv-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Consultoria de Gestão, Implantação de Sistema..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="srv-category">Categoria</Label>
                <Input
                  id="srv-category"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="Ex: Consultoria, Suporte..."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="srv-price">Preço Padrão (R$)</Label>
                <Input
                  id="srv-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="srv-duration">Duração Estimada (minutos)</Label>
                <Input
                  id="srv-duration"
                  type="number"
                  step="1"
                  min="0"
                  value={formDuration}
                  onChange={(e) => setFormDuration(e.target.value)}
                  placeholder="60"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="srv-iss">Alíquota ISS (%)</Label>
                <Input
                  id="srv-iss"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formIssRate}
                  onChange={(e) => setFormIssRate(e.target.value)}
                  placeholder="5"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="srv-desc">Descrição do Escopo do Serviço</Label>
              <Textarea
                id="srv-desc"
                rows={2}
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="O que está incluso na prestação deste serviço..."
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="srv-active"
                checked={formActive}
                onChange={(e) => setFormActive(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <Label htmlFor="srv-active" className="text-sm font-medium cursor-pointer">
                Serviço ativo para novas propostas de venda
              </Label>
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={submitting}>
                {submitting
                  ? 'Salvando...'
                  : editingService
                    ? 'Atualizar Serviço'
                    : 'Cadastrar Serviço'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
