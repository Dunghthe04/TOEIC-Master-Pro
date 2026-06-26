// ──────────────────────────────────────────────────────────
// lib/utils.ts — Utility dùng chung cho toàn bộ app
//
// File này do shadcn/ui tạo ra khi chạy "npx shadcn@latest init".
// Mọi component của shadcn đều import hàm cn() từ đây.
// ──────────────────────────────────────────────────────────

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// cn() = "classnames" — hàm ghép nhiều Tailwind class lại với nhau thông minh.
//
// Vấn đề nếu không có cn():
//   className={"bg-blue-500" + (isActive ? " bg-red-500" : "")}
//   → kết quả: "bg-blue-500 bg-red-500" — hai class xung đột, không biết cái nào thắng.
//
// Với cn():
//   cn("bg-blue-500", isActive && "bg-red-500")
//   → twMerge tự loại "bg-blue-500", giữ "bg-red-500" — class sau thắng.
//
// Cách dùng trong component:
//   <div className={cn("text-sm", isError && "text-red-500", className)} />
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
