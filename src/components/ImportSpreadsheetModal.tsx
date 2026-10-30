import React, { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import {
  FileSpreadsheet,
  Download,
  Upload,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  FileCheck,
  AlertTriangle,
} from 'lucide-react'
import {
  parseSpreadsheetFile,
  downloadFile,
  downloadBlobFile,
  generateCSV,
  generateExcelXML,
  type ParsedSheetData,
} from '@/lib/csvImportUtils'

export interface ImportColumnDefinition {
  key: string
  label: string
  required?: boolean
  description?: string
  aliases?: string[]
}

export interface ImportPreviewItem<T = any> {
  rowIndex: number
  data: Partial<T>
  raw: Record<string, string>
  isValid: boolean
  errors: string[]
  isUpdate?: boolean
  existingRecordName?: string
}

interface ImportModalProps<T> {
  isOpen: boolean
  onClose: () => void
  title: string
  entityName: string
  columns: ImportColumnDefinition[]
  sampleData: (string | number)[][]
  templateFileName: string
  processRow: (
    row: Record<string, string>,
    rowIndex: number,
  ) => Promise<ImportPreviewItem<T>> | ImportPreviewItem<T>
  onConfirmImport: (
    validItems: ImportPreviewItem<T>[],
  ) => Promise<{ imported: number; updated: number; ignored: number }>
  onSuccess: () => void
}

export function ImportSpreadsheetModal<T>({
  isOpen,
  onClose,
  title,
  entityName,
  columns,
  sampleData,
  templateFileName,
  processRow,
  onConfirmImport,
  onSuccess,
}: ImportModalProps<T>) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loadingFile, setLoadingFile] = useState(false)
  const [importing, setImporting] = useState(false)
  const [previewItems, setPreviewItems] = useState<ImportPreviewItem<T>[]>([])
  const [hasParsed, setHasParsed] = useState(false)

  const handleDownloadTemplate = (format: 'csv' | 'xlsx' = 'csv') => {
    const headers = columns.map((c) => c.label)
    const baseName = templateFileName.replace(/\.(csv|xlsx|xls)$/i, '')

    if (format === 'xlsx') {
      const fileName = `${baseName}.xls`
      const xmlContent = generateExcelXML(title, headers, sampleData)
      downloadFile(xmlContent, fileName, 'application/vnd.ms-excel;charset=utf-8;')
      toast({
        title: 'Modelo Excel baixado!',
        description: `Arquivo ${fileName} pronto para preenchimento no Excel ou planilhas.`,
      })
    } else {
      const fileName = `${baseName}.csv`
      const csvContent = generateCSV(headers, sampleData)
      downloadFile(csvContent, fileName, 'text/csv;charset=utf-8;')
      toast({
        title: 'Modelo CSV baixado!',
        description: `Arquivo ${fileName} pronto para preenchimento.`,
      })
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setLoadingFile(true)
    try {
      const parsed: ParsedSheetData = await parseSpreadsheetFile(selectedFile)
      if (parsed.rows.length === 0) {
        toast({
          title: 'Planilha vazia',
          description: 'Nenhum dado encontrado na planilha enviada.',
          variant: 'destructive',
        })
        setPreviewItems([])
        setHasParsed(true)
        return
      }

      // Processa cada linha para validação e verificação de duplicidade / upsert
      const items: ImportPreviewItem<T>[] = []
      for (let i = 0; i < parsed.rows.length; i++) {
        const item = await processRow(parsed.rows[i], i + 1)
        items.push(item)
      }

      setPreviewItems(items)
      setHasParsed(true)
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao ler arquivo',
        description: err.message || 'Falha ao processar planilha.',
        variant: 'destructive',
      })
    } finally {
      setLoadingFile(false)
    }
  }

  const handleConfirm = async () => {
    const validItems = previewItems.filter((i) => i.isValid)
    if (validItems.length === 0) {
      toast({
        title: 'Nenhum registro válido',
        description: 'Corrija os erros na planilha para poder importar.',
        variant: 'destructive',
      })
      return
    }

    setImporting(true)
    try {
      const result = await onConfirmImport(validItems)
      toast({
        title: 'Importação Concluída!',
        description: `${result.imported} novo(s), ${result.updated} atualizado(s), ${result.ignored} ignorado(s).`,
      })
      handleClose()
      onSuccess()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro na importação',
        description: err.message || 'Falha ao gravar registros.',
        variant: 'destructive',
      })
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setPreviewItems([])
    setHasParsed(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClose()
  }

  const validCount = previewItems.filter((i) => i.isValid).length
  const invalidCount = previewItems.filter((i) => !i.isValid).length
  const updateCount = previewItems.filter((i) => i.isValid && i.isUpdate).length
  const newCount = validCount - updateCount

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Importe seus {entityName} em massa utilizando uma planilha Excel (.xlsx, .csv).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Seção 1: Download de Modelo */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-sm text-blue-900">
                1. Baixe o modelo oficial com colunas e dados de exemplo
              </p>
              <p className="text-xs text-blue-700 mt-0.5">
                Preencha e salve como .csv ou .xlsx para importar com facilidade.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownloadTemplate('xlsx')}
                className="bg-white hover:bg-blue-100 text-blue-700 border-blue-200 text-xs"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" /> Baixar Modelo Excel (.xls/.xlsx)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownloadTemplate('csv')}
                className="bg-white hover:bg-slate-100 text-slate-700 border-slate-200 text-xs"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" /> Baixar (.csv)
              </Button>
            </div>
          </div>

          {/* Seção 2: Upload de Arquivo */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="font-semibold text-sm text-slate-800 mb-2">
              2. Selecione a planilha preenchida
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls, .tsv, .txt"
                onChange={handleFileChange}
                className="hidden"
                id="spreadsheet-upload-input"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={loadingFile}
                className="w-full sm:w-auto text-xs"
              >
                <Upload className="h-4 w-4 mr-2 text-slate-600" />
                {file ? 'Escolher Outro Arquivo' : 'Selecionar Planilha (.csv / .xlsx)'}
              </Button>
              {file && (
                <span className="text-xs text-slate-600 font-medium truncate">
                  Arquivo: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
                </span>
              )}
            </div>
          </div>

          {/* Seção 3: Prévia e Validação */}
          {loadingFile && (
            <div className="p-8 text-center text-slate-500">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2"></div>
              <p className="text-sm">Lendo e validando linhas da planilha...</p>
            </div>
          )}

          {hasParsed && !loadingFile && (
            <div className="space-y-3">
              {/* Resumo de validação */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                <span className="font-semibold text-slate-700">
                  Total de linhas lidas: {previewItems.length}
                </span>
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-100 text-emerald-800 border-0">
                    <CheckCircle2 className="h-3 w-3 mr-1 inline" /> {newCount} novo(s)
                  </Badge>
                  {updateCount > 0 && (
                    <Badge className="bg-blue-100 text-blue-800 border-0">
                      <RefreshCw className="h-3 w-3 mr-1 inline" /> {updateCount} atualização
                      (upsert)
                    </Badge>
                  )}
                  {invalidCount > 0 && (
                    <Badge className="bg-rose-100 text-rose-800 border-0">
                      <AlertCircle className="h-3 w-3 mr-1 inline" /> {invalidCount} com erro (serão
                      ignorados)
                    </Badge>
                  )}
                </div>
              </div>

              {/* Tabela de Prévia */}
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 sticky top-0 border-b border-slate-200 font-semibold text-slate-600">
                    <tr>
                      <th className="py-2 px-3 w-12 text-center">Linha</th>
                      <th className="py-2 px-3">Dados Identificados</th>
                      <th className="py-2 px-3 text-center w-28">Ação</th>
                      <th className="py-2 px-3">Status / Validação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewItems.map((item) => {
                      const firstCols = Object.entries(item.raw)
                        .slice(0, 3)
                        .map(([k, v]) => `${k}: ${v || '-'}`)
                        .join(' | ')

                      return (
                        <tr
                          key={item.rowIndex}
                          className={item.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/30'}
                        >
                          <td className="py-2 px-3 text-center font-mono text-slate-500">
                            #{item.rowIndex}
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-medium text-slate-800 truncate block max-w-md">
                              {firstCols}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            {!item.isValid ? (
                              <Badge variant="outline" className="text-rose-600 border-rose-200">
                                Ignorar
                              </Badge>
                            ) : item.isUpdate ? (
                              <Badge className="bg-blue-100 text-blue-800 border-0">
                                Atualizar
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-100 text-emerald-800 border-0">
                                Inserir
                              </Badge>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {item.isValid ? (
                              <span className="text-emerald-700 font-medium flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {item.isUpdate
                                  ? `Já existe no cadastro (${item.existingRecordName || 'atualizará dados'})`
                                  : 'Pronto para importação'}
                              </span>
                            ) : (
                              <span className="text-rose-600 font-medium flex items-center gap-1">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                {item.errors.join('; ')}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t flex items-center justify-between">
          <Button type="button" variant="outline" onClick={handleClose} disabled={importing}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={importing || !hasParsed || validCount === 0}
            className="bg-blue-600 hover:bg-blue-700 text-xs"
          >
            {importing ? (
              'Gravando dados...'
            ) : (
              <>
                <FileCheck className="h-4 w-4 mr-1.5" />
                Confirmar Importação ({validCount} registros)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
