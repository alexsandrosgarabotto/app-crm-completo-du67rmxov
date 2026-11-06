import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/hooks/use-auth'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import CRMNavigationLayout from '@/components/CRMNavigationLayout'

// Pages
import Index from './pages/Index'
import LoginPage from './pages/Login'
import ResetPasswordPage from './pages/ResetPassword'
import DashboardPage from './pages/Dashboard'
import ClientsPage from './pages/Clients'
import PipelineDealsPage from './pages/Deals'
import ScheduleTasksPage from './pages/Schedule'
import FinancialPage from './pages/Financial'
import SettingsPage from './pages/Settings'
import StockPage from './pages/Stock'
import ServicesPage from './pages/Services'
import FiscalDocumentsPage from './pages/FiscalDocuments'
import WhatsAppPage from './pages/WhatsApp'
import ServiceOrdersPage from './pages/ServiceOrders'
import ReportsPage from './pages/Reports'
import NotFound from './pages/NotFound'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* Rota Raiz - Redireciona conforme auth */}
          <Route path="/" element={<Index />} />

          {/* Autenticação pública */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Áreas protegidas do CRM dentro do Navigation Layout */}
          <Route
            element={
              <ProtectedRoute>
                <CRMNavigationLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/clientes" element={<ClientsPage />} />
            <Route path="/vendas" element={<PipelineDealsPage />} />
            <Route path="/estoque" element={<StockPage />} />
            <Route path="/servicos" element={<ServicesPage />} />
            <Route path="/notas-fiscais" element={<FiscalDocumentsPage />} />
            <Route path="/atendimentos" element={<WhatsAppPage />} />
            <Route path="/ordens-servico" element={<ServiceOrdersPage />} />
            <Route path="/agenda" element={<ScheduleTasksPage />} />
            <Route path="/financeiro" element={<FinancialPage />} />
            <Route path="/relatorios" element={<ReportsPage />} />
            <Route
              path="/configuracoes"
              element={
                <ProtectedRoute requireOwner>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Rota 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
