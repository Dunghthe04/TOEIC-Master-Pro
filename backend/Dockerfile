# ============================================================
# STAGE 1: BUILD
# ============================================================
# Stage này chỉ dùng để restore package và build ứng dụng.
# Image SDK chứa compiler nên KHÔNG được dùng để chạy production.

# Sử dụng .NET 8 SDK để restore và build project
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build

# Thư mục làm việc bên trong container
WORKDIR /src


# ------------------------------------------------------------
# 1. COPY FILE PROJECT
# ------------------------------------------------------------
# Copy solution và các file .csproj trước.
# Docker cache từng layer, nên nếu chỉ sửa code mà không đổi
# package/NuGet thì Docker có thể bỏ qua bước restore.
COPY ToeicMasterPro.sln .

COPY backend/ToeicMasterPro.Domain/*.csproj         backend/ToeicMasterPro.Domain/
COPY backend/ToeicMasterPro.Application/*.csproj    backend/ToeicMasterPro.Application/
COPY backend/ToeicMasterPro.Infrastructure/*.csproj backend/ToeicMasterPro.Infrastructure/
COPY backend/ToeicMasterPro.API/*.csproj            backend/ToeicMasterPro.API/
COPY backend/ToeicMasterPro.Tests/*.csproj          backend/ToeicMasterPro.Tests/


# ------------------------------------------------------------
# 2. RESTORE NUGET PACKAGE
# ------------------------------------------------------------
# Đọc các file .csproj để tải toàn bộ NuGet package cần thiết.
RUN dotnet restore


# ------------------------------------------------------------
# 3. COPY SOURCE CODE
# ------------------------------------------------------------
# Sau khi restore xong mới copy toàn bộ source code.
COPY . .


# ------------------------------------------------------------
# 4. BUILD + PUBLISH
# ------------------------------------------------------------
# Build API ở chế độ Release và tạo ra các file cần thiết
# để chạy ứng dụng tại /app/publish.
#
# --no-restore: không restore lại vì đã restore ở bước trên.
RUN dotnet publish backend/ToeicMasterPro.API/ToeicMasterPro.API.csproj \
    -c Release \
    -o /app/publish \
    --no-restore


# ============================================================
# STAGE 2: PRODUCTION
# ============================================================
# Stage này chỉ dùng để CHẠY ứng dụng.
#
# Không có .NET SDK/compiler và không chứa source code.
# Vì vậy image nhỏ hơn và phù hợp để deploy production.

# Chỉ sử dụng ASP.NET Core Runtime để chạy file .NET đã publish
FROM mcr.microsoft.com/dotnet/aspnet:8.0

# Thư mục chứa ứng dụng trong container
WORKDIR /app


# ------------------------------------------------------------
# COPY FILE ĐÃ PUBLISH TỪ STAGE 1
# ------------------------------------------------------------
# Chỉ lấy thành phẩm từ Stage 1.
# Source code và .NET SDK ở Stage 1 không được đưa sang image này.
COPY --from=build /app/publish .


# Container sẽ lắng nghe request tại port 8080
EXPOSE 8080


# Lệnh khởi động ứng dụng khi container chạy
ENTRYPOINT ["dotnet", "ToeicMasterPro.API.dll"]