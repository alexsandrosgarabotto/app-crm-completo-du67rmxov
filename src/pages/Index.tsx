import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'

export default function IndexPage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    )
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return <Navigate to="/login" replace />
}
