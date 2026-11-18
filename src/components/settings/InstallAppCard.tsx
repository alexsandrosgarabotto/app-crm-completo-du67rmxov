import { useEffect, useState } from 'react'
import { Download, Share2, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useIsMobile } from '@/hooks/use-mobile'

/**
 * Instalação do CRM como app no celular (PWA).
 *
 * - Android/Chrome: quando o navegador dispara `beforeinstallprompt`
 *   guardamos o evento e o botão chama `prompt()` — o diálogo nativo
 *   "Instalar app" aparece na hora.
 * - iPhone (iOS Safari): o evento nunca dispara; o card mostra o passo a
 *   passo "Compartilhar → Adicionar à Tela de Início".
 * - Desktop: também usa o prompt quando disponível, senão orienta o menu
 *   do Chrome (instalar via ícone de + na barra de endereço).
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallAppCard() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => {
    const onPrompt = (e: Event) => {
      // Impede o mini-banner automático do Chrome: o botão daqui dispara o prompt.
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setInstallEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    // Já instalado (standalone): Chrome/Firefox expõem display-mode.
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const isIos = isMobile && /iphone|ipad|ipod/i.test(navigator.userAgent)
  const canPrompt = !!installEvent

  const handleInstall = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    if (choice.outcome === 'accepted') {
      setInstalled(true)
    }
    setInstallEvent(null)
  }

  if (installed) {
    return (
      <Card className="border-emerald-200 shadow-xs">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-emerald-600" />
            App instalado
          </CardTitle>
          <CardDescription>
            Este CRM já está instalado neste dispositivo — você o abriu pelo ícone do app.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="border-slate-200 shadow-xs">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-blue-600" />
          Instalar o CRM no celular
        </CardTitle>
        <CardDescription>
          Instale o app na tela inicial dos técnicos: abre em tela cheia, com ícone próprio, e
          mostra uma tela amigável quando faltar internet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canPrompt ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Toque no botão abaixo para instalar — o navegador vai pedir confirmação:
            </p>
            <Button className="bg-blue-600 hover:bg-blue-700 h-11" onClick={handleInstall}>
              <Download className="h-4 w-4 mr-2" />
              Instalar app
            </Button>
          </div>
        ) : isIos ? (
          <ol className="space-y-2 text-sm text-slate-700">
            <li className="flex items-start gap-2">
              <Share2 className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
              Abra o CRM no <strong>Safari</strong> e toque em <strong>Compartilhar</strong> (o
              quadrado com a seta para cima, na barra de baixo).
            </li>
            <li className="flex items-start gap-2">
              <Smartphone className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
              Escolha <strong>“Adicionar à Tela de Início”</strong>.
            </li>
            <li className="flex items-start gap-2">
              <Download className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
              Confirme em <strong>“Adicionar”</strong> — o ícone do CRM aparece na tela inicial.
            </li>
          </ol>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Para instalar no celular, abra este endereço no <strong>Chrome</strong> do telefone e
              toque no menu <strong>⋮ → Instalar app</strong> (ou “Adicionar à tela inicial”).
            </p>
            <p className="text-xs text-slate-400">
              No computador: ícone de instalação <Download className="h-3 w-3 inline" /> na barra de
              endereço do Chrome, ou menu ⋮ → Instalar.
            </p>
          </div>
        )}

        {!isIos && !canPrompt && !isMobile && (
          <p className="text-xs text-slate-400">
            Se o botão não aparecer, o navegador ainda não liberou o prompt — continue usando o CRM
            normalmente e tente de novo em instantes.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
