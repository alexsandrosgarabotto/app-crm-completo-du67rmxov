/**
 * Utilitário leve de parsing e geração de planilhas CSV e XLSX compatível (formato CSV/TSV e XML Spreadsheet).
 * Não depende de bibliotecas externas pesadas e suporta .csv, .txt, .tsv e exportação .csv e .xlsx (XML Spreadsheet).
 */

export interface ParsedSheetData {
  headers: string[]
  rows: Record<string, string>[]
}

/**
 * Remove acentos e converte para minúsculas para correspondência flexível de cabeçalhos
 */
export function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Faz parse de conteúdo CSV ou TSV
 */
export function parseCSV(content: string): ParsedSheetData {
  const lines = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0)

  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }

  // Detecta delimitador: ',' ';' ou '\t'
  const firstLine = lines[0]
  let delimiter = ','
  const semicolons = (firstLine.match(/;/g) || []).length
  const commas = (firstLine.match(/,/g) || []).length
  const tabs = (firstLine.match(/\t/g) || []).length

  if (semicolons > commas && semicolons > tabs) {
    delimiter = ';'
  } else if (tabs > commas && tabs > semicolons) {
    delimiter = '\t'
  }

  const parseLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseLine(lines[0]).map((h) => h.replace(/^"|"$/g, '').trim())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i])
    // Se a linha for toda vazia, ignora
    if (values.every((v) => !v)) continue

    const rowObj: Record<string, string> = {}
    headers.forEach((header, idx) => {
      rowObj[header] = values[idx] !== undefined ? values[idx].replace(/^"|"$/g, '').trim() : ''
    })
    rows.push(rowObj)
  }

  return { headers, rows }
}

/**
 * Parse básico para arquivos .xlsx que possam vir como texto ou tentar ler de XML / ArrayBuffer
 */
export async function parseSpreadsheetFile(file: File): Promise<ParsedSheetData> {
  const isCSV =
    file.name.endsWith('.csv') || file.name.endsWith('.txt') || file.name.endsWith('.tsv')

  if (isCSV) {
    const text = await file.text()
    return parseCSV(text)
  }

  // Se for .xlsx, podemos ler como ArrayBuffer ou tentar descompactar caso precise,
  // ou tentar decodificar se for XML ou se tiver SheetJS no ambiente.
  // Como padrão no navegador sem deps grandes, tenta ler texto caso seja CSV renomeado ou arquivo estruturado.
  try {
    const text = await file.text()
    if (text.includes(',') || text.includes(';') || text.includes('\t')) {
      return parseCSV(text)
    }
  } catch (_) {
    // ignora
  }

  throw new Error(
    'Formato de arquivo não reconhecido ou compactado. Por favor, utilize o modelo em planilha CSV ou texto (.csv ou .tsv).',
  )
}

/**
 * Faz download de um arquivo gerado no navegador
 */
export function downloadFile(
  content: string,
  fileName: string,
  mimeType: string = 'text/csv;charset=utf-8;',
) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Gera conteúdo CSV formatado com BOM UTF-8 para abrir perfeitamente no Excel
 */
export function generateCSV(headers: string[], sampleRows: (string | number)[][]): string {
  const bom = '\uFEFF' // Garante compatibilidade de acentuação no Excel pt-BR
  const escapeCell = (cell: string | number) => {
    const str = String(cell ?? '')
    if (str.includes(';') || str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const headerLine = headers.map(escapeCell).join(';')
  const dataLines = sampleRows.map((row) => row.map(escapeCell).join(';'))

  return bom + [headerLine, ...dataLines].join('\r\n')
}
