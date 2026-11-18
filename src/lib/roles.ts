import type { User, UserRole } from '@/types/crm'

/**
 * Helpers centrais de papéis/permissões do CRM.
 *
 * Papéis:
 * - 'owner'   → Dono: vê todos os módulos e gerencia a Equipe (Configurações).
 * - 'seller'  → Vendedor: vê todos os módulos operacionais, sem Configurações.
 * - 'tecnico' → Somente Ordens de Serviço: ao logar, vê APENAS /ordens-servico.
 */
export const TECNICO_ROLE: UserRole = 'tecnico'

/** Rota única liberada para o perfil "Somente Ordens de Serviço". */
export const TECNICO_HOME = '/ordens-servico'

export function isTecnico(user: Pick<User, 'role'> | null | undefined): boolean {
  return user?.role === TECNICO_ROLE
}

export function isOwner(user: Pick<User, 'role'> | null | undefined): boolean {
  return user?.role === 'owner'
}

/** Verdadeiro quando o usuário pode acessar a rota informada. */
export function canAccessRoute(
  user: Pick<User, 'role'> | null | undefined,
  pathname: string,
): boolean {
  if (!user) return false
  if (isTecnico(user)) {
    // Somente o módulo de Ordens de Serviço (com ou sem query, ex.: ?os=ID).
    return pathname === TECNICO_HOME || pathname === `${TECNICO_HOME}/`
  }
  return true
}

/** Título curto do papel para badges. */
export function roleShortLabel(role: UserRole | undefined): string {
  switch (role) {
    case 'owner':
      return 'Dono'
    case 'tecnico':
      return 'Somente OS'
    default:
      return 'Vendedor'
  }
}
