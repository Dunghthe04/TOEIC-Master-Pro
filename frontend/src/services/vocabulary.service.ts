import api from '@/api/axios'
import type { Vocabulary, VocabularyFilter } from '@/types/vocabulary.types'

export const VocabularyService = {
  getList: (filter?: VocabularyFilter) =>
    api.get<Vocabulary[]>('/vocabulary', { params: filter }).then(r => r.data),

  getById: (id: string) =>
    api.get<Vocabulary>(`/vocabulary/${id}`).then(r => r.data),
}
