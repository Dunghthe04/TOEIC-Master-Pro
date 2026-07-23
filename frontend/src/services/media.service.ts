import api from '@/api/axios'

export type MediaUploadResult = {
    url: string
    fileName: string
}

/** Upload audio Listening — optional testId gom theo đề. */
export async function uploadAudio(file: File, testId?: string): Promise<MediaUploadResult> {
    const form = new FormData()
    form.append('file', file)
    const r = await api.post<MediaUploadResult>('/media/audio', form, {
        params: testId ? { testId } : undefined,
        headers: { 'Content-Type': 'multipart/form-data' },
    })
    return r.data
}

/** Upload ảnh Part 1. */
export async function uploadImage(file: File, testId?: string): Promise<MediaUploadResult> {
    const form = new FormData()
    form.append('file', file)
    const r = await api.post<MediaUploadResult>('/media/image', form, {
        params: testId ? { testId } : undefined,
        headers: { 'Content-Type': 'multipart/form-data' },
    })
    return r.data
}
