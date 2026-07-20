import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TestService } from '@/services/test.service'
import type { TestSummary } from '@/types/test.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Trash2, Settings } from 'lucide-react'

export default function TestListPage() {
    const navigate = useNavigate();
    const [tests, setTests] = useState<TestSummary[]>([]);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'published' | 'unpublished'>('all')
    const [loading, setLoading] = useState(true)
    const [deleteId, setDeleteId] = useState<string | null>(null)

    const loadTests = async () => {
        setLoading(true);
        try {
            const isPublished =
                filter === 'published' ? true : filter === 'unpublished' ? false : undefined
            const data = await TestService.getList(isPublished);
            setTests(data);
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadTests() }, [filter]);

    const handleDeleteConfirm = async () => {
        if (!deleteId) return
        await TestService.delete(deleteId)
        setTests(prev => prev.filter(t => t.id !== deleteId))
        setDeleteId(null)
    }

    const filtered = tests.filter(t => t.title.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Quản lý đề thi</h1>
                <Button onClick={() => navigate('/cm/tests/create')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Tạo đề thi
                </Button>
            </div>

            <div className="flex gap-3">
                <Input
                    placeholder="Tìm kiếm theo tên..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="max-w-sm"
                />
                <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
                    <SelectTrigger className="w-44">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tất cả</SelectItem>
                        <SelectItem value="published">Đã xuất bản</SelectItem>
                        <SelectItem value="unpublished">Nháp</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {loading ? (
                <p className="text-muted-foreground">Đang tải...</p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tên đề thi</TableHead>
                            <TableHead>Series</TableHead>
                            <TableHead>Thời gian</TableHead>
                            <TableHead>Số câu</TableHead>
                            <TableHead>Trạng thái</TableHead>
                            <TableHead>Ngày tạo</TableHead>
                            <TableHead className="text-right">Thao tác</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center text-muted-foreground">
                                    Không có đề thi nào.
                                </TableCell>
                            </TableRow>
                        )}
                        {filtered.map(t => (
                            <TableRow key={t.id}>
                                <TableCell className="font-medium">{t.title}</TableCell>
                                <TableCell className="text-muted-foreground">{t.series || '—'}</TableCell>
                                <TableCell>{t.durationMinutes} phút</TableCell>
                                <TableCell>{t.questionCount} câu</TableCell>
                                <TableCell>
                                    <Badge variant={t.isPublished ? 'default' : 'secondary'}>
                                        {t.isPublished ? 'Đã xuất bản' : 'Nháp'}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {new Date(t.createdAt).toLocaleDateString('vi-VN')}
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => navigate(`/cm/tests/${t.id}/edit`)}
                                    >
                                        <Settings className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => setDeleteId(t.id)}
                                    >
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
                        <AlertDialogDescription>
                            Đề thi sẽ bị xóa vĩnh viễn và không thể khôi phục.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-white hover:bg-destructive/90"
                            onClick={handleDeleteConfirm}
                        >
                            Xóa
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}