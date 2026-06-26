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
  resolve: {
    alias: {
      // "@" = shortcut cho thư mục "src/"
      // Thay vì import "../../components/ui/button"
      // Viết:         import "@/components/ui/button"
      '@': path.resolve(__dirname, './src'),
    },
  },
})
