import api from '@/api/axios'
import type { AdminOverview } from '@/types/admin.types'

export const AdminService = {
    getOverview: () => api.get<AdminOverview>('/admin/overview').then(r => r.data),
}
