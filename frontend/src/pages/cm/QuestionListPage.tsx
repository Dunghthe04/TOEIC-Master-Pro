import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QuestionService } from '@/services/question.service'
import type { QuestionResponse } from '@/types/question.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Settings, Trash2 } from 'lucide-react'

export default function QuestionListPage() {
    const navigate = useNavigate()
    const [questions, setQuestions] = useState<QuestionResponse[]>([])
    const [search, setSearch] = useState('')
    const [part, setPart] = useState('all')
    const [difficulty, setDifficulty] = useState('all')
    const [loading, setLoading] = useState(true)
    const [deleteId, setDeleteId] = useState<string | null>(null)

    const load = async () => {
        setLoading(true)
        try {
            const data = await QuestionService.getList({
                part: part !== 'all' ? Number(part) : undefined,
                difficulty: difficulty !== 'all' ? difficulty : undefined,
            })
            setQuestions(data)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [part, difficulty])

    const handleDeleteConfirm = async () => {
        if (!deleteId) return
        await QuestionService.delete(deleteId)
        setQuestions(prev => prev.filter(q => q.id !== deleteId))
        setDeleteId(null)
    }

    const filtered = questions.filter(q =>
        q.content.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Quản lý câu hỏi</h1>
                <Button onClick={() => navigate('/cm/questions/create')}>
                    <Plus className="w-4 h-4 mr-2" />Tạo câu hỏi
                </Button>
            </div>

            <div className="flex gap-3 flex-wrap">
                <Input
                    placeholder="Tìm theo nội dung..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="max-w-sm"
                />
                <Select value={part} onValueChange={setPart}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tất cả Part</SelectItem>
                        {[1, 2, 3, 4, 5, 6, 7].map(p => (
                            <SelectItem key={p} value={String(p)}>Part {p}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tất cả độ khó</SelectItem>
                        <SelectItem value="Easy">Dễ</SelectItem>
                        <SelectItem value="Medium">Trung bình</SelectItem>
                        <SelectItem value="Hard">Khó</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {loading ? (
                <p className="text-muted-foreground">Đang tải...</p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nội dung</TableHead>
                            <TableHead>Part</TableHead>
                            <TableHead>Độ khó</TableHead>
                            <TableHead>Tags</TableHead>
                            <TableHead className="text-right">Thao tác</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground">
                                    Không có câu hỏi nào.
                                </TableCell>
                            </TableRow>
                        )}
                        {filtered.map(q => (
                            <TableRow key={q.id}>
                                <TableCell className="max-w-xs truncate"
                                    dangerouslySetInnerHTML={{ __html: q.content }}
                                />
                                <TableCell>Part {q.part}</TableCell>
                                <TableCell>
                                    <Badge variant={q.difficulty === 'Hard' ? 'destructive' : q.difficulty === 'Medium' ? 'secondary' : 'outline'}>
                                        {q.difficulty === 'Easy' ? 'Dễ' : q.difficulty === 'Medium' ? 'TB' : 'Khó'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {q.tags.join(', ')}
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button variant="outline" size="sm"
                                        onClick={() => navigate(`/cm/questions/${q.id}/edit`)}>
                                        <Settings className="w-4 h-4" />
                                    </Button>
                                    <Button variant="destructive" size="sm"
                                        onClick={() => setDeleteId(q.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            <AlertDialog open={!!deleteId} onOpenChange={(open: boolean) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
                        <AlertDialogDescription>Câu hỏi sẽ bị xóa vĩnh viễn.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-white hover:bg-destructive/90"
                            onClick={handleDeleteConfirm}
                        >Xóa</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

