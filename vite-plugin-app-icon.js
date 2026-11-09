// Plugin Vite que gera /icon.png (1024x1024) a partir do mesmo desenho de public/icon.svg,
// sem dependências de canvas: PNG codificado em JS puro (zlib + chunks manuais).
// Fundo #128C7E sólido, traços brancos (stroke 64) do logotipo.
import zlib from 'node:zlib'

const BG = [18, 140, 126]
const FG = [255, 255, 255]
const STROKE = 64
// Segmentos em coordenadas de 1024px (mesmos traços de public/icon.svg).
const SEGMENTS = [
  [
    [200, 702],
    [340, 322],
  ],
  [
    [340, 322],
    [480, 702],
  ],
  [
    [252, 560],
    [428, 560],
  ],
  [
    [788, 354],
    [572, 354],
  ],
  [
    [572, 354],
    [572, 512],
  ],
  [
    [572, 512],
    [788, 512],
  ],
  [
    [788, 512],
    [788, 670],
  ],
  [
    [788, 670],
    [572, 670],
  ],
]

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

const crc32 = (buf) => {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

const distToSegment = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(ax + t * dx - px, ay + t * dy - py)
}

export const renderIconPng = (size = 1024) => {
  const scale = size / 1024
  const half = (STROKE * scale) / 2
  const segs = SEGMENTS.map(([[ax, ay], [bx, by]]) => [
    ax * scale,
    ay * scale,
    bx * scale,
    by * scale,
  ])
  const rowLen = size * 3 + 1
  const raw = Buffer.alloc(rowLen * size)
  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0 // filtro "None"
    for (let x = 0; x < size; x++) {
      const inside = segs.some(
        ([ax, ay, bx, by]) => distToSegment(x + 0.5, y + 0.5, ax, ay, bx, by) <= half,
      )
      const c = inside ? FG : BG
      const o = y * rowLen + 1 + x * 3
      raw[o] = c[0]
      raw[o + 1] = c[1]
      raw[o + 2] = c[2]
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // profundidade de bits
  ihdr[9] = 2 // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

export default function appIconPlugin() {
  let png = null
  const getPng = () => (png ??= renderIconPng(1024))
  return {
    name: 'app-icon-png',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.split('?')[0] === '/icon.png') {
          res.setHeader('Content-Type', 'image/png')
          res.end(getPng())
          return
        }
        next()
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'icon.png', source: getPng() })
    },
  }
}
