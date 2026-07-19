import api from '@/api/axios'
import type { ExamSchedule, ExamScheduleFilter } from '@/types/exam-schedule.types'

export const ExamScheduleService = {
    getList: (filter?: ExamScheduleFilter) =>
        api.get<ExamSchedule[]>('/examschedule', { params: filter }).then(r => r.data),

    getById: (id: string) =>
        api.get<ExamSchedule>(`/examschedule/${id}`).then(r => r.data),

    // Id các kỳ thi đã đặt nhắc (chuông đỏ)
    getMyReminders: () =>
        api.get<string[]>('/examschedule/my-reminders').then(r => r.data),

    subscribeReminder: (id: string) =>
        api.post(`/examschedule/${id}/reminder`).then(r => r.data),

    unsubscribeReminder: (id: string) =>
        api.delete(`/examschedule/${id}/reminder`).then(r => r.data),

    // blob = file nhị phân (.ics), không phải JSON
    downloadIcal: async (id: string, fileName?: string) => {
        const res = await api.get(`/examschedule/${id}/ical`, { responseType: 'blob' })
        const url = URL.createObjectURL(res.data)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName ?? `exam-${id}.ics`
        a.click()
        URL.revokeObjectURL(url)
    },
}
