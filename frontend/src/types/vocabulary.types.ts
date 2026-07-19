// Khớp VocabTopic enum backend
export type VocabTopic =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export const VOCAB_TOPIC_LABELS: Record<VocabTopic, string> = {
  1: 'Business',
  2: 'Finance',
  3: 'Travel',
  4: 'Health',
  5: 'Technology',
  6: 'Office',
  7: 'Marketing',
  8: 'Legal',
  9: 'General',
}

// Khớp VocabularyResponse Day 22
export interface Vocabulary {
  id: string
  word: string
  phonetic: string
  definition: string
  definitionEn: string
  exampleSentence: string | null
  audioUrl: string | null
  topic: VocabTopic
  wordType: string
  createdAt: string
}

export interface VocabularyFilter {
  topic?: VocabTopic
  search?: string
}

// Khớp SrsCardResponse Day 23
export interface SrsCard {
  vocabularyId: string
  word: string
  phonetic: string
  definition: string
  definitionEn: string
  exampleSentence: string | null
  audioUrl: string | null
  topic: VocabTopic
  wordType: string
  repetitionCount: number
  easeFactor: number
  intervalDays: number
  nextReviewDate: string
  isLearned: boolean
}

// Khớp SrsProgressResponse
export interface SrsProgress {
  totalTracking: number
  dueToday: number
  learned: number
  learning: number
}
