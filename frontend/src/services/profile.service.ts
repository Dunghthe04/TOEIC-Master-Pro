//sau Khi login thành công backend chỉ trả về token
//Cần gọi /api/profile/me lấy thông tin rồi lưu vào zustand store

import api from "@/api/axios"
import type { User, UpdateProfileRequest } from "@/types/auth.types"

export const profileService = {
    //Trả về toàn bộ thông tin user
    async getMe(): Promise<User> {
        //Gọi đến api và trả về dạng user
        const res = await api.get<User>('/profile/me');
        return res.data;
    },

    /** Sửa họ tên / điểm mục tiêu / ngày dự thi — trả về profile SAU khi cập nhật */
    async updateMe(data: UpdateProfileRequest): Promise<User> {
        const res = await api.put<User>('/profile/me', data)
        return res.data
    },

    /**
     * Đổi ảnh đại diện. Gửi multipart/form-data vì backend nhận IFormFile.
     * KHÔNG tự set Content-Type: để trống thì axios/browser tự thêm kèm `boundary` —
     * tự khai "multipart/form-data" mà thiếu boundary là server không parse được.
     *
     * Backend chỉ trả { message }, không trả URL ảnh → gọi lại getMe() để lấy avatarUrl mới.
     */
    async uploadAvatar(file: File): Promise<User> {
        const form = new FormData()
        form.append('file', file)
        await api.post('/profile/me/avatar', form)
        return this.getMe()
    },
}
