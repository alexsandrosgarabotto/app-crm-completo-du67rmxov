import pb from '@/lib/pocketbase/client'
import type { CompanySettings, User, UserRole } from '@/types/crm'

export const companyService = {
  async getSettings(): Promise<CompanySettings | null> {
    try {
      const records = await pb.collection('company_settings').getFullList<CompanySettings>({
        limit: 1,
      })
      return records[0] || null
    } catch {
      return null
    }
  },

  async updateSettings(id: string, data: Partial<CompanySettings>): Promise<CompanySettings> {
    return await pb.collection('company_settings').update<CompanySettings>(id, data)
  },

  async createSettings(data: Partial<CompanySettings>): Promise<CompanySettings> {
    return await pb.collection('company_settings').create<CompanySettings>(data)
  },

  async getTeamMembers(): Promise<User[]> {
    return await pb.collection('users').getFullList<User>({
      sort: 'name',
    })
  },

  /**
   * Cria um membro da equipe já com a senha definida pelo dono.
   * Não há envio de e-mail de convite: o dono repassa e-mail + senha por fora
   * (WhatsApp, pessoalmente) e o membro faz login imediatamente.
   */
  async inviteOrAddMember(data: {
    name: string
    email: string
    role: UserRole
    phone?: string
    password: string
  }): Promise<User> {
    return await pb.collection('users').create<User>({
      email: data.email,
      name: data.name,
      role: data.role,
      phone: data.phone || '',
      password: data.password,
      passwordConfirm: data.password,
    })
  },

  /** Redefine a senha de um membro da equipe (ação do dono, sem e-mail). */
  async resetMemberPassword(id: string, password: string): Promise<User> {
    return await pb.collection('users').update<User>(id, {
      password,
      passwordConfirm: password,
    })
  },

  /** Edita nome, e-mail e telefone de um membro da equipe (ação do dono). */
  async updateTeamMember(
    id: string,
    data: { name: string; email: string; phone?: string },
  ): Promise<User> {
    return await pb.collection('users').update<User>(id, {
      name: data.name,
      email: data.email,
      phone: data.phone || '',
    })
  },

  /** Troca a senha do usuário autenticado (valida a senha atual no backend). */
  async changeMyPassword(oldPassword: string, password: string): Promise<void> {
    const id = pb.authStore.record?.id
    if (!id) throw new Error('Usuário não autenticado.')
    await pb.collection('users').update<User>(id, {
      oldPassword,
      password,
      passwordConfirm: password,
    })
  },

  async updateUserRole(id: string, role: UserRole): Promise<User> {
    return await pb.collection('users').update<User>(id, { role })
  },

  async deleteTeamMember(id: string): Promise<boolean> {
    return await pb.collection('users').delete(id)
  },
}
