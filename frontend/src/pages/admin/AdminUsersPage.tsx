/**
 * Quản lý tài khoản — /admin/users. Chỉ Admin.
 *
 * Làm được: tạo tài khoản mới (chủ yếu để lập tài khoản ContentManager cho nhân sự),
 * đổi vai, khoá/mở, gửi mail đặt lại mật khẩu, xác thực email thủ công.
 *
 * KHÔNG làm được, và là CỐ Ý:
 *   · Xem/đặt mật khẩu của người khác — chỉ gửi được mail để chính họ tự đặt. Admin
 *     không biết mật khẩu của ai thì không mạo danh được, và mọi hành động trong hệ
 *     thống vẫn quy được về đúng chủ tài khoản.
 *   · Xoá tài khoản — khoá là đủ để chặn truy cập, còn xoá user đã thi thì vướng FK
 *     TestSessions hoặc mất sạch lịch sử thi (méo thống kê toàn hệ thống).
 *
 * ⚠️ Ẩn/hiện nút ở đây chỉ là UX. Chặn thật nằm ở [Authorize(Roles="Admin")] trên
 * AdminUsersController + các kiểm tự-hại phía server (không tự bỏ vai Admin, không hạ
 * Admin cuối cùng, không tự khoá mình).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
    Ban, CheckCircle2, Eye, KeyRound, Loader2, Lock, MailCheck, Plus, Search,
    ShieldCheck, Unlock, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { AdminService } from '@/services/admin.service'
import type { AdminUser } from '@/types/admin.types'
import { useAuthStore } from '@/store/auth.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const ALL_ROLES = ['User', 'ContentManager', 'Admin'] as const
type RoleName = typeof ALL_ROLES[number]

const ROLE_LABELS: Record<string, string> = {
    User: 'Học viên',
    ContentManager: 'Quản lý nội dung',
    Admin: 'Quản trị viên',
}

const ROLE_STYLES: Record<string, string> = {
    User: 'bg-gray-100 text-gray-700',
    ContentManager: 'bg-blue-100 text-blue-700',
    Admin: 'bg-purple-100 text-purple-700',
}

const PAGE_SIZE = 20

function formatDate(iso: string | null): string {
    if (!iso) return '—'
    // vi-VN cho đúng dd/mm/yyyy — toLocaleDateString mặc định theo locale máy, khác nhau
    // giữa các máy nên phải chỉ định.
    return new Date(iso).toLocaleDateString('vi-VN')
}

/** Lấy message lỗi từ backend (khuôn { error }), có fallback cho lỗi mạng */
function errMessage(err: any, fallback: string): string {
    return err?.response?.data?.error
        ?? (err?.request && !err?.response
            ? 'Không kết nối được server. Thử lại sau.'
            : fallback)
}

