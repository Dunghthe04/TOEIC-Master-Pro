// ──────────────────────────────────────────────────────────
// vite.config.ts — Cấu hình của Vite (build tool)
//
// Vite đọc file này khi khởi động dev server hoặc build.
// Tương đương webpack.config.js nếu bạn đã từng dùng webpack.
// ──────────────────────────────────────────────────────────

// "path" là module Node.js để xử lý đường dẫn file (không phải npm package)
import path from 'path'
import { defineConfig } from 'vite'

// Plugin Vite cho React: bật JSX transform, Fast Refresh (HMR cho React)
import react from '@vitejs/plugin-react'

// Plugin Vite cho Tailwind CSS v4: Tailwind tích hợp vào pipeline build của Vite
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),        // Xử lý file .tsx/.jsx — biên dịch JSX thành JavaScript
    tailwindcss(),  // Scan class Tailwind trong .tsx → sinh CSS tương ứng
  ],
  server: {
    proxy: {
      // Dev: proxy /api → backend, để FE và API CÙNG origin (http://localhost:5173).
      //
      // VÌ SAO CẦN: cookie refreshToken có SameSite=Strict. Trước đây FE gọi thẳng
      // https://localhost:7021 — khác SCHEME với http://localhost:5173, mà scheme là
      // một phần định danh "site", nên browser coi là cross-site và KHÔNG gửi cookie.
      // Hệ quả: F5 là mất phiên, vì /auth/refresh-token không thấy cookie → 401 → logout.
      //
      // Đi qua proxy thì browser chỉ thấy một origin duy nhất, cookie gửi bình thường
      // và Strict giữ nguyên (không phải hạ xuống None, tức không mất lớp chống CSRF).
      // Đây cũng ĐÚNG hình dạng của production: nginx serve / cho FE và /api/ cho API
      // trên cùng domain — dev giờ khớp prod thay vì lệch.
      //
      // Nhắm vào cửa HTTP 5191 (không phải HTTPS 7021): cert localhost là self-signed,
      // proxy đi HTTP tránh phải cấu hình bỏ qua xác thực cert.
      '/api': {
        target: 'http://localhost:5191',
        changeOrigin: true,
      },
      // Dev: proxy /uploads → API wwwroot (audio/ảnh đề thi)
      '/uploads': {
        target: 'http://localhost:5191',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      // "@" = shortcut cho thư mục "src/"
      // Thay vì import "../../components/ui/button"
      // Viết:         import "@/components/ui/button"
      '@': path.resolve(__dirname, './src'),
    },
  },
})
