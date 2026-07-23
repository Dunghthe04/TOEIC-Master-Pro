import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QuestionService } from '@/services/question.service'
import type { ImportResultResponse } from '@/types/question.types'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Upload, ArrowLeft, Download } from 'lucide-react'

export default function QuestionImportPage() {
    const navigate = useNavigate()
    const inputRef = useRef<HTMLInputElement>(null)

    const [file, setFile] = useState<File | null>(null)
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [result, setResult] = useState<ImportResultResponse | null>(null)

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0] ?? null
        if (!f) return
        if (!f.name.toLowerCase().endsWith('.xlsx')) {
            toast.error('Chỉ chấp nhận file .xlsx')
            e.target.value = ''
            return
        }
        setFile(f)
        setResult(null)
    }

    const handleImport = async () => {
        if (!file) return
        setConfirmOpen(false)
        setUploading(true)
        try {
            const data = await QuestionService.import(file)
            setResult(data)
            toast.success(`Import xong: ${data.successCount}/${data.totalRows} câu thành công`)
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error
                ?? 'Import thất bại'
            toast.error(msg)
        } finally {
            setUploading(false)
        }
    }

    const downloadTemplate = async () => {
        try {
            const blob = await QuestionService.downloadImportTemplate()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'toeic-questions-template.xlsx'
            a.click()
            URL.revokeObjectURL(url)
        } catch {
            toast.error('Không tải được file mẫu')
        }
    }

    return (
        <div className="p-6 space-y-6 max-w-3xl">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => navigate('/cm/questions')}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Quay lại
                </Button>
                <h1 className="text-2xl font-bold">Import câu hỏi từ Excel</h1>
            </div>

            <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">
                    Cột: Part, Difficulty, Content, Explanation, AudioUrl, ImageUrl,
                    Passage, Tags, IsPublished, A–D, CorrectAnswer,
                    <strong> OrderIndex, AudioFile, ImageFile</strong> (2 cột cuối: chỉ tên file, không gõ URL).
                </p>

                <Button variant="outline" size="sm" onClick={() => void downloadTemplate()}>
                    <Download className="w-4 h-4 mr-1" />
                    Tải Excel mẫu
                </Button>

                <Input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx"
                    onChange={onFileChange}
                />

                {file && (
                    <p className="text-sm">
                        Đã chọn: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
                    </p>
                )}

                <Button
                    disabled={!file || uploading}
                    onClick={() => setConfirmOpen(true)}
                >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploading ? 'Đang import...' : 'Import'}
                </Button>
            </div>

            {/* Báo cáo kết quả = "preview" sau khi import */}
            {result && (
                <div className="space-y-3 rounded-lg border p-4">
                    <h2 className="font-semibold">Kết quả import</h2>
                    <div className="flex gap-6 text-sm">
                        <span>Tổng dòng: <strong>{result.totalRows}</strong></span>
                        <span className="text-green-600">Thành công: <strong>{result.successCount}</strong></span>
                        <span className="text-red-600">Lỗi: <strong>{result.failedCount}</strong></span>
                    </div>

                    {result.errors.length > 0 && (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-24">Hàng</TableHead>
                                    <TableHead>Lý do</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {result.errors.map((e, i) => (
                                    <TableRow key={i}>
                                        <TableCell>{e.row}</TableCell>
                                        <TableCell>{e.reason}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}

                    <Button variant="outline" onClick={() => navigate('/cm/questions')}>
                        Về danh sách câu hỏi
                    </Button>
                </div>
            )}

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Xác nhận import</AlertDialogTitle>
                        <AlertDialogDescription>
                            Import file <strong>{file?.name}</strong>? Các dòng hợp lệ sẽ được lưu vào hệ thống ngay.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction onClick={handleImport}>Xác nhận</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}