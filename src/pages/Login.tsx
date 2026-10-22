import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Building2, AlertCircle, CheckCircle2, Lock, Mail, User } from 'lucide-react'

export default function LoginPage() {
  const { signIn, signUp, requestPasswordReset } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'recovery'>('login')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Form states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<'owner' | 'seller'>('seller')

  const from = (location.state as any)?.from?.pathname || '/dashboard'

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)
    setLoading(true)

    try {
      const { error } = await signIn(email.trim(), password)
      if (error) {
        setErrorMessage('E-mail ou senha inválidos. Verifique suas credenciais.')
      } else {
        navigate(from, { replace: true })
      }
    } catch {
      setErrorMessage('Ocorreu um erro ao tentar entrar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (password.length < 8) {
      setErrorMessage('A senha precisa ter pelo menos 8 caracteres.')
      return
    }

    setLoading(true)
    try {
      const { error } = await signUp(email.trim(), password, name.trim(), role)
      if (error) {
        setErrorMessage(error.message || 'Erro ao criar conta. Esse e-mail já pode estar em uso.')
      } else {
        navigate('/dashboard', { replace: true })
      }
    } catch {
      setErrorMessage('Erro ao registrar usuário. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!email) {
      setErrorMessage('Informe seu e-mail cadastrado.')
      return
    }

    setLoading(true)
    try {
      const { error } = await requestPasswordReset(email.trim())
      if (error) {
        setErrorMessage('Não foi possível enviar o e-mail de recuperação. Verifique o endereço.')
      } else {
        setSuccessMessage('Instruções de redefinição enviadas para seu e-mail!')
      }
    } catch {
      setErrorMessage('Erro ao processar recuperação.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/30 mb-4">
            <Building2 className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">CRM Gestão Empresarial</h1>
          <p className="text-sm text-slate-400 mt-1">
            Controle de clientes, vendas, tarefas e financeiro
          </p>
        </div>

        <Card className="border-slate-800/80 bg-white/95 backdrop-blur-sm shadow-2xl">
          <CardHeader className="pb-3 text-center">
            <CardTitle className="text-xl font-bold text-slate-800">
              {activeTab === 'login' && 'Entrar na sua conta'}
              {activeTab === 'register' && 'Criar nova conta'}
              {activeTab === 'recovery' && 'Recuperar senha'}
            </CardTitle>
            <CardDescription>
              {activeTab === 'login' && 'Informe suas credenciais para acessar o painel'}
              {activeTab === 'register' && 'Cadastre-se para gerenciar seus negócios'}
              {activeTab === 'recovery' && 'Enviaremos um link para criar uma nova senha'}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-2">
            <Tabs
              value={activeTab}
              onValueChange={(val: any) => {
                setActiveTab(val)
                setErrorMessage(null)
                setSuccessMessage(null)
              }}
              className="w-full"
            >
              <TabsList className="grid grid-cols-3 mb-6">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="register">Cadastrar</TabsTrigger>
                <TabsTrigger value="recovery">Recuperar</TabsTrigger>
              </TabsList>

              {errorMessage && (
                <Alert variant="destructive" className="mb-4 py-2.5">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
                </Alert>
              )}

              {successMessage && (
                <Alert className="mb-4 py-2.5 bg-emerald-50 text-emerald-800 border-emerald-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <AlertDescription className="text-xs">{successMessage}</AlertDescription>
                </Alert>
              )}

              {/* ABA LOGIN */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="seu@email.com"
                        className="pl-9"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password">Senha</Label>
                      <button
                        type="button"
                        onClick={() => setActiveTab('recovery')}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Esqueceu?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-9"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    disabled={loading}
                  >
                    {loading ? 'Entrando...' : 'Acessar CRM'}
                  </Button>

                  <div className="text-center pt-2">
                    <p className="text-xs text-slate-500">
                      Acesso demonstrativo de administrador: <br />
                      <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] text-slate-700 font-mono">
                        administrativo@atomicsorriso.com.br / Skip@Pass
                      </code>
                    </p>
                  </div>
                </form>
              </TabsContent>

              {/* ABA CADASTRO */}
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-name">Nome Completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        id="reg-name"
                        placeholder="Seu nome ou Razão"
                        className="pl-9"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="reg-email">E-mail Profissional</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        id="reg-email"
                        type="email"
                        placeholder="nome@empresa.com"
                        className="pl-9"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="reg-password">Senha (mínimo 8 caracteres)</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        id="reg-password"
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
                    <Label htmlFor="reg-role">Perfil de Acesso</Label>
                    <select
                      id="reg-role"
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="seller">Vendedor / Comercial</option>
                      <option value="owner">Dono / Administrador Geral</option>
                    </select>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    disabled={loading}
                  >
                    {loading ? 'Cadastrando...' : 'Criar Conta'}
                  </Button>
                </form>
              </TabsContent>

              {/* ABA RECUPERAÇÃO DE SENHA */}
              <TabsContent value="recovery">
                <form onSubmit={handlePasswordRecovery} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="rec-email">E-mail Cadastrado</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        id="rec-email"
                        type="email"
                        placeholder="seu@email.com"
                        className="pl-9"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    disabled={loading}
                  >
                    {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
                  </Button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('login')}
                      className="text-xs text-slate-600 hover:underline"
                    >
                      Lembrou a senha? Voltar ao login
                    </button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>

          <CardFooter className="border-t border-slate-100 bg-slate-50/50 py-3 text-center justify-center">
            <span className="text-xs text-slate-500">
              Sistema CRM Integrado • Egestor / Gestão Click Style
            </span>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
