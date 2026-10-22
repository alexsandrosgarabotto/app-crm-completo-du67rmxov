import pb from '@/lib/pocketbase/client'
import type { CompanySettings, User } from '@/types/crm'

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

  async inviteOrAddMember(data: {
    name: string
    email: string
    role: 'owner' | 'seller'
    phone?: string
  }): Promise<User> {
    // Cria o usuário com uma senha temporária padrão que pode ser resetada
    const tempPassword = `Crm@${Math.floor(100000 + Math.random() * 900000)}`
    const created = await pb.collection('users').create<User>({
      email: data.email,
      name: data.name,
      role: data.role,
      phone: data.phone || '',
      password: tempPassword,
      passwordConfirm: tempPassword,
    })

    try {
      // Dispara e-mail de recuperação/redefinição para o novo colaborador
      await pb.collection('users').requestPasswordReset(data.email)
    } catch {
      // Best-effort
    }

    return created
  },

  async updateUserRole(id: string, role: 'owner' | 'seller'): Promise<User> {
    return await pb.collection('users').update<User>(id, { role })
  },

  async deleteTeamMember(id: string): Promise<boolean> {
    return await pb.collection('users').delete(id)
  },
}
