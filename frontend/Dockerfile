# ============================================================
# STAGE 1 — BUILD FRONTEND
# Dùng Node.js để cài thư viện và build mã nguồn React/Vite
# ============================================================

# Tạo Stage 1 từ image Node.js 22.
# "AS build" đặt tên Stage này là "build" để Stage 2 có thể lấy kết quả từ đây.
FROM node:22-alpine AS build

# Đặt /app làm thư mục làm việc bên trong container.
WORKDIR /app

# Copy package.json và package-lock.json từ máy vào /app trong container.
# Chỉ copy 2 file này trước để Docker có thể cache bước npm ci,
# tránh phải cài lại package mỗi khi chỉ sửa source code.
COPY frontend/package.json frontend/package-lock.json ./

# Cài các package/dependency của frontend theo package-lock.json.
RUN npm ci

# Copy toàn bộ source code frontend từ thư mục frontend/ trên máy
# vào thư mục /app bên trong container.
COPY frontend/ .

# Địa chỉ API được sử dụng khi build frontend.
# Mặc định frontend gọi API qua /api trên cùng domain với Nginx.
# Ví dụ: https://example.com/api/questions
ARG VITE_BASE_URL=/api

# Đưa giá trị VITE_BASE_URL vào environment để Vite có thể đọc
# thông qua import.meta.env.VITE_BASE_URL khi chạy npm run build.
ENV VITE_BASE_URL=$VITE_BASE_URL

# Build React/Vite frontend thành các file production trong /app/dist.
# Kết quả thường gồm index.html và thư mục assets/.
RUN npm run build


# ============================================================
# STAGE 2 — PRODUCTION
# Dùng Nginx để chạy frontend đã build và reverse proxy API.
# Không cần Node.js ở production nữa.
# ============================================================

# Tạo Stage 2 từ image Nginx Alpine.
FROM nginx:alpine

# Lấy thư mục /app/dist đã được tạo ở Stage 1 (build)
# và copy vào thư mục Nginx dùng để phục vụ website.
COPY --from=build /app/dist /usr/share/nginx/html

# Copy file cấu hình Nginx của project vào container.
# File này cấu hình:
#   - Serve React SPA
#   - F5 các route như /dashboard không bị 404
#   - Chuyển request /api/... tới API container.
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Nginx lắng nghe HTTP trên port 80 trong container.
EXPOSE 80