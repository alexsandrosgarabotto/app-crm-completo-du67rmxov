#!/usr/bin/env node

/**
 * Script de Exportação de Dados do CRM (PocketBase)
 *
 * Uso:
 *   node scripts/export-crm-data.mjs [PB_URL] [SUPERUSER_EMAIL] [SUPERUSER_PASSWORD]
 * Ou definindo variáveis de ambiente:
 *   PB_URL=https://api.seudominio.com PB_EMAIL=admin@admin.com PB_PASSWORD=minhasenha node scripts/export-crm-data.mjs
 *
 * Saída:
 *   Gera arquivos JSON na pasta `data-backup/` com todos os registros preservando IDs e relacionamentos.
 */

import fs from 'fs'
import path from 'path'
import PocketBase from 'pocketbase'

const pbUrl = (
  process.argv[2] ||
  process.env.PB_URL ||
  'https://app-crm-completo-7ca4b.shrd01.internal.goskip.dev'
).replace(/\/+$/, '')
const pbEmail = process.argv[3] || process.env.PB_EMAIL || process.env.PB_SUPERUSER_EMAIL || ''
const pbPassword =
  process.argv[4] || process.env.PB_PASSWORD || process.env.PB_SUPERUSER_PASSWORD || ''

const outputDir = path.resolve(process.cwd(), process.env.BACKUP_DIR || 'data-backup')

// Coleções na ordem recomendada de dependência
const COLLECTIONS = [
  'users',
  'company_settings',
  'fiscal_settings',
  'clients',
  'products',
  'services',
  'deals',
  'deal_items',
  'tasks',
  'invoices',
  'fixed_costs',
  'stock_movements',
  'cash_movements',
  'fiscal_documents',
]

async function run() {
  console.log('='.repeat(60))
  console.log('🚀 CRM Data Exporter (PocketBase)')
  console.log(`🌐 Backend URL: ${pbUrl}`)
  console.log(`📁 Diretório de saída: ${outputDir}`)
  console.log('='.repeat(60))

  const pb = new PocketBase(pbUrl)
  pb.autoCancellation(false)

  // Autenticação
  if (pbEmail && pbPassword) {
    try {
      console.log(`🔑 Tentando autenticar superuser: ${pbEmail}...`)
      // PocketBase v0.23+ usa _superusers
      if (pb.collection('_superusers')) {
        try {
          await pb.collection('_superusers').authWithPassword(pbEmail, pbPassword)
          console.log('✅ Autenticado com sucesso como superuser via _superusers.')
        } catch {
          await pb.admins.authWithPassword(pbEmail, pbPassword)
          console.log('✅ Autenticado com sucesso como superuser via admins.')
        }
      } else {
        await pb.admins.authWithPassword(pbEmail, pbPassword)
        console.log('✅ Autenticado com sucesso como superuser via admins.')
      }
    } catch (authErr) {
      console.warn(
        `⚠️ Não foi possível autenticar como superuser (${authErr.message}). Tentando leitura direta...`,
      )
    }
  } else {
    console.log(
      'ℹ️ Nenhuma credencial de superuser fornecida. Continuando com leitura anônima/regras públicas...',
    )
    console.log(
      '   (Dica: forneça email e senha para garantir que registros privados sejam exportados)',
    )
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const manifest = {
    exportDate: new Date().toISOString(),
    sourceUrl: pbUrl,
    collections: {},
  }

  let totalRecords = 0

  for (const colName of COLLECTIONS) {
    process.stdout.write(`📦 Exportando [${colName}]... `)
    try {
      const records = await pb.collection(colName).getFullList({
        sort: 'created',
        requestKey: null,
      })

      // Sanitizar dados para exportação limpa
      const sanitized = records.map((rec) => {
        const item = { ...rec }
        // Remover propriedades internas de expansão dinâmica se houver
        delete item.expand
        return item
      })

      const filePath = path.join(outputDir, `${colName}.json`)
      fs.writeFileSync(filePath, JSON.stringify(sanitized, null, 2), 'utf-8')

      manifest.collections[colName] = {
        count: sanitized.length,
        file: `${colName}.json`,
      }
      totalRecords += sanitized.length

      console.log(`✅ ${sanitized.length} registro(s) salvo(s)`)
    } catch (err) {
      console.log(`⚠️ Falha ao ler [${colName}]: ${err.message}`)
      manifest.collections[colName] = {
        count: 0,
        error: err.message,
      }
    }
  }

  const manifestPath = path.join(outputDir, 'manifest.json')
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')

  console.log('='.repeat(60))
  console.log(`✨ Exportação concluída! Total de registros exportados: ${totalRecords}`)
  console.log(`📄 Manifesto salvo em: ${manifestPath}`)
  console.log('='.repeat(60))
}

run().catch((err) => {
  console.error('❌ Erro fatal durante a exportação:', err)
  process.exit(1)
})
