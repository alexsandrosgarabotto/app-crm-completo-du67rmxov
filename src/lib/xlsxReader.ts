/**
 * Leitor nativo e robusto de arquivos ZIP (PKZip) e planilhas OpenXML (.xlsx).
 * Não depende de bibliotecas externas pesadas e roda em navegadores modernos
 * usando DecompressionStream('deflate-raw') nativo.
 */

export interface ZipFileEntry {
  path: string
  uncompressedSize: number
  getData: () => Promise<Uint8Array>
  getText: () => Promise<string>
}

/**
 * Lê todas as entradas de um arquivo ZIP a partir de um Uint8Array / ArrayBuffer.
 */
export async function readZipEntries(
  buffer: ArrayBuffer | Uint8Array,
): Promise<Map<string, ZipFileEntry>> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const length = bytes.byteLength

  if (length < 22) {
    throw new Error('Arquivo corrompido ou formato inválido (tamanho insuficiente para ZIP).')
  }

  // 1. Localizar o cabeçalho 'End of Central Directory' (EOCD signature: 0x06054b50)
  // O EOCD tem no mínimo 22 bytes e pode ter um comentário de até 65535 bytes no final.
  let eocdOffset = -1
  const minOffset = Math.max(0, length - 65557)
  for (let i = length - 22; i >= minOffset; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i
      break
    }
  }

  if (eocdOffset === -1) {
    throw new Error(
      'Não foi possível identificar a estrutura interna do arquivo compactado (.xlsx).',
    )
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true)
  const cdSize = view.getUint32(eocdOffset + 12, true)
  const cdOffset = view.getUint32(eocdOffset + 16, true)

  if (cdOffset + cdSize > length) {
    throw new Error('Diretório central do arquivo ZIP inválido ou corrompido.')
  }

  const entries = new Map<string, ZipFileEntry>()
  const textDecoderUtf8 = new TextDecoder('utf-8')

  let currentCdOffset = cdOffset
  for (let i = 0; i < totalEntries; i++) {
    if (currentCdOffset + 46 > length) break
    const signature = view.getUint32(currentCdOffset, true)
    if (signature !== 0x02014b50) {
      // Fim das entradas ou assinatura divergente
      break
    }

    const flags = view.getUint16(currentCdOffset + 8, true)
    const compressionMethod = view.getUint16(currentCdOffset + 10, true)
    const compressedSize = view.getUint32(currentCdOffset + 20, true)
    const uncompressedSize = view.getUint32(currentCdOffset + 24, true)
    const fileNameLength = view.getUint16(currentCdOffset + 28, true)
    const extraFieldLength = view.getUint16(currentCdOffset + 30, true)
    const fileCommentLength = view.getUint16(currentCdOffset + 32, true)
    const localHeaderOffset = view.getUint32(currentCdOffset + 42, true)

    const fileNameBytes = bytes.subarray(
      currentCdOffset + 46,
      currentCdOffset + 46 + fileNameLength,
    )
    const isUtf8 = (flags & (1 << 11)) !== 0
    const fileName = isUtf8
      ? textDecoderUtf8.decode(fileNameBytes)
      : textDecoderUtf8.decode(fileNameBytes)

    const entry: ZipFileEntry = {
      path: fileName,
      uncompressedSize,
      getData: async () => {
        // Lê o cabeçalho local da entrada para determinar o início exato dos dados
        if (localHeaderOffset + 30 > length) {
          throw new Error(`Entrada ${fileName} truncada no arquivo compactado.`)
        }
        const localSig = view.getUint32(localHeaderOffset, true)
        if (localSig !== 0x04034b50) {
          throw new Error(`Cabeçalho local inválido para a entrada ${fileName}.`)
        }
        const localNameLen = view.getUint16(localHeaderOffset + 26, true)
        const localExtraLen = view.getUint16(localHeaderOffset + 28, true)
        const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen

        const dataBytes = bytes.subarray(dataStart, dataStart + compressedSize)

        if (compressionMethod === 0) {
          // Sem compressão (Stored)
          return dataBytes
        } else if (compressionMethod === 8) {
          // Deflate
          return await decompressDeflateRaw(dataBytes)
        } else {
          throw new Error(
            `Método de compressão não suportado (${compressionMethod}) para ${fileName}.`,
          )
        }
      },
      getText: async () => {
        const raw = await entry.getData()
        return textDecoderUtf8.decode(raw)
      },
    }

    // Normaliza caminhos com barras normais (remover possíveis barras iniciais)
    const normalizedPath = fileName.replace(/\\/g, '/').replace(/^\//, '')
    entries.set(normalizedPath, entry)

    currentCdOffset += 46 + fileNameLength + extraFieldLength + fileCommentLength
  }

  return entries
}

/**
 * Descompacta fluxo Deflate-Raw usando DecompressionStream nativo do navegador
 */
