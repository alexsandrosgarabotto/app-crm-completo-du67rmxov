import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { canAccessRoute, TECNICO_HOME } from '@/lib/roles'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireOwner?: boolean
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireOwner = false,
}) => {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm text-slate-500 font-medium">Carregando CRM...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Perfil "Somente Ordens de Serviço": qualquer rota fora de /ordens-servico
  // cai no redirecionamento para o módulo único dele.
  if (!canAccessRoute(user, location.pathname)) {
    return <Navigate to={TECNICO_HOME} replace />
  }

  if (requireOwner && user.role !== 'owner') {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