export default function AdminUsersPage() {
    const me = useAuthStore(s => s.user)

    const [users, setUsers] = useState<AdminUser[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(true)

    const [searchInput, setSearchInput] = useState('')
    const [search, setSearch] = useState('')
    const [roleFilter, setRoleFilter] = useState<string>('')
    const [lockedOnly, setLockedOnly] = useState(false)

    /** Id đang có request chạy — để chỉ khoá nút của đúng dòng đó */
    const [busyId, setBusyId] = useState<string | null>(null)

    const [showCreate, setShowCreate] = useState(false)
    const [editRolesFor, setEditRolesFor] = useState<AdminUser | null>(null)
    const [confirmLock, setConfirmLock] = useState<AdminUser | null>(null)

    // Debounce ô tìm kiếm: không có thì mỗi ký tự là một request, gõ "nguyen" = 6 lần
    // gọi API và kết quả có thể về không đúng thứ tự.
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            setSearch(searchInput.trim())
            setPage(1)          // đổi từ khoá thì phải về trang 1, không thì đang ở trang 3 của kết quả cũ
        }, 400)
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    }, [searchInput])

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await AdminService.getUsers({
                search, role: roleFilter, lockedOnly, page, pageSize: PAGE_SIZE,
            })
            setUsers(res.items)
            setTotal(res.total)
        } catch (err) {
            toast.error(errMessage(err, 'Không tải được danh sách tài khoản.'))
            setUsers([])
            setTotal(0)
        } finally {
            setLoading(false)
        }
    }, [search, roleFilter, lockedOnly, page])

    useEffect(() => { load() }, [load])

    /** Bọc một hành động trên 1 dòng: khoá nút, toast kết quả, nạp lại danh sách */
    const runAction = async (
        user: AdminUser,
        action: () => Promise<{ message: string }>,
        fallbackError: string,
    ) => {
        setBusyId(user.id)
        try {
            const res = await action()
            toast.success(res.message)
            await load()
        } catch (err) {
            toast.error(errMessage(err, fallbackError))
        } finally {
            setBusyId(null)
        }
    }

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Quản lý tài khoản</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Tạo tài khoản, phân vai, khoá/mở và gửi mail đặt lại mật khẩu.
                    </p>
                </div>
                <Button onClick={() => setShowCreate(true)} className="gap-2">
                    <Plus size={16} /> Tạo tài khoản
                </Button>
            </div>

            {/* ── Bộ lọc ─────────────────────────────────────────────── */}
            <Card>
                <CardContent className="flex flex-wrap items-end gap-3 pt-6">
                    <div className="min-w-52 flex-1 space-y-1.5">
                        <Label htmlFor="q">Tìm kiếm</Label>
                        <div className="relative">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <Input
                                id="q"
                                value={searchInput}
                                onChange={e => setSearchInput(e.target.value)}
                                placeholder="Email hoặc họ tên…"
                                className="pl-9"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="role">Vai</Label>
                        <select
                            id="role"
                            value={roleFilter}
                            onChange={e => { setRoleFilter(e.target.value); setPage(1) }}
                            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                        >
                            <option value="">Tất cả</option>
                            {ALL_ROLES.map(r => (
                                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                        </select>
                    </div>

                    <label className="flex h-9 cursor-pointer items-center gap-2 text-sm text-gray-700">
                        <input
                            type="checkbox"
                            checked={lockedOnly}
                            onChange={e => { setLockedOnly(e.target.checked); setPage(1) }}
                            className="h-4 w-4 rounded border-gray-300"
                        />
                        Chỉ tài khoản bị khoá
                    </label>
                </CardContent>
            </Card>

            {/* ── Bảng ───────────────────────────────────────────────── */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <p className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
                            <Loader2 className="animate-spin" size={16} /> Đang tải…
                        </p>
                    ) : users.length === 0 ? (
                        <p className="py-12 text-center text-sm text-gray-500">
                            Không có tài khoản nào khớp điều kiện.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tài khoản</TableHead>
                                        <TableHead>Vai</TableHead>
                                        <TableHead>Trạng thái</TableHead>
                                        <TableHead className="text-right">Lượt thi</TableHead>
                                        <TableHead className="text-right">Điểm cao nhất</TableHead>
                                        <TableHead>Ngày tạo</TableHead>
                                        <TableHead className="text-right">Thao tác</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.map(u => {
                                        const isSelf = u.id === me?.id
                                        const busy = busyId === u.id
                                        return (
                                            <TableRow key={u.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2.5">
                                                        {u.avatarUrl ? (
                                                            <img src={u.avatarUrl} alt=""
                                                                className="h-8 w-8 rounded-full object-cover" />
                                                        ) : (
                                                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                                                                {u.fullName?.[0]?.toUpperCase() ?? '?'}
                                                            </span>
                                                        )}
                                                        <div className="min-w-0">
                                                            {/* Chỉ TÊN là link, không phải cả dòng: cột thao
                                                                tác có nút, bấm nút mà dòng cũng là link thì
                                                                vừa khoá tài khoản vừa nhảy sang trang khác. */}
                                                            <Link
                                                                to={`/admin/users/${u.id}`}
                                                                className="block truncate text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline"
                                                            >
                                                                {u.fullName}
                                                                {isSelf && (
                                                                    <span className="ml-1.5 text-xs font-normal text-blue-600">
                                                                        (bạn)
                                                                    </span>
                                                                )}
                                                            </Link>
                                                            <p className="truncate text-xs text-gray-500">{u.email}</p>
                                                        </div>
                                                    </div>
                                                </TableCell>

                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {u.roles.length === 0 ? (
                                                            <span className="text-xs text-gray-400">—</span>
                                                        ) : u.roles.map(r => (
                                                            <span key={r}
                                                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_STYLES[r] ?? 'bg-gray-100 text-gray-700'}`}>
                                                                {ROLE_LABELS[r] ?? r}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </TableCell>

                                                <TableCell>
                                                    <div className="space-y-1">
                                                        {u.isLockedOut ? (
                                                            <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                                                                <Ban size={12} /> Đang khoá
                                                            </span>
                                                        ) : (
                                                            <span className="flex items-center gap-1 text-xs text-green-600">
                                                                <CheckCircle2 size={12} /> Hoạt động
                                                            </span>
                                                        )}
                                                        {!u.emailConfirmed && (
                                                            <span className="block text-xs text-amber-600">
                                                                Chưa xác thực email
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>

                                                <TableCell className="text-right text-sm">{u.completedSessions}</TableCell>
                                                <TableCell className="text-right text-sm">
                                                    {u.bestScore ?? '—'}
                                                </TableCell>
                                                <TableCell className="text-sm text-gray-500">
                                                    {formatDate(u.createdAt)}
                                                </TableCell>

                                                <TableCell>
                                                    <div className="flex items-center justify-end gap-1">
                                                        {/* Link ở tên có thể không ai để ý — nút này nói rõ
                                                            là xem được chi tiết. */}
                                                        <Link
                                                            to={`/admin/users/${u.id}`}
                                                            title="Xem chi tiết & lịch sử thi"
                                                            aria-label="Xem chi tiết & lịch sử thi"
                                                            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
                                                        >
                                                            <Eye size={15} />
                                                        </Link>
                                                        <IconAction
                                                            title="Đổi vai"
                                                            onClick={() => setEditRolesFor(u)}
                                                            disabled={busy}
                                                            icon={<ShieldCheck size={15} />}
                                                        />
                                                        <IconAction
                                                            title="Gửi mail đặt lại mật khẩu"
                                                            onClick={() => runAction(u,
                                                                () => AdminService.sendPasswordReset(u.id),
                                                                'Không gửi được mail.')}
                                                            disabled={busy}
                                                            icon={<KeyRound size={15} />}
                                                        />
                                                        {!u.emailConfirmed && (
                                                            <IconAction
                                                                title="Xác thực email thủ công"
                                                                onClick={() => runAction(u,
                                                                    () => AdminService.confirmEmail(u.id),
                                                                    'Không xác thực được email.')}
                                                                disabled={busy}
                                                                icon={<MailCheck size={15} />}
                                                            />
                                                        )}
                                                        {u.isLockedOut ? (
                                                            <IconAction
                                                                title="Mở khoá"
                                                                onClick={() => runAction(u,
                                                                    () => AdminService.setLock(u.id, false),
                                                                    'Không mở khoá được.')}
                                                                disabled={busy}
                                                                icon={<Unlock size={15} />}
                                                                tone="success"
                                                            />
                                                        ) : (
                                                            <IconAction
                                                                // Tự khoá mình thì mất luôn quyền vào đây để tự mở —
                                                                // server cũng chặn, ẩn nút chỉ để không mời bấm.
                                                                title={isSelf
                                                                    ? 'Không thể tự khoá tài khoản của mình'
                                                                    : 'Khoá tài khoản'}
                                                                onClick={() => setConfirmLock(u)}
                                                                disabled={busy || isSelf}
                                                                icon={<Lock size={15} />}
                                                                tone="danger"
                                                            />
                                                        )}
                                                        {busy && <Loader2 size={14} className="animate-spin text-gray-400" />}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ── Phân trang ─────────────────────────────────────────── */}
            {total > 0 && (
                <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>
                        {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total} tài khoản
                    </span>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm"
                            disabled={page <= 1 || loading}
                            onClick={() => setPage(p => p - 1)}>
                            Trước
                        </Button>
                        <span className="text-xs text-gray-500">Trang {page}/{totalPages}</span>
                        <Button variant="outline" size="sm"
                            disabled={page >= totalPages || loading}
                            onClick={() => setPage(p => p + 1)}>
                            Sau
                        </Button>
                    </div>
                </div>
            )}

            {showCreate && (
                <CreateUserDialog
                    onClose={() => setShowCreate(false)}
                    onCreated={() => { setShowCreate(false); setPage(1); load() }}
                />
            )}

            {editRolesFor && (
                <EditRolesDialog
                    user={editRolesFor}
                    isSelf={editRolesFor.id === me?.id}
                    onClose={() => setEditRolesFor(null)}
                    onSaved={() => { setEditRolesFor(null); load() }}
                />
            )}

            <AlertDialog open={confirmLock !== null}
                onOpenChange={open => !open && setConfirmLock(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Khoá tài khoản?</AlertDialogTitle>
                        <AlertDialogDescription>
                            <b>{confirmLock?.fullName}</b> ({confirmLock?.email}) sẽ không đăng nhập
                            được nữa, và mọi phiên đang hoạt động bị thu hồi.
                            {(confirmLock?.completedSessions ?? 0) > 0 && (
                                <> Tài khoản này đã có {confirmLock?.completedSessions} lượt thi —
                                dữ liệu thi vẫn được giữ nguyên.</>
                            )}
                            {' '}Bạn có thể mở khoá lại bất cứ lúc nào.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-white hover:bg-destructive/90"
                            onClick={() => {
                                const u = confirmLock!
                                setConfirmLock(null)
                                runAction(u, () => AdminService.setLock(u.id, true),
                                    'Không khoá được tài khoản.')
                            }}
                        >
                            Khoá
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

/** Nút icon nhỏ trong cột thao tác — title là tooltip, cũng là nhãn cho screen reader */
function IconAction({ title, icon, onClick, disabled, tone }: {
    title: string
    icon: React.ReactNode
    onClick: () => void
    disabled?: boolean
    tone?: 'danger' | 'success'
}) {
    const color = tone === 'danger'
        ? 'text-red-600 hover:bg-red-50'
        : tone === 'success'
            ? 'text-green-600 hover:bg-green-50'
            : 'text-gray-500 hover:bg-gray-100'
    return (
        <button
            type="button"
            title={title}
            aria-label={title}
            onClick={onClick}
            disabled={disabled}
            className={`rounded-md p-1.5 transition-colors disabled:cursor-not-allowed
                        disabled:opacity-40 ${color}`}
        >
            {icon}
        </button>
    )
}

/** Khung popup dùng chung cho hai dialog dưới */
function Modal({ title, children, onClose }: {
    title: string
    children: React.ReactNode
    onClose: () => void
}) {
    // Esc để đóng — cùng hành vi với AuthDialog
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [onClose])

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                <button onClick={onClose} aria-label="Đóng"
                    className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                    <X size={18} />
                </button>
                <h3 className="mb-4 text-lg font-semibold">{title}</h3>
                {children}
            </div>
        </div>
    )
}

/**
 * Tạo tài khoản mới. KHÔNG có ô mật khẩu: backend tạo tài khoản không mật khẩu rồi gửi
 * mail để chính người đó tự đặt (xem AdminUsersController.CreateUser).
 */
function CreateUserDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [email, setEmail] = useState('')
    const [fullName, setFullName] = useState('')
    // Mặc định ContentManager — đây là lý do chính Admin cần tạo tài khoản tay
    // (luồng đăng ký công khai chỉ gán "User").
    const [roles, setRoles] = useState<RoleName[]>(['ContentManager'])
    const [saving, setSaving] = useState(false)

    const toggle = (r: RoleName) =>
        setRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (roles.length === 0) {
            toast.error('Chọn ít nhất một vai.')
            return
        }
        setSaving(true)
        try {
            const res = await AdminService.createUser({
                email: email.trim(), fullName: fullName.trim(), roles,
            })
            toast.success(res.message)
            onCreated()
        } catch (err) {
            toast.error(errMessage(err, 'Không tạo được tài khoản.'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal title="Tạo tài khoản" onClose={onClose}>
            <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                    <Label htmlFor="c-email">Email</Label>
                    <Input id="c-email" type="email" required autoFocus
                        value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="nhansu@congty.com" />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="c-name">Họ và tên</Label>
                    <Input id="c-name" required maxLength={100}
                        value={fullName} onChange={e => setFullName(e.target.value)}
                        placeholder="Nguyễn Văn A" />
                </div>
                <div className="space-y-2">
                    <Label>Vai</Label>
                    {ALL_ROLES.map(r => (
                        <label key={r} className="flex cursor-pointer items-center gap-2 text-sm">
                            <input type="checkbox" checked={roles.includes(r)}
                                onChange={() => toggle(r)}
                                className="h-4 w-4 rounded border-gray-300" />
                            {ROLE_LABELS[r]}
                        </label>
                    ))}
                </div>

                <p className="rounded-lg bg-blue-50 p-2.5 text-xs text-blue-800">
                    Tài khoản được tạo <b>không có mật khẩu</b>. Hệ thống gửi mail để người
                    dùng tự đặt — quản trị viên không bao giờ biết mật khẩu của ai.
                </p>

                <Button type="submit" className="w-full" disabled={saving}>
                    {saving ? 'Đang tạo…' : 'Tạo tài khoản'}
                </Button>
            </form>
        </Modal>
    )
}

/** Đổi vai — gửi TOÀN BỘ danh sách vai mới, không add/remove từng cái */
function EditRolesDialog({ user, isSelf, onClose, onSaved }: {
    user: AdminUser
    isSelf: boolean
    onClose: () => void
    onSaved: () => void
}) {
    const [roles, setRoles] = useState<string[]>(user.roles)
    const [saving, setSaving] = useState(false)

    const toggle = (r: RoleName) =>
        setRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])

    // Tự bỏ vai Admin của mình = tự khoá cửa phòng quản trị. Server chặn thật, ở đây
    // vô hiệu nút Lưu để không mời bấm rồi ăn lỗi.
    const selfLosingAdmin = isSelf && !roles.includes('Admin')

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (roles.length === 0) {
            toast.error('Tài khoản phải có ít nhất một vai.')
            return
        }
        setSaving(true)
        try {
            const res = await AdminService.updateRoles(user.id, roles)
            toast.success(res.message)
            onSaved()
        } catch (err) {
            toast.error(errMessage(err, 'Không cập nhật được vai.'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal title="Đổi vai" onClose={onClose}>
            <form onSubmit={submit} className="space-y-4">
                <p className="text-sm text-gray-600">
                    <b>{user.fullName}</b><br />
                    <span className="text-xs text-gray-500">{user.email}</span>
                </p>

                <div className="space-y-2">
                    {ALL_ROLES.map(r => (
                        <label key={r} className="flex cursor-pointer items-start gap-2 text-sm">
                            <input type="checkbox" checked={roles.includes(r)}
                                onChange={() => toggle(r)}
                                className="mt-0.5 h-4 w-4 rounded border-gray-300" />
                            <span>
                                {ROLE_LABELS[r]}
                                <span className="block text-xs text-gray-400">
                                    {r === 'User' && 'Thi thử, luyện tập, xem bảng điểm'}
                                    {r === 'ContentManager' && 'Soạn đề thi, câu hỏi, từ vựng, lịch thi'}
                                    {r === 'Admin' && 'Xem tổng quan và quản lý tài khoản'}
                                </span>
                            </span>
                        </label>
                    ))}
                </div>

                {selfLosingAdmin && (
                    <p className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-600">
                        Bạn không thể tự bỏ vai Quản trị viên của chính mình — sẽ mất quyền
                        vào trang này và không có cách nào tự khôi phục.
                    </p>
                )}

                <Button type="submit" className="w-full" disabled={saving || selfLosingAdmin}>
                    {saving ? 'Đang lưu…' : 'Lưu vai'}
                </Button>
            </form>
        </Modal>
    )
}
