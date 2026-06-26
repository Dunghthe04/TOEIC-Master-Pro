// ──────────────────────────────────────────────────────────
// main.tsx — Điểm khởi động của React app
//
// Đây là file đầu tiên React chạy. Nhiệm vụ duy nhất:
// "cắm" component <App> vào div#root trong index.html.
// Sau khi chạy xong, mọi thứ trên màn hình do React quản lý.
// ──────────────────────────────────────────────────────────

// StrictMode: chế độ phát triển — React chạy mỗi component 2 lần
// để phát hiện side effect không mong muốn. Chỉ ảnh hưởng ở dev, không ảnh hưởng production.
import { StrictMode } from 'react'

// createRoot: API React 18 — gắn React vào một DOM element.
import { createRoot } from 'react-dom/client'

// Import CSS toàn cục (Tailwind + biến CSS của shadcn/ui)
import './index.css'

// Component gốc của app — tất cả page/layout đều nằm trong App
import App from './App.tsx'

// document.getElementById('root')! — lấy div#root từ index.html
// Dấu ! cuối = "tôi chắc chắn element này tồn tại" (TypeScript non-null assertion)
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />  {/* Render toàn bộ app vào div#root */}
  </StrictMode>,
)
