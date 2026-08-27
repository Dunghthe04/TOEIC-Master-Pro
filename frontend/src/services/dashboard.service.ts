import api from '@/api/axios'
import type { TodayPlanResponse } from '@/types/test-session.types'

/**
 * Dashboard — dữ liệu cho khối "HÔM NAY".
 *
 * TÁCH RIÊNG khỏi `TestSessionService` cho khớp với backend: ba endpoint `stats/*` nằm ở
 * `/api/test-session` vì chúng nói về PHIÊN THI, còn `today` nằm ở `/api/dashboard` vì nó
 * nói về VIỆC HỌC — đọc cả từ vựng, hồ sơ, danh sách đề.
 *
 * Ba tab sắp làm (Sổ tay lỗi sai, Ngữ pháp theo lỗi, Lộ trình) đều thuộc nhóm sau, nên
 * chúng sẽ vào file này chứ không phình tiếp `test-session.service.ts`.
 */
export const DashboardService = {
    /** Việc nên làm hôm nay — câu sai, thẻ từ đến hạn, đã thi tuần này chưa. */
    getToday: () =>
        api.get<TodayPlanResponse>('/dashboard/today').then((r) => r.data),
}
