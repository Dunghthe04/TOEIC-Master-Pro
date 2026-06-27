import { useAuthStore } from '@/store/auth.store'

export default function DashboardPage() {
  const user = useAuthStore(state => state.user)
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
      <p className="mt-1 text-gray-500">Chào mừng {user?.fullName} đã trở lại!</p>
    </div>
  )
}