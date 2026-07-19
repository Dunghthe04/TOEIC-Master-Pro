import api from '@/api/axios'
import type { SrsCard, SrsProgress } from '@/types/vocabulary.types'

export const SrsService = {
  // Bắt đầu học 1 từ → tạo UserVocabulary
  learn: (vocabularyId: string) =>
    api.post<SrsCard>(`/srs/learn/${vocabularyId}`).then(r => r.data),

  // Thẻ đến hạn ôn hôm nay
  getDue: () =>
    api.get<SrsCard[]>('/srs/due').then(r => r.data),

  // Nộp kết quả ôn (quality 0–5)
  review: (vocabularyId: string, quality: number) =>
    api.post<SrsCard>('/srs/review', { vocabularyId, quality }).then(r => r.data),

  // Thống kê tiến độ
  getProgress: () =>
    api.get<SrsProgress>('/srs/progress').then(r => r.data),
}