async function decompressDeflateRaw(compressedBytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error(
      'O navegador atual não suporta a API DecompressionStream necessária para descompactar .xlsx.',
    )
  }

  // Tenta primeiro 'deflate-raw'. Em alguns navegadores legados que não possuem raw, tenta 'deflate'.
  let ds: DecompressionStream
  try {
    ds = new DecompressionStream('deflate-raw')
  } catch (_) {
    ds = new DecompressionStream('deflate')
  }

  const cleanBuffer = new ArrayBuffer(compressedBytes.byteLength)
  new Uint8Array(cleanBuffer).set(compressedBytes)
  const stream = new Response(new Blob([cleanBuffer]).stream().pipeThrough(ds))
  const arrayBuffer = await stream.arrayBuffer()
  return new Uint8Array(arrayBuffer)
}

/**
 * Faz parse de uma referência de célula (ex: "B3" -> col 1, row 2)
 */
function parseCellReference(cellRef: string): { col: number; row: number } {
  let col = 0
  let row = 0
  for (let i = 0; i < cellRef.length; i++) {
    const code = cellRef.charCodeAt(i)
    if (code >= 65 && code <= 90) {
      // Letras A-Z
      col = col * 26 + (code - 64)
    } else if (code >= 97 && code <= 122) {
      col = col * 26 + (code - 96)
    } else if (code >= 48 && code <= 57) {
      row = parseInt(cellRef.substring(i), 10) - 1
      break
    }
  }
  return { col: Math.max(0, col - 1), row: Math.max(0, row) }
}

/**
 * Converte índice de coluna (0-indexed) para nome de coluna (ex: 0 -> "A", 27 -> "AB")
 */
function colIndexToName(index: number): string {
  let colName = ''
  let num = index
  while (num >= 0) {
    colName = String.fromCharCode(65 + (num % 26)) + colName
    num = Math.floor(num / 26) - 1
  }
  return colName
}

/**
 * Decodifica entidades XML comuns
 */
function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

/**
 * Faz parse do arquivo xl/sharedStrings.xml
 */
function parseSharedStrings(xml: string): string[] {
  const strings: string[] = []
  // Cada item de string compartilhada fica dentro de uma tag <si>...</si>
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/gi
  let siMatch: RegExpExecArray | null

  while ((siMatch = siRegex.exec(xml)) !== null) {
    const siContent = siMatch[1]
    // Coleta todos os blocos <t> dentro do <si>
    const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/gi
    let textParts = ''
    let tMatch: RegExpExecArray | null

    while ((tMatch = tRegex.exec(siContent)) !== null) {
      textParts += tMatch[1]
    }

    strings.push(decodeXmlEntities(textParts))
  }

  return strings
}

/**
 * Lê o arquivo xl/workbook.xml e xl/_rels/workbook.xml.rels para descobrir o arquivo da primeira planilha ativa
 */
function findFirstSheetPath(workbookXml: string, workbookRelsXml?: string): string {
  if (workbookRelsXml) {
    // Procura relacionamentos do tipo worksheet no rels
    const relRegex =
      /<Relationship\b[^>]*Id="([^"]+)"[^>]*Type="[^"]*worksheet"[^>]*Target="([^"]+)"/gi
    const relMatch = relRegex.exec(workbookRelsXml)
    if (relMatch && relMatch[2]) {
      const target = relMatch[2]
      if (target.startsWith('/')) return target.substring(1)
      if (target.startsWith('xl/')) return target
      return `xl/${target}`
    }
  }

  // Fallback padrão de arquivo XLSX
  return 'xl/worksheets/sheet1.xml'
}

/**
 * Extrai dados da planilha a partir do XML da worksheet e do sharedStrings
 */
