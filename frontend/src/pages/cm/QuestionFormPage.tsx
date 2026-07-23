import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { QuestionService } from '@/services/question.service'
import { toast } from 'sonner'
import type { DifficultyLevel, CreateQuestionRequest } from '@/types/question.types'
import RichTextEditor from '@/components/editor/RichTextEditor'
import MediaUploadField from '@/components/cm/MediaUploadField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const schema = z.object({
    part: z.number().min(1).max(7),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']),
    content: z.string().min(1, 'Nội dung không được trống'),
    explanation: z.string().min(1, 'Giải thích không được trống'),
    audioUrl: z.string().optional(),
    imageUrl: z.string().optional(),
    passage: z.string().optional(),
    tags: z.string(),
    isPublished: z.boolean(),
    options: z.array(z.object({
        label: z.string(),
        content: z.string().min(1, 'Đáp án không được trống'),
        isCorrect: z.boolean(),
    })).length(4),
})

type FormData = z.infer<typeof schema>

const defaultOptions = ['A', 'B', 'C', 'D'].map(label => ({
    label, content: '', isCorrect: false,
}))

export default function QuestionFormPage() {
    const navigate = useNavigate()
    const { id } = useParams<{ id?: string }>()
    const isEdit = !!id
    const [submitting, setSubmitting] = useState(false)

    const { register, handleSubmit, setValue, watch, control, formState: { errors } } =
        useForm<FormData>({
            resolver: zodResolver(schema),
            defaultValues: {
                part: 1,
                difficulty: 'Medium',
                content: '',
                explanation: '',
                isPublished: false,
                tags: '',
                options: defaultOptions,
            },
        })

    const { fields } = useFieldArray({ control, name: 'options' })
    const content = watch('content')
    const explanation = watch('explanation')
    const options = watch('options')
    const isPublished = watch('isPublished')

    useEffect(() => {
        if (!isEdit) return
        QuestionService.getById(id!).then(q => {
            setValue('part', q.part)
            setValue('difficulty', q.difficulty)
            setValue('content', q.content)
            setValue('explanation', q.explanation)
            setValue('audioUrl', q.audioUrl ?? '')
            setValue('imageUrl', q.imageUrl ?? '')
            setValue('passage', q.passage ?? '')
            setValue('tags', q.tags.join(', '))
            setValue('isPublished', q.isPublished)
            setValue('options', q.options.map(o => ({
                label: o.label, content: o.content, isCorrect: o.isCorrect,
            })))
        })
    }, [id])

    const onSubmit = async (data: FormData) => {
        setSubmitting(true)
        try {
            const payload: CreateQuestionRequest = {
                part: data.part,
                difficulty: data.difficulty,
                content: data.content,
                explanation: data.explanation,
                isPublished: data.isPublished,
                options: data.options,
                tags: data.tags.split(',').map(t => t.trim()).filter(Boolean),
                audioUrl: data.audioUrl || undefined,
                imageUrl: data.imageUrl || undefined,
                passage: data.passage || undefined,
            }
            if (isEdit) {
                await QuestionService.update(id!, payload)
                toast.success('Cập nhật câu hỏi thành công!')
            } else {
                await QuestionService.create(payload)
                toast.success('Tạo câu hỏi thành công!')
            }
            navigate('/cm/questions')
        } catch {
            toast.error('Có lỗi xảy ra, vui lòng thử lại.')
        } finally {
            setSubmitting(false)
        }
    }

    const setCorrect = (index: number) => {
        options.forEach((_, i) => setValue(`options.${i}.isCorrect`, i === index))
    }

    return (
        <div className="p-6 max-w-3xl space-y-6">
            <h1 className="text-2xl font-bold">{isEdit ? 'Sửa câu hỏi' : 'Tạo câu hỏi mới'}</h1>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

                {/* Part + Difficulty */}
                <div className="flex gap-4">
                    <div className="space-y-1 flex-1">
                        <Label>Part</Label>
                        <Select value={String(watch('part'))} onValueChange={v => setValue('part', Number(v))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {[1, 2, 3, 4, 5, 6, 7].map(p => (
                                    <SelectItem key={p} value={String(p)}>Part {p}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1 flex-1">
                        <Label>Độ khó</Label>
                        <Select value={watch('difficulty')} onValueChange={v => setValue('difficulty', v as DifficultyLevel)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Easy">Dễ</SelectItem>
                                <SelectItem value="Medium">Trung bình</SelectItem>
                                <SelectItem value="Hard">Khó</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Nội dung câu hỏi */}
                <div className="space-y-1">
                    <Label>Nội dung câu hỏi</Label>
                    <RichTextEditor value={content} onChange={v => setValue('content', v)} />
                    {errors.content && <p className="text-sm text-red-500">{errors.content.message}</p>}
                </div>

                {/* Passage (Part 6-7) */}
                <div className="space-y-1">
                    <Label>Passage (Part 6–7, tùy chọn)</Label>
                    <RichTextEditor
                        value={watch('passage') ?? ''}
                        onChange={v => setValue('passage', v)}
                    />
                </div>

                {/* Audio — upload file, URL tự điền */}
                <MediaUploadField
                    kind="audio"
                    label="Audio (Part 1–4)"
                    hint={`Đặt tên file theo quy ước E26-T01-1.mp3 (mã đề-mã test-số câu) khi upload thủ công.`}
                    value={watch('audioUrl') ?? ''}
                    onChange={(url) => setValue('audioUrl', url)}
                />

                {/* Ảnh Part 1 */}
                <MediaUploadField
                    kind="image"
                    label="Ảnh (Part 1)"
                    hint="Chọn file .jpg / .png cho câu Photographs."
                    value={watch('imageUrl') ?? ''}
                    onChange={(url) => setValue('imageUrl', url)}
                />

                {/* 4 đáp án */}
                <div className="space-y-2">
                    <Label>Đáp án</Label>
                    {fields.map((field, i) => (
                        <div key={field.id} className="flex items-center gap-3">
                            <span className="w-6 font-medium text-sm">{options[i]?.label}</span>
                            <Input
                                {...register(`options.${i}.content`)}
                                placeholder={`Đáp án ${options[i]?.label}`}
                                className="flex-1"
                            />
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="radio"
                                    name="correctAnswer"
                                    checked={options[i]?.isCorrect}
                                    onChange={() => setCorrect(i)}
                                    className="w-4 h-4 accent-green-600"
                                />
                                <span className="text-sm text-muted-foreground">Đúng</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Giải thích */}
                <div className="space-y-1">
                    <Label>Giải thích đáp án</Label>
                    <RichTextEditor value={explanation} onChange={v => setValue('explanation', v)} />
                    {errors.explanation && <p className="text-sm text-red-500">{errors.explanation.message}</p>}
                </div>

                {/* Tags */}
                <div className="space-y-1">
                    <Label>Tags (cách nhau bởi dấu phẩy)</Label>
                    <Input {...register('tags')} placeholder="grammar, tense, vocabulary" />
                </div>

                {/* Published */}
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="isPublished"
                        checked={isPublished}
                        onCheckedChange={v => setValue('isPublished', !!v)}
                    />
                    <Label htmlFor="isPublished">Xuất bản ngay</Label>
                </div>

                <div className="flex gap-3 pt-2">
                    <Button type="submit" disabled={submitting}>
                        {submitting ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo câu hỏi'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => navigate('/cm/questions')}>
                        Hủy
                    </Button>
                </div>
            </form>
        </div>
    )
}
