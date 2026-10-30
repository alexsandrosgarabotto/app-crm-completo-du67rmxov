import PocketBase from 'pocketbase'

// URL padrão para fallback caso a variável de ambiente não seja fornecida
export const DEFAULT_POCKETBASE_URL = 'https://app-crm-completo-7ca4b.shrd01.internal.goskip.dev'

// Permite customizar o backend via VITE_POCKETBASE_URL no build ou runtime
export const POCKETBASE_URL = (
  import.meta.env.VITE_POCKETBASE_URL || DEFAULT_POCKETBASE_URL
).replace(/\/+$/, '')

const pb = new PocketBase(POCKETBASE_URL)
pb.autoCancellation(false)

export { pb }
export default pb
