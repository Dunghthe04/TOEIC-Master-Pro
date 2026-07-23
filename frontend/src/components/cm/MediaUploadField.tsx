/**
 * Ô upload audio/ảnh cho CM — chọn file → API lưu → tự điền URL (không gõ tay).
 */
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { uploadAudio, uploadImage } from '@/services/media.service'
import { getMediaUrl } from '@/lib/media'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'

type Props = {
    kind: 'audio' | 'image'
    label: string
    hint?: string
    value: string
    onChange: (url: string) => void
    /** Gom file theo đề: uploads/tests/{testId}/... */
    testId?: string
    accept?: string
}

export default function MediaUploadField({
    kind,
    label,
    hint,
    value,
    onChange,
    testId,
    accept,
}: Props) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)

    const defaultAccept =
        kind === 'audio' ? 'audio/mpeg,audio/wav,audio/mp4,.mp3,.wav,.m4a' : 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return
        setUploading(true)
        try {
            const res =
                kind === 'audio'
                    ? await uploadAudio(file, testId)
                    : await uploadImage(file, testId)
            onChange(res.url)
            toast.success(`Đã upload: ${res.fileName}`)
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error
                ?? 'Upload thất bại'
            toast.error(msg)
        } finally {
            setUploading(false)
        }
    }

    const mediaSrc = getMediaUrl(value)

    return (
        <div className="space-y-2 rounded-lg border p-3">
            <Label>{label}</Label>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

            <div className="flex flex-wrap gap-2">
                <input
                    ref={inputRef}
                    type="file"
                    accept={accept ?? defaultAccept}
                    className="hidden"
                    onChange={(e) => void handleFile(e)}
                />
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => inputRef.current?.click()}
                >
                    <Upload className="w-4 h-4 mr-1" />
                    {uploading ? 'Đang upload…' : 'Chọn file'}
                </Button>
                {value && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
                        Xóa
                    </Button>
                )}
            </div>

            <Input
                value={value}
                readOnly
                placeholder="URL tự điền sau khi upload"
                className="text-xs font-mono"
            />

            {kind === 'audio' && value && (
                <audio controls preload="none" src={mediaSrc} className="w-full max-w-md" />
            )}
            {kind === 'image' && value && (
                <img src={mediaSrc} alt="" className="max-h-40 rounded border object-contain" />
            )}
        </div>
    )
}
