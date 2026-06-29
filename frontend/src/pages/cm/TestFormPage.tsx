import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { TestService } from '@/services/test.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

//Khai báo schema validate
const schema = z.object({
    title: z.string().min(1, 'Tên đề thi không được trống'),
    description: z.string().optional(),
    durationMinutes: z.number().min(1, 'Thời gian làm bài tối thiểu 1 phút'),
    isPublished: z.boolean()
})

//Lấy type từ schema
type FormData = z.infer<typeof schema>

export default function TestFormPage() {
    const navigate = useNavigate()

    //lấy id từ url
    const { id } = useParams<{ id?: string }>()
    const isEdit = !!id;

    //Khai báo form
    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: { isPublished: false, durationMinutes: 120 },
    })

    const isPublished = watch('isPublished');

    const onSubmit = async (data: FormData) => {
        try {
            if (isEdit) {
                await TestService.update(id!, data);
            } else {
                await TestService.create(data);
            }
            navigate('/cm/tests')
        } catch (error) {
            alert('Có lỗi xảy ra, vui lòng thử lại.')
        }
    }
    return (
        <div className="p-6 max-w-xl space-y-6">
            <h1 className="text-2xl font-bold">{isEdit ? 'Sửa đề thi' : 'Tạo đề thi mới'}</h1>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1">
                    <Label>Tên đề thi</Label>
                    <Input {...register('title')} />
                    {errors.title && <p className="text-sm text-red-500">{errors.title.message}</p>}
                </div>

                <div className="space-y-1">
                    <Label>Mô tả (tùy chọn)</Label>
                    <Input {...register('description')} />
                </div>

                <div className="space-y-1">
                    <Label>Thời gian (phút)</Label>
                    <Input type="number" {...register('durationMinutes', { valueAsNumber: true })} />
                    {errors.durationMinutes && <p className="text-sm text-red-500">{errors.durationMinutes.message}</p>}
                </div>

                <div className="flex items-center gap-2">
                    <Checkbox
                        id="isPublished"
                        checked={isPublished}
                        onCheckedChange={v => setValue('isPublished', !!v)}
                    />
                    <Label htmlFor="isPublished">Xuất bản ngay</Label>
                </div>

                <div className="flex gap-3 pt-2">
                    <Button type="submit">{isEdit ? 'Lưu thay đổi' : 'Tạo đề thi'}</Button>
                    <Button type="button" variant="outline" onClick={() => navigate('/cm/tests')}>
                        Hủy
                    </Button>
                </div>
            </form>
        </div>
    )
}
