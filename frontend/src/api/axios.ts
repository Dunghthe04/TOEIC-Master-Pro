//Tạo 1 axios instance dùng chung — có baseURL trỏ đúng backend, có interceptor tự gắn JWT vào mọi request.
import axios from 'axios'
import { getAccessToken } from '@/lib/token'

const api = axios.create({
    baseURL: import.meta.env.VITE_BASE_URL,
});

//interceptors để chặn gửi đi, gắn token vào mới gửi đi
//config là request gửi đi
api.interceptors.request.use((config) => {
    //lấy token từ storage
    const token = getAccessToken();
    if (token) {
        //nếu có thì gắn vào header Authorization: Bearer token
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error)
})

export default api