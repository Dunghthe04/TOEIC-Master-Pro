import api from '@/api/axios'
import type { ExamSchedule, ExamScheduleFilter } from '@/types/exam-schedule.types'

export const ExamScheduleService = {
   getList: (filter?: ExamScheduleFilter) =>
        api.get<ExamSchedule[]>('/examschedule',{ params: filter }).then(r => r.data),
   getById: (id: string) =>
        api.get<ExamSchedule>(`/examschedule/${id}`).then(r => r.data),
}