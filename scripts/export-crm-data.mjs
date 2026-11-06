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
const pbToken = (
  process.argv[3]?.startsWith('eyJ') ? process.argv[3] : process.env.PB_TOKEN || ''
).trim()
const pbEmail =
  process.argv[3] && !process.argv[3].startsWith('eyJ')
    ? process.argv[3]
    : process.env.PB_EMAIL || process.env.PB_SUPERUSER_EMAIL || ''
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
  'whatsapp_conversations',
  'whatsapp_messages',
  'whatsapp_templates',
  'service_orders',
]

async function run() {
  const usingTokenMode = Boolean(pbToken)

  console.log('='.repeat(60))
  console.log('🚀 CRM Data Exporter (PocketBase)')
  console.log(`🌐 Backend URL: ${pbUrl}`)
  console.log(`📁 Diretório de saída: ${outputDir}`)
  console.log(
    usingTokenMode
      ? '🔑 Modo: token de sessão (PB_TOKEN)'
      : '🔑 Modo: e-mail/senha (Dica: você também pode usar PB_TOKEN do navegador)',
  )
  console.log('='.repeat(60))

  const pb = new PocketBase(pbUrl)
  pb.autoCancellation(false)

  let authenticated = false
  let authMode = ''

  if (usingTokenMode) {
    // -----------------------------------------------------------------
    // MODO 1: Token de sessão fornecido (PB_TOKEN)
    // -----------------------------------------------------------------
    console.log('🎫 PB_TOKEN detectado. Configurando token de sessão diretamente...')
    pb.authStore.save(pbToken, null)

    try {
      // Validar o token e obter os dados do usuário autenticado
      console.log('🔍 Validando token junto ao backend PocketBase...')
      const authData = await pb.collection('users').authRefresh({ requestKey: null })
      const userRecord = authData?.record || pb.authStore.record
      const userRole = userRecord?.role || 'indefinido'
      const userEmail = userRecord?.email || 'e-mail desconhecido'
      authenticated = true
      authMode = `token de sessão do navegador (usuário: ${userEmail}, papel: ${userRole})`
      console.log(`✅ Token válido! Autenticado como ${userEmail} (Papel: ${userRole})`)
    } catch (refreshErr) {
      // Se falhar o authRefresh de users, pode ser um token de superuser/admin ou o token expirou
      let superuserValidated = false

      // Tentar _superusers primeiro (PocketBase v0.23+)
      try {
        if (typeof pb.collection === 'function') {
          const superuserAuthData = await pb
            .collection('_superusers')
            .authRefresh({ requestKey: null })
          const superEmail = superuserAuthData?.record?.email || 'superuser'
          authenticated = true
          superuserValidated = true
          authMode = `token de superuser (_superusers: ${superEmail})`
          console.log(`✅ Token de superuser válido! (_superusers: ${superEmail})`)
        }
      } catch {
        // não é token de _superusers
      }

      if (!superuserValidated && pb.admins && typeof pb.admins.authRefresh === 'function') {
        try {
          const adminAuthData = await pb.admins.authRefresh({ requestKey: null })
          const adminEmail = adminAuthData?.admin?.email || 'admin'
          authenticated = true
          superuserValidated = true
          authMode = `token de superuser (admin: ${adminEmail})`
          console.log(`✅ Token de superuser válido! (Admin: ${adminEmail})`)
        } catch {
          // não é token de superuser
        }
      }

      // Se authRefresh falhou (por exemplo, endpoint refresh restrito ou token legado),
      // mas temos o ID no JWT do authStore, tentar um fallback com getOne em users
      if (!superuserValidated && pb.authStore.model?.id) {
        try {
          const userRec = await pb
            .collection('users')
            .getOne(pb.authStore.model.id, { requestKey: null })
          const userRole = userRec?.role || 'indefinido'
          const userEmail = userRec?.email || 'e-mail desconhecido'
          authenticated = true
          authMode = `token de sessão do navegador (usuário: ${userEmail}, papel: ${userRole})`
          console.log(`✅ Token válido! Autenticado como ${userEmail} (Papel: ${userRole})`)
        } catch {
          // falhou também
        }
      }

      if (!authenticated) {
        console.error('\n❌ Falha na autenticação via PB_TOKEN: token inválido ou expirado.')
        console.error(`   Detalhes retornados pelo servidor: ${refreshErr.message}`)
        console.error('\n💡 Como resolver:')
        console.error('   1. Abra o CRM no seu navegador e faça login.')
        console.error('   2. Pressione F12 para abrir o Console do Desenvolvedor.')
        console.error(
          '   3. Vá na aba Application (ou Armazenamento) > Local Storage > selecione o domínio.',
        )
        console.error('   4. Encontre a chave "pocketbase_auth" e copie o valor do campo "token".')
        console.error('   5. No PowerShell, defina o novo token:')
        console.error('      $env:PB_TOKEN = "seu_token_aqui"')
        console.error('      node scripts/export-crm-data.mjs')
        process.exit(1)
      }
    }
  } else {
    // -----------------------------------------------------------------
    // MODO 2: E-mail e Senha (fluxo existente)
    // -----------------------------------------------------------------
    if (!pbEmail || !pbPassword) {
      console.error('❌ Erro: Credenciais não fornecidas.')
      console.error('   Você pode exportar de duas formas:')
      console.error(
        '   1. Usando o token de sessão do seu navegador (RECOMENDADO se a senha tiver caracteres especiais):',
      )
      console.error('      $env:PB_TOKEN = "seu_token_copiado_do_localstorage"')
      console.error('      node scripts/export-crm-data.mjs')
      console.error('   2. Informando e-mail e senha por variáveis de ambiente:')
      console.error('      $env:PB_EMAIL = "usuario@empresa.com"')
      console.error('      $env:PB_PASSWORD = "senha"')
      console.error('      node scripts/export-crm-data.mjs')
      console.error('   3. Ou passando como argumentos:')
      console.error('      node scripts/export-crm-data.mjs [PB_URL] [EMAIL] [SENHA]')
      process.exit(1)
    }

    // 1. Primeiro tentar autenticar como superuser
    console.log(`🔑 Tentando autenticar como superuser: ${pbEmail}...`)
    try {
      if (typeof pb.collection === 'function') {
        try {
          await pb.collection('_superusers').authWithPassword(pbEmail, pbPassword)
          authenticated = true
          authMode = 'superuser (_superusers)'
          console.log('✅ Autenticado com sucesso como superuser (via _superusers).')
        } catch (errSuperusers) {
          if (pb.admins && typeof pb.admins.authWithPassword === 'function') {
            await pb.admins.authWithPassword(pbEmail, pbPassword)
            authenticated = true
            authMode = 'superuser (admins)'
            console.log('✅ Autenticado com sucesso como superuser (via admins).')
          } else {
            throw errSuperusers
          }
        }
      } else if (pb.admins && typeof pb.admins.authWithPassword === 'function') {
        await pb.admins.authWithPassword(pbEmail, pbPassword)
        authenticated = true
        authMode = 'superuser (admins)'
        console.log('✅ Autenticado com sucesso como superuser (via admins).')
      }
    } catch (superuserErr) {
      console.log(
        `ℹ️ Autenticação como superuser não concluída (${superuserErr.message}). Tentando como usuário da aplicação (users)...`,
      )
    }

    // 2. Se falhar, autenticar como usuário normal da coleção users (ex.: papel owner/seller)
    if (!authenticated) {
      try {
        console.log(
          `🔑 Tentando autenticar como usuário do sistema na coleção 'users': ${pbEmail}...`,
        )
        const authData = await pb.collection('users').authWithPassword(pbEmail, pbPassword)
        authenticated = true
        const userRole = authData?.record?.role || 'indefinido'
        authMode = `usuário comum da aplicação (users, papel: ${userRole})`
        console.log(`✅ Autenticado com sucesso como usuário da aplicação! (Papel: ${userRole})`)
      } catch (userErr) {
        // 3. Se ambas falharem, mensagem clara em português de que e-mail/senha estão incorretos e sair com erro
        console.error('❌ Falha na autenticação: e-mail ou senha incorretos.')
        console.error(`   Detalhes da tentativa superuser: erro de credenciais ou permissão.`)
        console.error(`   Detalhes da tentativa usuário: ${userErr.message}`)
        console.error('   Verifique o e-mail e senha informados.')
        console.error('\n💡 Dica importante:')
        console.error('   Se a sua senha contiver caracteres especiais ($ ou @) no PowerShell,')
        console.error('   use o modo de autenticação por token de sessão (sem digitar senha):')
        console.error('   1. Abra o CRM no navegador onde já está logado.')
        console.error(
          '   2. F12 > Application/Armazenamento > Local Storage > pocketbase_auth > copie o token.',
        )
        console.error('   3. Rode no PowerShell:')
        console.error('      $env:PB_TOKEN = "seu_token_copiado"')
        console.error('      node scripts/export-crm-data.mjs')
        process.exit(1)
      }
    }
  }

  console.log(`🔒 Modo de autenticação ativo: ${authMode}`)
  console.log(`🎫 Token de autenticação configurado para todas as requisições.`)

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
      // Se for erro de autenticação (401/403) durante a exportação, o token expirou no meio do processo
      if (err.status === 401 || err.status === 403) {
        console.log(`\n❌ Erro de autorização ao ler [${colName}]: ${err.message}`)
        console.error(
          '   O token de autenticação expirou ou não possui permissão para esta coleção.',
        )
        if (usingTokenMode) {
          console.error(
            '   Faça login novamente no CRM, copie o novo token do Local Storage e execute novamente.',
          )
        }
        process.exit(1)
      }

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
