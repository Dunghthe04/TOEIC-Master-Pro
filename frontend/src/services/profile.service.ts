//sau Khi login thành công backend chỉ trả về token 
//Cần gọi /api/profile/me lấy thông tin rồi lưu vào zustand store

import api from "@/api/axios"
import type { User } from "@/types/auth.types"

export const profileService = {
    //Trả về toàn bộ thông tin user
    async getMe(): Promise<User> {
        //Gọi đến api và trả về dạng user
        const res = await api.get<User>('/profile/me');
        return res.data;
    }
}
