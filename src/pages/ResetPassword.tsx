import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Building2, AlertCircle, CheckCircle2, Lock } from 'lucide-react'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const { confirmPasswordReset } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!token) {
      setErrorMessage('Token de redefinição não encontrado ou expirado.')
      return
    }

    if (password.length < 8) {
      setErrorMessage('A nova senha deve ter no mínimo 8 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('As senhas digitadas não coincidem.')
      return
    }

    setLoading(true)
    try {
      const { error } = await confirmPasswordReset(token, password)
      if (error) {
        setErrorMessage(error.message || 'Falha ao redefinir a senha. O link pode ter expirado.')
      } else {
        setSuccess(true)
        setTimeout(() => {
          navigate('/login')
        }, 2500)
      }
    } catch {
      setErrorMessage('Erro ao redefinir a senha.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-blue-600 text-white shadow-lg mb-3">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Redefinir Senha</h1>
        </div>

        <Card className="border-slate-800 bg-white shadow-2xl">
          <CardHeader>
            <CardTitle>Crie sua nova senha</CardTitle>
            <CardDescription>
              Digite sua nova credencial de acesso para continuar utilizando o CRM.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {errorMessage && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            {success ? (
              <Alert className="bg-emerald-50 text-emerald-800 border-emerald-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <AlertDescription>
                  Senha redefinida com sucesso! Redirecionando para a tela de login...
                </AlertDescription>
              </Alert>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">Nova Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-9"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-new-password">Confirmar Nova Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="confirm-new-password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-9"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={loading}
                >
                  {loading ? 'Salvando nova senha...' : 'Salvar Nova Senha'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
