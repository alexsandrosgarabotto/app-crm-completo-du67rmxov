import { useRef, useState } from 'react'
import { Camera, Loader2, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { serviceOrderFileUrl } from '@/services/serviceOrders'
import type { ServiceOrder } from '@/types/crm'

interface PhotoReportProps {
  order: ServiceOrder
  onAddPhoto: (file: File) => Promise<void>
  onRemovePhoto: (filename: string) => Promise<void>
  disabled?: boolean
}

/**
 * Relatório fotográfico da OS: upload (câmera ou galeria, accept="image/*"),
 * grade de miniaturas, lightbox simples e remoção. Os arquivos ficam no
 * storage do PocketBase (campo file multi da migração 0021), não em base64.
 */
export function PhotoReport({ order, onAddPhoto, onRemovePhoto, disabled }: PhotoReportProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [error, setError] = useState('')

  const photos = (order.photos || []).filter((n) => n && n.length > 0)

  const handleFiles = async (files: FileList | null) => {
    setError('')
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue
        await onAddPhoto(file)
      }
    } catch (err: any) {
      setError(err?.message || 'Falha ao enviar a foto.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
      if (cameraInputRef.current) cameraInputRef.current.value = ''
    }
  }

  const handleRemove = async (filename: string) => {
    setRemoving(filename)
    try {
      await onRemovePhoto(filename)
      if (lightbox === serviceOrderFileUrl(order.id, filename)) setLightbox(null)
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          Adicionar fotos
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading}
          onClick={() => cameraInputRef.current?.click()}
        >
          Tirar foto
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma foto ainda. Adicione imagens do antes, durante e depois do serviço.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {photos.map((filename) => {
            const url = serviceOrderFileUrl(order.id, filename, '300x0')
            return (
              <div
                key={filename}
                className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
              >
                <img
                  src={url}
                  alt={`Foto da OS ${order.number || order.id}`}
                  className="h-full w-full cursor-zoom-in object-cover"
                  onClick={() => setLightbox(serviceOrderFileUrl(order.id, filename))}
                />
                <button
                  type="button"
                  aria-label="Remover foto"
                  disabled={disabled || removing === filename}
                  className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-destructive opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                  onClick={() => void handleRemove(filename)}
                >
                  {removing === filename ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="Foto ampliada da OS"
            className="max-h-full max-w-full rounded-md object-contain"
          />
          <button
            type="button"
            aria-label="Fechar"
            className="absolute right-4 top-4 rounded-full bg-background/80 p-2 text-foreground"
            onClick={() => setLightbox(null)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  )
}
