import { useCallback, useEffect, useState } from 'react'
import { SrsService } from '@/services/srs.service'
import { VocabularyService } from '@/services/vocabulary.service'
import type { SrsCard, SrsProgress, Vocabulary, VocabTopic } from '@/types/vocabulary.types'
import { VOCAB_TOPIC_LABELS } from '@/types/vocabulary.types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card'
import { BookOpen, RotateCcw, Plus } from 'lucide-react'
import { toast } from 'sonner'

type Tab = 'review' | 'browse'

// Nút đánh giá nhớ — map sang quality SM-2 (0–5)
const QUALITY_OPTIONS = [
  { q: 0, label: 'Quên', hint: 'Không nhớ gì', className: 'bg-red-600 hover:bg-red-700 text-white' },
  { q: 1, label: 'Rất khó', hint: 'Gần như quên', className: 'bg-orange-500 hover:bg-orange-600 text-white' },
  { q: 2, label: 'Khó', hint: 'Nhớ chậm', className: 'bg-amber-500 hover:bg-amber-600 text-white' },
  { q: 3, label: 'Tạm', hint: 'Nhớ được', className: 'bg-lime-600 hover:bg-lime-700 text-white' },
  { q: 4, label: 'Tốt', hint: 'Nhớ rõ', className: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  { q: 5, label: 'Rất chắc', hint: 'Thuộc ngay', className: 'bg-teal-700 hover:bg-teal-800 text-white' },
] as const

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function VocabularyPage() {
  const [tab, setTab] = useState<Tab>('review')
  const [progress, setProgress] = useState<SrsProgress | null>(null)
  const [due, setDue] = useState<SrsCard[]>([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [loadingDue, setLoadingDue] = useState(true)

  // Kho từ
  const [words, setWords] = useState<Vocabulary[]>([])
  const [topic, setTopic] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [loadingWords, setLoadingWords] = useState(false)
  const [learningId, setLearningId] = useState<string | null>(null)

  const loadProgress = useCallback(async () => {
    try {
      const p = await SrsService.getProgress()
      setProgress(p)
    } catch {
      // chưa login / lỗi mạng
    }
  }, [])

  const loadDue = useCallback(async () => {
    setLoadingDue(true)
    try {
      const cards = await SrsService.getDue()
      setDue(cards)
      setIndex(0)
      setFlipped(false)
    } catch {
      toast.error('Không tải được thẻ ôn hôm nay')
    } finally {
      setLoadingDue(false)
    }
  }, [])

  const loadWords = useCallback(async () => {
    setLoadingWords(true)
    try {
      const data = await VocabularyService.getList({
        topic: topic !== 'all' ? (Number(topic) as VocabTopic) : undefined,
        search: search.trim() || undefined,
      })
      setWords(data)
    } catch {
      toast.error('Không tải được kho từ')
    } finally {
      setLoadingWords(false)
    }
  }, [topic, search])

  useEffect(() => {
    loadProgress()
    loadDue()
  }, [loadProgress, loadDue])

  useEffect(() => {
    if (tab === 'browse') loadWords()
  }, [tab, loadWords])

  const current = due[index] ?? null

  const handleReview = async (quality: number) => {
    if (!current || reviewing) return
    setReviewing(true)
    try {
      await SrsService.review(current.vocabularyId, quality)
      toast.success(`Đã ghi nhận (quality ${quality})`)
      // Bỏ thẻ hiện tại khỏi hàng đợi local
      const next = due.filter((_, i) => i !== index)
      setDue(next)
      setFlipped(false)
      if (index >= next.length) setIndex(Math.max(0, next.length - 1))
      await loadProgress()
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Không gửi được kết quả ôn')
    } finally {
      setReviewing(false)
    }
  }

  const handleLearn = async (id: string) => {
    setLearningId(id)
    try {
      await SrsService.learn(id)
      toast.success('Đã thêm vào lịch ôn SRS')
      await loadProgress()
      await loadDue()
    } catch (err: any) {
      const status = err.response?.status
      toast.error(
        status === 401
          ? 'Phiên đăng nhập hết hạn. Đăng nhập lại rồi thử tiếp.'
          : (err.response?.data?.error ?? 'Không thêm được từ')
      )
    } finally {
      setLearningId(null)
    }
  }

  const totalBar = Math.max(progress?.totalTracking ?? 0, 1)

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Từ vựng</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ôn flashcard theo SRS (SM-2) và thêm từ mới từ kho.
        </p>
      </div>

      {/* Thanh tiến độ SRS */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tiến độ học từ</CardTitle>
          <CardDescription>
            {progress
              ? `${progress.totalTracking} từ đang theo dõi · ${progress.dueToday} đến hạn hôm nay`
              : 'Đang tải tiến độ...'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Đến hạn hôm nay</span>
                <span>{progress?.dueToday ?? 0}</span>
              </div>
              <ProgressBar value={progress?.dueToday ?? 0} max={totalBar} color="bg-amber-500" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Đang học</span>
                <span>{progress?.learning ?? 0}</span>
              </div>
              <ProgressBar value={progress?.learning ?? 0} max={totalBar} color="bg-blue-500" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Đã thuộc</span>
                <span>{progress?.learned ?? 0}</span>
              </div>
              <ProgressBar value={progress?.learned ?? 0} max={totalBar} color="bg-emerald-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tab */}
      <div className="flex gap-2">
        <Button
          variant={tab === 'review' ? 'default' : 'outline'}
          onClick={() => setTab('review')}
        >
          <BookOpen className="mr-2 h-4 w-4" />
          Ôn hôm nay ({due.length})
        </Button>
        <Button
          variant={tab === 'browse' ? 'default' : 'outline'}
          onClick={() => setTab('browse')}
        >
          Kho từ
        </Button>
      </div>

      {tab === 'review' && (
        <div className="mx-auto max-w-xl space-y-4">
          {loadingDue ? (
            <p className="text-muted-foreground">Đang tải thẻ...</p>
          ) : !current ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Không còn thẻ đến hạn. Vào <strong>Kho từ</strong> để thêm từ mới, hoặc quay lại sau.
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="text-center text-sm text-muted-foreground">
                Thẻ {Math.min(index + 1, due.length)} / {due.length}
              </p>

              {/* Flashcard — bấm để lật */}
              <button
                type="button"
                className="w-full text-left"
                onClick={() => setFlipped(f => !f)}
              >
                <Card className="min-h-[240px] border-2 transition-shadow hover:shadow-md">
                  <CardHeader className="flex flex-row items-start justify-between gap-2">
                    <div>
                      <Badge variant="secondary">{VOCAB_TOPIC_LABELS[current.topic]}</Badge>
                      <Badge variant="outline" className="ml-2">{current.wordType}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {flipped ? 'Mặt sau' : 'Mặt trước'} · bấm để lật
                    </span>
                  </CardHeader>
                  <CardContent className="flex min-h-[140px] flex-col items-center justify-center gap-2 text-center">
                    {!flipped ? (
                      <>
                        <p className="text-3xl font-bold tracking-tight">{current.word}</p>
                        <p className="text-muted-foreground">{current.phonetic || '—'}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-xl font-semibold">{current.definition}</p>
                        {current.definitionEn && (
                          <p className="text-sm text-muted-foreground">{current.definitionEn}</p>
                        )}
                        {current.exampleSentence && (
                          <p className="mt-2 text-sm italic text-gray-600">
                            “{current.exampleSentence}”
                          </p>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </button>

              {flipped && (
                <div className="space-y-2">
                  <p className="text-center text-sm font-medium">Bạn nhớ từ này thế nào?</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {QUALITY_OPTIONS.map(opt => (
                      <Button
                        key={opt.q}
                        disabled={reviewing}
                        className={opt.className}
                        onClick={() => handleReview(opt.q)}
                        title={opt.hint}
                      >
                        {opt.q} · {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setFlipped(false)} disabled={!flipped}>
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  Xem lại mặt trước
                </Button>
                <Button variant="ghost" size="sm" onClick={loadDue}>
                  Làm mới hàng đợi
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'browse' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Select value={topic} onValueChange={setTopic}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Chủ đề" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả chủ đề</SelectItem>
                {(Object.entries(VOCAB_TOPIC_LABELS) as [string, string][]).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="max-w-xs"
              placeholder="Tìm từ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadWords()}
            />
            <Button variant="outline" onClick={loadWords}>Tìm</Button>
          </div>

          {loadingWords ? (
            <p className="text-muted-foreground">Đang tải kho từ...</p>
          ) : words.length === 0 ? (
            <p className="text-muted-foreground">Không có từ phù hợp. CM cần thêm từ (Day 22 API).</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {words.map(w => (
                <Card key={w.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg">{w.word}</CardTitle>
                      <Badge variant="secondary">{VOCAB_TOPIC_LABELS[w.topic]}</Badge>
                    </div>
                    <CardDescription>{w.phonetic || w.wordType}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <p>{w.definition}</p>
                    {w.definitionEn && (
                      <p className="mt-1 text-muted-foreground">{w.definitionEn}</p>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      variant="outline"
                      disabled={learningId === w.id}
                      onClick={() => handleLearn(w.id)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Thêm vào ôn SRS
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
