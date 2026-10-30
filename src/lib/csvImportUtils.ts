/**
 * Utilitário leve e robusto de parsing e geração de planilhas CSV e XLSX compatível.
 * Suporta arquivos .xlsx nativos reais (descompactação ZIP OpenXML via DecompressionStream),
 * planilhas XML Spreadsheet 2003 (.xml / .xls / .xlsx exportados) e arquivos delimitados (.csv, .tsv, .txt).
 */

import { parseXLSXFile } from './xlsxReader'

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
 * Faz parse de planilhas no formato XML Spreadsheet 2003 (usado por sistemas legados com extensão .xlsx ou .xls)
 */
export function parseExcelXMLSpreadsheet(xml: string): ParsedSheetData {
  const rowRegex = /<Row\b[^>]*>([\s\S]*?)<\/Row>/gi
  const rowsData: string[][] = []
  let rowMatch: RegExpExecArray | null

  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    const rowContent = rowMatch[1]
    const cellRegex = /<Cell\b[^>]*>([\s\S]*?)<\/Cell>/gi
    const rowCells: string[] = []
    let cellMatch: RegExpExecArray | null

    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const cellContent = cellMatch[1]
      const dataMatch = /<Data\b[^>]*>([\s\S]*?)<\/Data>/i.exec(cellContent)
      let val = ''
      if (dataMatch) {
        val = dataMatch[1]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .trim()
      }
      rowCells.push(val)
    }

    if (rowCells.some((c) => c !== '')) {
      rowsData.push(rowCells)
    }
  }

  if (rowsData.length === 0) {
    return { headers: [], rows: [] }
  }

  const headers = rowsData[0]
  const rows: Record<string, string>[] = []

  for (let i = 1; i < rowsData.length; i++) {
    const rowCells = rowsData[i]
    if (rowCells.every((c) => !c)) continue
    const rowObj: Record<string, string> = {}
    headers.forEach((header, idx) => {
      rowObj[header] = rowCells[idx] !== undefined ? rowCells[idx] : ''
    })
    rows.push(rowObj)
  }

  return { headers, rows }
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
 * Parse universal de planilhas para arquivos .xlsx, .csv, .tsv, .txt e planilhas XML
 */
export async function parseSpreadsheetFile(file: File): Promise<ParsedSheetData> {
  const lowerName = file.name.toLowerCase()
  const isCsvOrTsv =
    lowerName.endsWith('.csv') ||
    lowerName.endsWith('.tsv') ||
    lowerName.endsWith('.txt') ||
    file.type === 'text/csv' ||
    file.type === 'text/tab-separated-values' ||
    file.type === 'text/plain'

  if (isCsvOrTsv) {
    const text = await file.text()
    return parseCSV(text)
  }

  // Tenta ler como arquivo binário .xlsx (ZIP OpenXML)
  const arrayBuffer = await file.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)

  // Verifica se inicia com a assinatura de arquivo ZIP (PK.. => 0x50, 0x4B, 0x03, 0x04)
  const isZip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b

  if (isZip) {
    try {
      const result = await parseXLSXFile(arrayBuffer)
      if (result.headers.length > 0) {
        return result
      }
    } catch (xlsxErr: any) {
      console.warn('Falha no leitor de arquivo XLSX OpenXML:', xlsxErr)
      // Caso ocorra falha ao descompactar como OpenXML, continua tentando outros formatos de contingência
    }
  }

  // Se não for ZIP ou o parser falhou, pode ser:
  // 1. Um arquivo CSV ou TSV renomeado para .xlsx
  // 2. Um arquivo XML Spreadsheet 2003 salvo como .xlsx ou .xls
  // 3. Texto codificado em UTF-8 ou ISO-8859-1
  try {
    const textDecoder = new TextDecoder('utf-8')
    const text = textDecoder.decode(bytes)

    // Se contiver tags XML Spreadsheet (<Workbook e <Row)
    if (text.includes('<Workbook') && text.includes('<Row')) {
      return parseExcelXMLSpreadsheet(text)
    }

    // Se contiver delimitadores CSV/TSV
    if (text.includes(',') || text.includes(';') || text.includes('\t')) {
      const parsed = parseCSV(text)
      if (parsed.headers.length > 0 && parsed.rows.length > 0) {
        return parsed
      }
    }
  } catch (_) {
    // ignora e propaga erro formatado abaixo
  }

  throw new Error(
    'Não foi possível extrair os dados da planilha. Verifique se o arquivo .xlsx ou .csv não está corrompido ou protegido por senha.',
  )
}

/**
 * Faz download de um arquivo gerado no navegador a partir de texto
 */
export function downloadFile(
  content: string,
  fileName: string,
  mimeType: string = 'text/csv;charset=utf-8;',
) {
  const blob = new Blob([content], { type: mimeType })
  downloadBlobFile(blob, fileName)
}

/**
 * Faz download de um Blob no navegador
 */
export function downloadBlobFile(blob: Blob, fileName: string) {
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

/**
 * Gera arquivo XML Spreadsheet 2003 nativo e compatível com Microsoft Excel
 */
export function generateExcelXML(
  sheetName: string,
  headers: string[],
  sampleRows: (string | number)[][],
): string {
  const escapeXml = (str: string | number) =>
    String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')

  const headerCells = headers
    .map(
      (h) => `    <Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`,
    )
    .join('\n')

  const rowCells = sampleRows
    .map((row) => {
      const cells = row
        .map((c) => `    <Cell><Data ss:Type="String">${escapeXml(c)}</Data></Cell>`)
        .join('\n')
      return `   <Row>\n${cells}\n   </Row>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#2563EB" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(sheetName.substring(0, 31))}">
  <Table>
   <Row>
${headerCells}
   </Row>
${rowCells}
  </Table>
 </Worksheet>
</Workbook>`
}
