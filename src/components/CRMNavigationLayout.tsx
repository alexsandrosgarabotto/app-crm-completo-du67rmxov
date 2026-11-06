import React, { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import {
  LayoutDashboard,
  Users,
  Kanban,
  Boxes,
  Wrench,
  Receipt,
  CalendarCheck,
  ReceiptText,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Building2,
  ShieldCheck,
  UserCheck,
  DollarSign,
  Wallet,
  MessageCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export default function CRMNavigationLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    signOut()
    navigate('/login')
  }

  const navItems = [
    { title: 'Painel', path: '/dashboard', icon: LayoutDashboard },
    { title: 'Clientes', path: '/clientes', icon: Users },
    { title: 'Vendas (Pipeline)', path: '/vendas', icon: Kanban },
    { title: 'Estoque', path: '/estoque', icon: Boxes },
    { title: 'Serviços', path: '/servicos', icon: Wrench },
    { title: 'Notas Fiscais', path: '/notas-fiscais', icon: Receipt },
    { title: 'Atendimentos', path: '/atendimentos', icon: MessageCircle },
    { title: 'Agenda & Tarefas', path: '/agenda', icon: CalendarCheck },
    { title: 'Financeiro', path: '/financeiro', icon: ReceiptText },
    { title: 'Caixa', path: '/financeiro?aba=caixa', icon: Wallet },
    { title: 'Custos Fixos', path: '/financeiro?aba=custos-fixos', icon: DollarSign },
    { title: 'Relatórios', path: '/relatorios', icon: BarChart3 },
    ...(user?.role === 'owner'
      ? [{ title: 'Configurações & Equipe', path: '/configuracoes', icon: Settings }]
      : []),
  ]

  const getInitials = (name?: string) => {
    if (!name) return 'U'
    const parts = name.trim().split(' ')
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return name.substring(0, 2).toUpperCase()
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar para Desktop */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-slate-200 bg-white shadow-sm shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-slate-100 gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-bold text-slate-800 leading-tight">CRM Empresa</h1>
            <p className="text-xs text-slate-400">Gestão & Vendas</p>
          </div>
        </div>

        <div className="p-4 flex-1 space-y-1">
          <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Menu Principal
          </p>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/financeiro'}
                className={({ isActive }) => {
                  const currentFull = window.location.pathname + window.location.search
                  const isItemActive = item.path.includes('?')
                    ? currentFull === item.path
                    : isActive && !window.location.search.includes('aba=')
                  return cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isItemActive
                      ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                  )
                }}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.title}</span>
              </NavLink>
            )
          })}
        </div>

        {/* Rodapé do Usuário na Sidebar */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar className="h-9 w-9 border border-slate-200">
                <AvatarFallback className="bg-blue-100 text-blue-700 font-medium text-xs">
                  {getInitials(user?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate leading-snug">
                  {user?.name || 'Usuário'}
                </p>
                <div className="flex items-center gap-1">
                  {user?.role === 'owner' ? (
                    <Badge
                      variant="secondary"
                      className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0 font-normal"
                    >
                      <ShieldCheck className="h-3 w-3 mr-0.5 inline" /> Dono
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0 font-normal"
                    >
                      <UserCheck className="h-3 w-3 mr-0.5 inline" /> Vendedor
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 text-xs h-8"
          >
            <LogOut className="h-3.5 w-3.5 mr-2" />
            Sair do CRM
          </Button>
        </div>
      </aside>

      {/* Container Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Superior Mobile / Tablet */}
        <header className="h-16 border-b border-slate-200 bg-white px-4 flex items-center justify-between lg:hidden sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-md bg-blue-600 flex items-center justify-center text-white">
              <Building2 className="h-4 w-4" />
            </div>
            <span className="font-bold text-slate-800 text-base">CRM Empresa</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Abrir menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </header>

        {/* Menu Mobile Overlay */}
        {mobileOpen && (
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/40 flex"
            onClick={() => setMobileOpen(false)}
          >
            <div
              className="w-4/5 max-w-xs bg-white h-full flex flex-col shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-md bg-blue-600 flex items-center justify-center text-white">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <span className="font-bold text-slate-800">CRM Empresa</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="p-4 flex-1 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/financeiro'}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) => {
                        const currentFull = window.location.pathname + window.location.search
                        const isItemActive = item.path.includes('?')
                          ? currentFull === item.path
                          : isActive && !window.location.search.includes('aba=')
                        return cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                          isItemActive
                            ? 'bg-blue-50 text-blue-700 font-semibold'
                            : 'text-slate-600 hover:bg-slate-50',
                        )
                      }}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.title}</span>
                    </NavLink>
                  )
                })}
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50">
                <div className="flex items-center gap-2 mb-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-blue-100 text-blue-700 font-medium text-xs">
                      {getInitials(user?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{user?.name}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="w-full text-red-600 hover:bg-red-50 text-xs"
                >
                  <LogOut className="h-3.5 w-3.5 mr-2" />
                  Sair do sistema
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Conteúdo da Página */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
