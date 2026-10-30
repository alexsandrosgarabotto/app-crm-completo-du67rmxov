#!/usr/bin/env node

/**
 * Script de Importação de Dados do CRM (PocketBase)
 *
 * Uso:
 *   node scripts/import-crm-data.mjs [PB_TARGET_URL] [SUPERUSER_EMAIL] [SUPERUSER_PASSWORD] [BACKUP_DIR]
 * Ou variáveis de ambiente:
 *   PB_URL=https://api.seudominio.com PB_EMAIL=admin@admin.com PB_PASSWORD=minhasenha node scripts/import-crm-data.mjs
 *
 * Características:
 *   - Preserva os IDs originais (evita quebrar relações entre clientes, deals, tarefas, faturas etc.)
 *   - Idempotente: se o registro com o ID já existir no destino, atualiza seus dados sem duplicar
 *   - Lida com senhas padrão temporárias ao recriar usuários caso seja necessário
 */

import fs from 'fs'
import path from 'path'
import PocketBase from 'pocketbase'

const pbUrl = (process.argv[2] || process.env.PB_URL || 'http://127.0.0.1:8090').replace(/\/+$/, '')
const pbEmail = process.argv[3] || process.env.PB_EMAIL || process.env.PB_SUPERUSER_EMAIL || ''
const pbPassword =
  process.argv[4] || process.env.PB_PASSWORD || process.env.PB_SUPERUSER_PASSWORD || ''
const inputDir = path.resolve(
  process.cwd(),
  process.argv[5] || process.env.BACKUP_DIR || 'data-backup',
)

// Ordem rigorosa para respeitar foreign keys / relações
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

// Campos protegidos do PocketBase que não devem ser enviados no payload de criação/atualização
const OMIT_FIELDS = new Set(['expand', 'collectionId', 'collectionName'])

function cleanPayload(record) {
  const payload = {}
  for (const [key, value] of Object.entries(record)) {
    if (OMIT_FIELDS.has(key)) continue
    // Para campos de data padrão do PocketBase, omitimos para deixar o PB gerenciar,
    // mas mantemos o ID explicitamente para preservar integridade relacional
    if (key === 'created' || key === 'updated') continue
    payload[key] = value
  }
  return payload
}

async function run() {
  console.log('='.repeat(60))
  console.log('📥 CRM Data Importer (PocketBase)')
  console.log(`🌐 Target Backend URL: ${pbUrl}`)
  console.log(`📁 Diretório de backup: ${inputDir}`)
  console.log('='.repeat(60))

  if (!fs.existsSync(inputDir)) {
    console.error(
      `❌ Diretório de backup "${inputDir}" não encontrado. Execute export-crm-data.mjs primeiro!`,
    )
    process.exit(1)
  }

  const pb = new PocketBase(pbUrl)
  pb.autoCancellation(false)

  // Autenticação Superuser no PocketBase Alvo
  if (pbEmail && pbPassword) {
    try {
      console.log(`🔑 Autenticando superuser [${pbEmail}] no PocketBase alvo...`)
      if (pb.collection('_superusers')) {
        try {
          await pb.collection('_superusers').authWithPassword(pbEmail, pbPassword)
          console.log('✅ Autenticado como superuser via _superusers.')
        } catch {
          await pb.admins.authWithPassword(pbEmail, pbPassword)
          console.log('✅ Autenticado como superuser via admins.')
        }
      } else {
        await pb.admins.authWithPassword(pbEmail, pbPassword)
        console.log('✅ Autenticado como superuser via admins.')
      }
    } catch (err) {
      console.error(`❌ Falha ao autenticar superuser no destino: ${err.message}`)
      console.error(
        '   Verifique se o email/senha foram criados com `./pocketbase superuser create` ou no painel.',
      )
      process.exit(1)
    }
  } else {
    console.warn('⚠️ AVISO: Nenhuma credencial de superuser fornecida.')
    console.warn(
      '   A importação com preservação de ID e regras de acesso restritas exige superuser.',
    )
  }

  let totalImported = 0
  let totalUpdated = 0
  let totalSkippedOrFailed = 0

  for (const colName of COLLECTIONS) {
    const filePath = path.join(inputDir, `${colName}.json`)
    if (!fs.existsSync(filePath)) {
      console.log(`ℹ️ [${colName}] Arquivo não encontrado (${filePath}), pulando...`)
      continue
    }

    let records = []
    try {
      records = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    } catch (err) {
      console.error(`❌ Erro ao ler JSON de [${colName}]: ${err.message}`)
      continue
    }

    if (!Array.isArray(records) || records.length === 0) {
      console.log(`ℹ️ [${colName}] Vazio (0 registros).`)
      continue
    }

    console.log(`\n📦 Processando [${colName}] (${records.length} registros)...`)

    for (const record of records) {
      if (!record.id) {
        console.warn(`  ⚠️ Registro sem ID encontrado em [${colName}], pulando.`)
        totalSkippedOrFailed++
        continue
      }

      const payload = cleanPayload(record)

      // Se for a coleção users, precisamos fornecer password temporário se estiver criando novo usuário
      if (colName === 'users') {
        if (!payload.password) {
          payload.password = 'MudarSenha@123'
          payload.passwordConfirm = 'MudarSenha@123'
        }
      }

      try {
        // Tenta buscar se o registro já existe no destino
        let existing = null
        try {
          existing = await pb.collection(colName).getOne(record.id, { requestKey: null })
        } catch {
          // Não existe ainda, tudo certo
        }

        if (existing) {
          // Atualiza registro existente (Idempotência)
          // Na atualização não precisamos de password/passwordConfirm a menos que especificado
          const updatePayload = { ...payload }
          delete updatePayload.id
          if (colName === 'users') {
            delete updatePayload.password
            delete updatePayload.passwordConfirm
          }

          await pb.collection(colName).update(record.id, updatePayload, { requestKey: null })
          totalUpdated++
          process.stdout.write(`  🔄 ${record.id} atualizado\n`)
        } else {
          // Cria novo registro preservando o ID original
          await pb.collection(colName).create(payload, { requestKey: null })
          totalImported++
          process.stdout.write(`  ✨ ${record.id} inserido\n`)
        }
      } catch (err) {
        console.error(`  ❌ Erro ao gravar registro ${record.id} em [${colName}]: ${err.message}`)
        if (err.data && err.data.data) {
          console.error(`     Detalhes:`, JSON.stringify(err.data.data))
        }
        totalSkippedOrFailed++
      }
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('🎉 Resumo da Importação:')
  console.log(`  Novos registros inseridos: ${totalImported}`)
  console.log(`  Registros atualizados:     ${totalUpdated}`)
  console.log(`  Falhas/Ignorados:          ${totalSkippedOrFailed}`)
  console.log('='.repeat(60))
}

run().catch((err) => {
  console.error('❌ Erro inesperado no importador:', err)
  process.exit(1)
})
