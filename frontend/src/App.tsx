// ──────────────────────────────────────────────────────────
// App.tsx — Component gốc (Root Component)
//
// Đây là "cái khung" bao toàn bộ app.
// Sau này App.tsx sẽ chứa Router (điều hướng giữa các trang),
// Layout chung (header, sidebar), và các Provider (auth, theme...).
//
// Hiện tại chỉ có nội dung tạm để test Tailwind + shadcn/ui.
// ──────────────────────────────────────────────────────────

// Syntax: import Button từ thư mục ui (do shadcn generate)
// "@/" là alias trỏ vào thư mục "src/" — thay thế cho "../../components/ui/button"
import { Button } from '@/components/ui/button'

// "function App()" — định nghĩa một React Component.
// Component = một hàm JavaScript trả về JSX (HTML viết trong JS).
function App() {
  // return (...) — phần JSX này sẽ được render thành HTML thật trên trình duyệt.
  // JSX trông như HTML nhưng thực ra là JavaScript — Vite/TypeScript sẽ biên dịch nó.
  return (
    // className thay cho class trong HTML (vì "class" là từ khóa trong JavaScript)
    // Các class dưới đây là Tailwind: flex, min-h-screen, items-center, justify-center...
    <div className="flex min-h-screen items-center justify-center bg-gray-100 gap-4">
      <Button>Primary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="destructive">Delete</Button>
    </div>
  )
}

// export default: cho phép các file khác import App này
// main.tsx dùng: import App from './App.tsx'
export default App
