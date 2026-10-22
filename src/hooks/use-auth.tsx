import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import type { User } from '@/types/crm'

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ user?: User; error?: any }>
  signUp: (
    email: string,
    password: string,
    name: string,
    role?: 'owner' | 'seller',
  ) => Promise<{ user?: User; error?: any }>
  signOut: () => void
  requestPasswordReset: (email: string) => Promise<{ error: any }>
  confirmPasswordReset: (token: string, password: string) => Promise<{ error: any }>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(pb.authStore.token)
  const [loading, setLoading] = useState<boolean>(true)

  const syncAuth = () => {
    if (pb.authStore.isValid && pb.authStore.record) {
      setUser(pb.authStore.record as unknown as User)
      setToken(pb.authStore.token)
    } else {
      setUser(null)
      setToken(null)
    }
  }

  useEffect(() => {
    syncAuth()
    setLoading(false)

    const unsubscribe = pb.authStore.onChange(() => {
      syncAuth()
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const refreshUser = async () => {
    if (pb.authStore.isValid && pb.authStore.record?.id) {
      try {
        const updated = await pb.collection('users').getOne<User>(pb.authStore.record.id)
        setUser(updated)
      } catch (e) {
        console.error('Falha ao atualizar dados do usuário:', e)
      }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const authData = await pb.collection('users').authWithPassword<User>(email, password)
      setUser(authData.record)
      setToken(authData.token)
      return { user: authData.record, error: null }
    } catch (error: any) {
      return { error }
    }
  }

  const signUp = async (
    email: string,
    password: string,
    name: string,
    role: 'owner' | 'seller' = 'seller',
  ) => {
    try {
      const created = await pb.collection('users').create<User>({
        email,
        password,
        passwordConfirm: password,
        name,
        role,
      })

      try {
        await pb.collection('users').requestVerification(email)
      } catch {
        // best-effort
      }

      // Login automático
      const authData = await pb.collection('users').authWithPassword<User>(email, password)
      setUser(authData.record)
      setToken(authData.token)
      return { user: authData.record, error: null }
    } catch (error: any) {
      return { error }
    }
  }

  const signOut = () => {
    pb.authStore.clear()
    setUser(null)
    setToken(null)
  }

  const requestPasswordReset = async (email: string) => {
    try {
      await pb.collection('users').requestPasswordReset(email)
      return { error: null }
    } catch (error: any) {
      return { error }
    }
  }

  const confirmPasswordReset = async (resetToken: string, password: string) => {
    try {
      await pb.collection('users').confirmPasswordReset(resetToken, password, password)
      return { error: null }
    } catch (error: any) {
      return { error }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        signIn,
        signUp,
        signOut,
        requestPasswordReset,
        confirmPasswordReset,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider')
  }
  return context
}
