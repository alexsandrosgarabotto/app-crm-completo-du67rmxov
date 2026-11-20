import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface SearchablePickerOption<T> {
  value: string
  label: string
  description?: string
  disabled?: boolean
  raw: T
}

interface SearchablePickerProps<T> {
  /** Valor selecionado (id) — '' = nada. */
  value: string
  onChange: (option: SearchablePickerOption<T> | null) => void
  options: SearchablePickerOption<T>[]
  placeholder?: string
  /** Rótulo exibido quando há item selecionado (com botão para limpar). */
  emptyLabel?: string
  className?: string
  disabled?: boolean
}

const MIN_CHARS = 3

/**
 * Campo de busca por texto (mobile-first) com lista de opções a partir de
 * N letras digitadas — usado para escolher cliente e material de estoque
 * na ordem de serviço. NÃO cria registros: só escolhe de uma lista.
 */
export function SearchablePicker<T>({
  value,
  onChange,
  options,
  placeholder = 'Digite ao menos 3 letras para buscar...',
  className,
  disabled,
}: SearchablePickerProps<T>) {
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const selecionado = useMemo(() => options.find((o) => o.value === value), [options, value])

  useEffect(() => {
    if (value && selecionado) setTerm(selecionado.label)
  }, [value, selecionado])

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [])

  const normaliza = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

  const resultados = useMemo(() => {
    const t = normaliza(term.trim())
    if (t.length < MIN_CHARS) return []
    return options
      .filter((o) => {
        const alvo = normaliza(`${o.label} ${o.description || ''}`)
        return t.split(/\s+/).every((parte) => alvo.includes(parte))
      })
      .slice(0, 8)
  }, [options, term])

  const selecionar = (opcao: SearchablePickerOption<T>) => {
    onChange(opcao)
    setTerm(opcao.label)
    setOpen(false)
  }

  const limpar = () => {
    onChange(null)
    setTerm('')
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <Input
          value={term}
          onChange={(e) => {
            setTerm(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={selecionado ? selecionado.label : placeholder}
          className="pl-9 pr-8"
          disabled={disabled}
          autoComplete="off"
          inputMode="search"
        />
        {(term || value) && (
          <button
            type="button"
            onClick={limpar}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            title="Limpar seleção"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && term.trim().length < MIN_CHARS && !selecionado && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg px-3 py-2 text-xs text-slate-500">
          Digite ao menos {MIN_CHARS} letras para buscar.
        </div>
      )}

      {open && term.trim().length >= MIN_CHARS && resultados.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg px-3 py-2 text-xs text-slate-500">
          Nenhum cliente/material encontrado com esse início.
        </div>
      )}

      {open && resultados.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {resultados.map((opcao) => (
            <li key={opcao.value}>
              <button
                type="button"
                disabled={opcao.disabled}
                onClick={() => selecionar(opcao)}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed',
                  opcao.value === value && 'bg-blue-50',
                )}
              >
                <span className="block font-medium text-slate-800 truncate">{opcao.label}</span>
                {opcao.description && (
                  <span className="block text-xs text-slate-500 truncate">{opcao.description}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
