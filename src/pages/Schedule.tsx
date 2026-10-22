import React, { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { tasksService } from '@/services/tasks'
import { clientsService } from '@/services/clients'
import { dealsService } from '@/services/deals'
import { companyService } from '@/services/company'
import type { Task, TaskPriority, TaskStatus, Client, Deal, User } from '@/types/crm'
import {
  CalendarCheck,
  Plus,
  Clock,
  Calendar,
  Building,
  CheckCircle2,
  Circle,
  XCircle,
  Edit,
  Trash2,
  UserCheck,
  Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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

export default function ScheduleTasksPage() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [teamMembers, setTeamMembers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros de Agenda
  const [viewFilter, setViewFilter] = useState<'all' | 'today' | 'week' | 'pending'>('pending')

  // Dialog Criar / Editar
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form State
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formDueDate, setFormDueDate] = useState('')
  const [formDueTime, setFormDueTime] = useState('')
  const [formClientId, setFormClientId] = useState('')
  const [formDealId, setFormDealId] = useState('')
  const [formUserId, setFormUserId] = useState('')
  const [formPriority, setFormPriority] = useState<TaskPriority>('medium')
  const [formStatus, setFormStatus] = useState<TaskStatus>('pending')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [tasksData, clientsData, dealsData, teamData] = await Promise.all([
        tasksService.getAll(),
        clientsService.getAll(),
        dealsService.getAll(),
        companyService.getTeamMembers(),
      ])
      setTasks(tasksData)
      setClients(clientsData)
      setDeals(dealsData)
      setTeamMembers(teamData)
    } catch (err) {
      console.error('Erro ao carregar tarefas:', err)
      toast({
        title: 'Erro',
        description: 'Falha ao buscar agenda de compromissos.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCreate = () => {
    const today = new Date().toISOString().split('T')[0]
    setEditingTask(null)
    setFormTitle('')
    setFormDescription('')
    setFormDueDate(today)
    setFormDueTime('10:00')
    setFormClientId('')
    setFormDealId('')
    setFormUserId(user?.id || '')
    setFormPriority('medium')
    setFormStatus('pending')
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (task: Task) => {
    setEditingTask(task)
    setFormTitle(task.title || '')
    setFormDescription(task.description || '')
    setFormDueDate(task.due_date || '')
    setFormDueTime(task.due_time || '')
    setFormClientId(task.client_id || '')
    setFormDealId(task.deal_id || '')
    setFormUserId(task.user_id || '')
    setFormPriority(task.priority || 'medium')
    setFormStatus(task.status || 'pending')
    setIsDialogOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitle.trim() || !formDueDate) {
      toast({
        title: 'Atenção',
        description: 'Título e data são obrigatórios.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      const payload: Partial<Task> = {
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        due_date: formDueDate,
        due_time: formDueTime || undefined,
        client_id: formClientId || undefined,
        deal_id: formDealId || undefined,
        user_id: formUserId || undefined,
        priority: formPriority,
        status: formStatus,
      }

      if (editingTask) {
        const updated = await tasksService.update(editingTask.id, payload)
        toast({ title: 'Sucesso', description: 'Tarefa atualizada com sucesso!' })
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      } else {
        payload.created_by = user?.id
        const created = await tasksService.create(payload)
        toast({ title: 'Sucesso', description: 'Compromisso agendado com sucesso!' })
        setTasks((prev) => [created, ...prev])
      }

      setIsDialogOpen(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar tarefa',
        description: err.message || 'Verifique os dados preenchidos.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleStatus = async (task: Task) => {
    const nextStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed'
    try {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)))
      await tasksService.updateStatus(task.id, nextStatus)
      toast({
        title: nextStatus === 'completed' ? 'Tarefa Concluída!' : 'Tarefa Reaberta',
        description: task.title,
      })
    } catch {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)))
      toast({
        title: 'Erro',
        description: 'Não foi possível alterar o status.',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir esta tarefa da agenda?')) return
    try {
      await tasksService.delete(id)
      toast({ title: 'Excluído', description: 'Tarefa removida da agenda.' })
      setTasks((prev) => prev.filter((t) => t.id !== id))
    } catch {
      toast({ title: 'Erro', description: 'Falha ao excluir tarefa.', variant: 'destructive' })
    }
  }

  // Filtragem da lista
  const todayStr = new Date().toISOString().split('T')[0]
  const nextWeekDate = new Date()
  nextWeekDate.setDate(nextWeekDate.getDate() + 7)
  const nextWeekStr = nextWeekDate.toISOString().split('T')[0]

  const filteredTasks = tasks.filter((t) => {
    if (viewFilter === 'pending') return t.status === 'pending'
    if (viewFilter === 'today') return t.due_date === todayStr
    if (viewFilter === 'week') return t.due_date >= todayStr && t.due_date <= nextWeekStr
    return true // 'all'
  })

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'high':
        return (
          <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 border-0 text-[10px]">
            Alta
          </Badge>
        )
      case 'medium':
        return (
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-0 text-[10px]">
            Média
          </Badge>
        )
      case 'low':
        return (
          <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 border-0 text-[10px]">
            Baixa
          </Badge>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarCheck className="h-7 w-7 text-blue-600" />
            Agenda & Tarefas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Controle de atividades diárias, lembretes de follow-up e reuniões com clientes.
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-1.5" /> Nova Tarefa
        </Button>
      </div>

      {/* Barra de Filtros de Período */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600 uppercase">Visualizar:</span>
          <div className="flex gap-1.5">
            <Button
              variant={viewFilter === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewFilter('pending')}
              className={viewFilter === 'pending' ? 'bg-blue-600 text-xs h-8' : 'text-xs h-8'}
            >
              Pendentes
            </Button>
            <Button
              variant={viewFilter === 'today' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewFilter('today')}
              className={viewFilter === 'today' ? 'bg-blue-600 text-xs h-8' : 'text-xs h-8'}
            >
              Hoje
            </Button>
            <Button
              variant={viewFilter === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewFilter('week')}
              className={viewFilter === 'week' ? 'bg-blue-600 text-xs h-8' : 'text-xs h-8'}
            >
              Próximos 7 dias
            </Button>
            <Button
              variant={viewFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewFilter('all')}
              className={viewFilter === 'all' ? 'bg-blue-600 text-xs h-8' : 'text-xs h-8'}
            >
              Todas
            </Button>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Exibindo <span className="font-bold text-slate-800">{filteredTasks.length}</span> tarefas
        </div>
      </div>

      {/* Lista de Tarefas */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2"></div>
            <p className="text-sm">Carregando cronograma...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Calendar className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-700">
              Nenhuma tarefa encontrada neste filtro
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Adicione compromissos para não esquecer de retornar para clientes ou realizar
              entregas.
            </p>
            <Button
              onClick={handleOpenCreate}
              size="sm"
              className="mt-4 bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Agendar Tarefa Agora
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredTasks.map((task) => {
              const client = clients.find((c) => c.id === task.client_id) || task.expand?.client_id
              const deal = deals.find((d) => d.id === task.deal_id) || task.expand?.deal_id
              const assignedUser =
                teamMembers.find((m) => m.id === task.user_id) || task.expand?.user_id
              const isOverdue = task.status === 'pending' && task.due_date < todayStr

              return (
                <div
                  key={task.id}
                  className={`p-4 flex items-start justify-between gap-4 transition-colors hover:bg-slate-50/70 ${
                    task.status === 'completed' ? 'bg-slate-50/40 opacity-75' : ''
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Botão de Checkbox */}
                    <button
                      onClick={() => handleToggleStatus(task)}
                      className="mt-0.5 text-slate-400 hover:text-emerald-600 transition-colors shrink-0"
                      title={
                        task.status === 'completed'
                          ? 'Marcar como pendente'
                          : 'Marcar como concluída'
                      }
                    >
                      {task.status === 'completed' ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 fill-emerald-100" />
                      ) : (
                        <Circle className="h-5 w-5 text-slate-300 hover:text-emerald-500" />
                      )}
                    </button>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`font-semibold text-sm ${
                            task.status === 'completed'
                              ? 'line-through text-slate-500'
                              : 'text-slate-900'
                          }`}
                        >
                          {task.title}
                        </span>
                        {getPriorityBadge(task.priority)}
                        {isOverdue && (
                          <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                            Atrasada
                          </Badge>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-xs text-slate-500 line-clamp-2">{task.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {task.due_date} {task.due_time ? `às ${task.due_time}` : ''}
                        </span>

                        {client && (
                          <span className="flex items-center gap-1 text-blue-600 font-medium">
                            <Building className="h-3.5 w-3.5" />
                            {client.name}
                          </span>
                        )}

                        {deal && (
                          <span className="text-slate-400">
                            • Negócio: <span className="text-slate-600">{deal.title}</span>
                          </span>
                        )}

                        {assignedUser && (
                          <span className="flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                            <UserCheck className="h-3 w-3 text-blue-500" />
                            {assignedUser.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ações da Tarefa */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-blue-600"
                      onClick={() => handleOpenEdit(task)}
                      title="Editar Tarefa"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-rose-600"
                      onClick={() => handleDelete(task.id)}
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL CRIAR / EDITAR TAREFA */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Editar Tarefa' : 'Novo Compromisso / Tarefa'}</DialogTitle>
            <DialogDescription>
              Defina a data, horário, cliente e prioridade da atividade.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="task-title">Título da Atividade *</Label>
              <Input
                id="task-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Ex: Ligar para apresentar proposta comercial"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="task-date">Data Limite *</Label>
                <Input
                  id="task-date"
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="task-time">Horário (Opcional)</Label>
                <Input
                  id="task-time"
                  type="time"
                  value={formDueTime}
                  onChange={(e) => setFormDueTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-client">Cliente Vinculado</Label>
              <select
                id="task-client"
                value={formClientId}
                onChange={(e) => setFormClientId(e.target.value)}
                className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
              >
                <option value="">Nenhum (Geral da empresa)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {formClientId && (
              <div className="space-y-1.5">
                <Label htmlFor="task-deal">Oportunidade de Venda Vinculada</Label>
                <select
                  id="task-deal"
                  value={formDealId}
                  onChange={(e) => setFormDealId(e.target.value)}
                  className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
                >
                  <option value="">Nenhum negócio específico</option>
                  {deals
                    .filter((d) => d.client_id === formClientId)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="task-priority">Prioridade</Label>
                <select
                  id="task-priority"
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value as TaskPriority)}
                  className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
                >
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="task-user">Responsável</Label>
                <select
                  id="task-user"
                  value={formUserId}
                  onChange={(e) => setFormUserId(e.target.value)}
                  className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
                >
                  <option value="">Não atribuído</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-desc">Descrição / Detalhes</Label>
              <Textarea
                id="task-desc"
                rows={2}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Pauta da reunião, pontos a negociar..."
              />
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={submitting}>
                {submitting
                  ? 'Salvando...'
                  : editingTask
                    ? 'Atualizar Tarefa'
                    : 'Salvar Compromisso'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