function parseWorksheetXml(
  sheetXml: string,
  sharedStrings: string[],
): { headers: string[]; rows: Record<string, string>[] } {
  // Matriz 2D de linhas e colunas
  const matrix: string[][] = []

  // Regex para localizar tags de linha <row r="1">...</row>
  const rowRegex = /<row\b[^>]*?(?:r="(\d+)")?[^>]*>([\s\S]*?)<\/row>/gi
  let rowMatch: RegExpExecArray | null
  let autoRowIndex = 0

  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    const rAttr = rowMatch[1]
    const rowContent = rowMatch[2]
    const rowIndex = rAttr ? parseInt(rAttr, 10) - 1 : autoRowIndex
    autoRowIndex = Math.max(autoRowIndex + 1, rowIndex + 1)

    if (!matrix[rowIndex]) {
      matrix[rowIndex] = []
    }

    // Regex para pegar células: <c r="A1" t="s"><v>0</v></c> ou <c r="B1"><is><t>Texto</t></is></c>
    const cellRegex = /<c\b([^>]*?)>(?:([\s\S]*?)<\/c>|(\/>))/gi
    let cellMatch: RegExpExecArray | null
    let autoColIndex = 0

    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const attrs = cellMatch[1] || ''
      const cellBody = cellMatch[2] || ''

      // Extrai referência r="A1"
      const rMatch = /r="([A-Za-z]+[0-9]+)"/.exec(attrs)
      let colIndex = autoColIndex
      if (rMatch) {
        const parsed = parseCellReference(rMatch[1])
        colIndex = parsed.col
      }
      autoColIndex = Math.max(autoColIndex + 1, colIndex + 1)

      // Extrai tipo t="s" (shared string), t="b" (boolean), t="str" (inline/formula string), t="inlineStr"
      const tMatch = /t="([^"]+)"/.exec(attrs)
      const cellType = tMatch ? tMatch[1] : 'n' // 'n' padrão para número se omitido

      let cellValue = ''

      if (cellType === 'inlineStr') {
        // <is><t>Texto</t></is>
        const isMatch = /<t\b[^>]*>([\s\S]*?)<\/t>/i.exec(cellBody)
        if (isMatch) {
          cellValue = decodeXmlEntities(isMatch[1])
        }
      } else {
        // Tag <v>...</v>
        const vMatch = /<v\b[^>]*>([\s\S]*?)<\/v>/i.exec(cellBody)
        if (vMatch) {
          const rawV = decodeXmlEntities(vMatch[1].trim())
          if (cellType === 's') {
            const strIndex = parseInt(rawV, 10)
            cellValue = sharedStrings[strIndex] ?? ''
          } else if (cellType === 'b') {
            cellValue = rawV === '1' ? 'true' : 'false'
          } else {
            cellValue = rawV
          }
        }
      }

      matrix[rowIndex][colIndex] = cellValue.trim()
    }
  }

  // Remove linhas vazias no início
  let startRow = 0
  while (startRow < matrix.length && (!matrix[startRow] || matrix[startRow].every((v) => !v))) {
    startRow++
  }

  if (startRow >= matrix.length) {
    return { headers: [], rows: [] }
  }

  // Primeira linha com dados é considerada o cabeçalho
  const rawHeaders = matrix[startRow] || []
  const maxCols = Math.max(
    rawHeaders.length,
    ...matrix.slice(startRow + 1).map((r) => (r ? r.length : 0)),
  )

  const headers: string[] = []
  for (let c = 0; c < maxCols; c++) {
    const h = rawHeaders[c] ? rawHeaders[c].trim() : ''
    headers.push(h || `Coluna ${colIndexToName(c)}`)
  }

  const rows: Record<string, string>[] = []
  for (let r = startRow + 1; r < matrix.length; r++) {
    const rowCells = matrix[r]
    if (!rowCells || rowCells.every((v) => !v)) continue

    const rowObj: Record<string, string> = {}
    headers.forEach((header, idx) => {
      rowObj[header] = rowCells[idx] !== undefined ? rowCells[idx] : ''
    })
    rows.push(rowObj)
  }

  return { headers, rows }
}

/**
 * Lê e decodifica arquivo .xlsx real (formato ZIP OpenXML).
 */
export async function parseXLSXFile(buffer: ArrayBuffer | Uint8Array): Promise<{
  headers: string[]
  rows: Record<string, string>[]
}> {
  const entries = await readZipEntries(buffer)

  // 1. Carrega xl/sharedStrings.xml caso exista
  let sharedStrings: string[] = []
  const sharedEntry = entries.get('xl/sharedStrings.xml') || entries.get('xl/SharedStrings.xml')
  if (sharedEntry) {
    const sharedXml = await sharedEntry.getText()
    sharedStrings = parseSharedStrings(sharedXml)
  }

  // 2. Identifica qual planilha ler (por padrão primeira folha)
  let sheetPath = 'xl/worksheets/sheet1.xml'
  const workbookEntry = entries.get('xl/workbook.xml') || entries.get('xl/Workbook.xml')
  const workbookRelsEntry =
    entries.get('xl/_rels/workbook.xml.rels') || entries.get('xl/_rels/Workbook.xml.rels')

  if (workbookEntry) {
    const wbXml = await workbookEntry.getText()
    const wbRelsXml = workbookRelsEntry ? await workbookRelsEntry.getText() : undefined
    sheetPath = findFirstSheetPath(wbXml, wbRelsXml)
  }

  // Busca entrada com correspondência exata ou case-insensitive
  let sheetEntry = entries.get(sheetPath)
  if (!sheetEntry) {
    for (const [key, entry] of entries.entries()) {
      if (key.toLowerCase().startsWith('xl/worksheets/sheet') && key.endsWith('.xml')) {
        sheetEntry = entry
        break
      }
    }
  }

  if (!sheetEntry) {
    throw new Error('Nenhuma planilha (worksheet) encontrada no arquivo .xlsx.')
  }

  const sheetXml = await sheetEntry.getText()
  return parseWorksheetXml(sheetXml, sharedStrings)
}
