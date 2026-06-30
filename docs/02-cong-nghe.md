# Công nghệ sử dụng

<details>
<summary>📋 Bảng tổng hợp stack</summary>

### Backend
| Layer | Công nghệ |
|---|---|
| Framework | ASP.NET Core 8 (Web API) |
| ORM | Entity Framework Core 8 |
| Database | SQL Server 2022 |
| Cache | Redis (StackExchange.Redis) |
| Auth | ASP.NET Identity + JWT + Refresh Token |
| Real-time | SignalR |
| Background Jobs | Hangfire |
| AI | Claude API (Anthropic) |
| File Storage | Azure Blob Storage / MinIO (local dev) |
| Email | MailKit + SendGrid |
| Logging | Serilog |
| API Docs | Scalar |

### Frontend
| Layer | Công nghệ |
|---|---|
| Build Tool | Vite |
| Framework | React 18 + TypeScript |
| UI | shadcn/ui + Tailwind CSS |
| State | Zustand |
| Data Fetching | TanStack Query |
| Audio | Howler.js |
| Charts | Recharts |
| Rich Text | TipTap (content manager) |
| Toast | Sonner (thông báo thành công/thất bại) |

### DevOps
| Item | Công nghệ |
|---|---|
| Container | Docker + Docker Compose |
| CI/CD | GitHub Actions |
| Reverse Proxy | Nginx |
| Hosting | VPS (Ubuntu) hoặc Azure App Service |
| Monitoring | Grafana + Prometheus |

</details>

---

<details>
<summary>🗄️ SQL Server 2022 — Database chính</summary>

**Là gì:** Hệ quản trị cơ sở dữ liệu quan hệ (RDBMS) của Microsoft.

**Tại sao dùng:** Tích hợp tốt nhất với .NET/EF Core, hỗ trợ JSON columns, Full-text search cho tìm kiếm câu hỏi, transaction mạnh cho việc chấm bài thi.

**Dùng để lưu:** Toàn bộ dữ liệu chính — users, câu hỏi, đề thi, kết quả, từ vựng, lịch thi, bình luận.

**Trong Docker:** Chạy ở `localhost:1433`, tài khoản `sa`, password trong `.env`.

> ⚠️ Docker chỉ cung cấp SQL Server engine (phần mềm). Muốn có tables thì phải chạy EF Core Migrations.

</details>

---

<details>
<summary>⚡ Redis — Cache & Real-time Data</summary>

**Là gì:** Cơ sở dữ liệu in-memory (lưu trong RAM) dạng key-value, cực kỳ nhanh (~0.1ms so với ~5ms của SQL Server).

**Tại sao dùng:** Những dữ liệu đọc nhiều, viết ít thì cache vào Redis thay vì query SQL Server mỗi lần → giảm tải DB, tăng tốc response.

**Dùng để:**
| Mục đích | Ví dụ cụ thể |
|---|---|
| Cache AI response | Giải thích câu hỏi đã có → cache 7 ngày, lần sau không gọi API lại |
| JWT Blacklist | Token bị logout → lưu vào Redis đến hết expire |
| Rate limiting | Đếm số lần gọi API của từng user trong 1 phút |
| Leaderboard | `ZADD leaderboard 2450 userId` → `ZRANGE` lấy top 10 tức thì |
| Session thi thử | Lưu trạng thái bài đang làm tránh mất dữ liệu |

**Trong Docker:** Chạy ở `localhost:6379`. Tool xem dữ liệu: **RedisInsight** (GUI miễn phí).

</details>

---

<details>
<summary>🔀 MediatR — CQRS Pattern</summary>

**Là gì:** Thư viện implement Mediator pattern — Controller gửi "request", MediatR tìm đúng "handler" xử lý, tách biệt hoàn toàn HTTP layer với business logic.

**CQRS = Command Query Responsibility Segregation:**
```
Command  = thay đổi dữ liệu  → SubmitTestCommand, RegisterCommand
Query    = chỉ đọc dữ liệu   → GetTestByIdQuery, GetLeaderboardQuery
```

**Luồng thực tế:**
```
POST /api/tests/submit
  → Controller.Submit()
  → mediator.Send(new SubmitTestCommand(...))
  → SubmitTestCommandHandler.Handle()   ← MediatR tìm đúng handler
  → return TestResultDto
```

</details>

---

<details>
<summary>✅ FluentValidation — Validate Input</summary>

**Là gì:** Thư viện validate dữ liệu đầu vào bằng rules viết bằng code, tự động chạy qua MediatR Pipeline trước khi vào Handler.

**Ví dụ:**
```csharp
public class RegisterCommandValidator : AbstractValidator<RegisterCommand>
{
    public RegisterCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).MinimumLength(8).Matches("[A-Z]").Matches("[0-9]");
        RuleFor(x => x.TargetScore).InclusiveBetween(10, 990);
    }
}
// Nếu sai → tự động trả 400 Bad Request, không vào Handler
```

</details>

---

<details>
<summary>🗺️ Mapster — Object Mapping</summary>

**Là gì:** Thư viện tự động copy dữ liệu từ object này sang object khác (Entity → DTO).

**Tại sao dùng thay AutoMapper:** Nhanh hơn 2-3x, ít cấu hình hơn, không có lỗ hổng bảo mật như AutoMapper 13.

```csharp
// Không có Mapster — viết tay từng field
var dto = new UserDto { Id = user.Id, Email = user.Email, Name = user.FullName };

// Dùng Mapster — tự động map field cùng tên
var dto = user.Adapt<UserDto>();
```

</details>

---

<details>
<summary>🔐 ASP.NET Identity + JWT</summary>

**ASP.NET Identity:** Framework quản lý user có sẵn trong .NET — hash password, role, claim, lockout, email confirmation. Không cần tự viết lại.

**JWT hoạt động:**
```
1. User login → server tạo JWT (chứa userId, role, expire 60 phút)
2. Mỗi request gửi kèm: Authorization: Bearer <token>
3. Server verify chữ ký JWT → xác thực, không cần query DB
4. Token hết hạn → dùng Refresh Token (30 ngày) để lấy JWT mới
```

**Refresh Token:** Lưu trong DB, dùng 1 lần duy nhất. Bị đánh cắp → revoke ngay.

</details>

---

<details>
<summary>📡 SignalR — Real-time</summary>

**Là gì:** Thư viện .NET cho phép server chủ động đẩy dữ liệu xuống client (WebSocket).

**Dùng cho:**
- **1v1 Challenge** — Điểm số cập nhật ngay khi đối thủ trả lời
- **AI Chatbot** — Stream từng chữ như ChatGPT
- **Thông báo** — Nhắc nhở lịch thi, badge mới

</details>

---

<details>
<summary>⏰ Hangfire — Background Jobs</summary>

**Là gì:** Thư viện chạy tác vụ nền và tác vụ định kỳ (không block request của user).

| Job | Tần suất | Làm gì |
|---|---|---|
| Streak checker | Mỗi ngày 00:01 | Kiểm tra user không học → reset streak |
| Email nhắc lịch thi | 3 ngày trước | Gửi email tới user đã đặt nhắc |
| Gửi email verify | Ngay khi đăng ký | Không block request đăng ký |
| Xóa expired token | Mỗi ngày 03:00 | Xóa refresh token hết hạn trong DB |

</details>

---

<details>
<summary>🤖 Claude API (Anthropic) — AI Engine</summary>

**Là gì:** API của Anthropic cho phép gọi model Claude để xử lý ngôn ngữ tự nhiên.

| Tính năng | Prompt gửi đi | Kết quả |
|---|---|---|
| Giải thích đáp án | "Câu hỏi... Đáp án đúng: A. Tại sao?" | Giải thích song ngữ Việt-Anh |
| Tạo study plan | "User yếu Part 4, mục tiêu 800, còn 8 tuần." | JSON kế hoạch từng ngày |
| Chatbot | Lịch sử hội thoại + câu hỏi mới | Câu trả lời tiếp theo |
| Score prediction | "Lịch sử 6 lần thi: 620, 660, 680..." | Khoảng điểm ước tính |

**Tiết kiệm chi phí:** Cache response trong Redis 7 ngày — cùng 1 câu hỏi không gọi API lại.

</details>

---

<details>
<summary>🐳 Docker + Docker Compose</summary>

**Docker:** Đóng gói ứng dụng + môi trường vào "container" — chạy y hệt nhau trên mọi máy.

**Docker Compose:** Chạy nhiều container cùng lúc bằng 1 file `docker-compose.yml`.

```bash
docker compose up -d    # Khởi động SQL Server + Redis
docker compose down     # Tắt tất cả
docker compose logs -f  # Xem log real-time
docker compose ps       # Kiểm tra trạng thái container
```

> ⚠️ Docker chỉ chạy SQL Server engine. Vẫn phải chạy migrations để tạo tables.

</details>

---

<details>
<summary>⚡ Vite — Frontend Build Tool</summary>

**Là gì:** Công cụ tạo và chạy project frontend hiện đại. Làm 2 việc chính:
- **Dev server**: reload trình duyệt tức thì (~50ms) mỗi khi lưu file — gọi là HMR (Hot Module Replacement)
- **Build**: đóng gói toàn bộ code thành file tĩnh tối ưu để deploy

**Tại sao không dùng Create React App (CRA):**
| | CRA (cũ) | Vite (mới) |
|---|---|---|
| Khởi động dev server | 30–60 giây | 1–2 giây |
| Hot reload | Chậm (~3–5s) | Tức thì (~50ms) |
| Còn được maintain | ❌ Deprecated | ✅ Active |

**Cấu trúc project Vite:**
```
frontend/
  src/           ← code React
  public/        ← file tĩnh (favicon, ảnh không qua build)
  index.html     ← entry point (Vite đọc file này đầu tiên)
  vite.config.ts ← cấu hình alias, proxy...
  tsconfig.json  ← cấu hình TypeScript
```

**Lệnh hay dùng:**
```bash
npm run dev    # chạy dev server tại localhost:5173
npm run build  # build production → thư mục dist/
npm run preview # xem trước bản build
```

</details>

---

<details>
<summary>🎨 Tailwind CSS — Utility-First CSS Framework</summary>

**Là gì:** Framework CSS theo hướng "utility-first" — thay vì viết file `.css` riêng, bạn gắn class trực tiếp vào HTML/JSX.

**So sánh cách viết:**
```jsx
// Cách cũ — phải viết file CSS riêng
<button className="btn-primary">Login</button>
// btn-primary { background: blue; padding: 8px 16px; border-radius: 4px; }

// Tailwind — viết thẳng vào component
<button className="bg-blue-500 px-4 py-2 rounded text-white hover:bg-blue-600">
  Login
</button>
```

**Tại sao dùng:**
- Không phải đặt tên class (không còn `.card-wrapper-inner-container`)
- Tất cả style nằm cùng chỗ với JSX → dễ đọc, dễ sửa
- Build tự loại bỏ class không dùng → file CSS cuối rất nhỏ
- Consistent design system (spacing, color, typography theo scale cố định)

</details>

---

<details>
<summary>🧩 shadcn/ui — Component Library</summary>

**Là gì:** Bộ component UI đẹp sẵn (Button, Input, Card, Dialog, Table, Toast...) xây trên Tailwind CSS.

**Khác gì Material UI / Ant Design:**
| | Material UI / Ant Design | shadcn/ui |
|---|---|---|
| Cách dùng | Cài package, import component | **Copy code component vào project** |
| Tùy chỉnh | Khó, phải override theme | Dễ, sửa thẳng file component |
| Bundle size | To (toàn bộ thư viện) | Nhỏ (chỉ có component bạn dùng) |
| Phụ thuộc | Cao | Thấp — bạn sở hữu code |

**Cách dùng:**
```bash
npx shadcn@latest add button   # copy Button component vào src/components/ui/button.tsx
npx shadcn@latest add input    # copy Input component
npx shadcn@latest add card     # copy Card component
```

**Trong project này dùng cho:** Auth pages (Login, Register), Profile page, bảng câu hỏi, dialog xác nhận, toast thông báo, form nhập liệu.

</details>

---

<details>
<summary>📖 Swagger + Scalar — API Documentation</summary>

**Là gì:** Công cụ tự động sinh tài liệu và giao diện test API từ code controller — không cần viết tay.

**Tại sao cần:**
- Frontend cần biết API nhận gì, trả gì, cần token không → Swagger/Scalar sinh ra trang tài liệu tự động.
- Trong development: test API ngay trên trình duyệt mà không cần Postman.

**Swagger vs Scalar:**
| | Swagger UI | Scalar UI |
|---|---|---|
| Giao diện | Cũ, đơn giản | Hiện đại, đẹp hơn |
| Cùng nguồn dữ liệu | OpenAPI spec (`/swagger/v1/swagger.json`) | OpenAPI spec |
| URL | `/swagger` | `/scalar/v1` |

**JWT support:** Mặc định Swagger không biết project dùng JWT → phải cấu hình thêm `AddSecurityDefinition("Bearer")` → mới có nút **Authorize** để nhập token test endpoint `[Authorize]`.

> Chỉ bật trong `Development` — production không expose tài liệu API ra ngoài.

</details>

---

<details>
<summary>🌐 CORS — Cross-Origin Resource Sharing</summary>

**Là gì:** Cơ chế browser dùng để kiểm soát request từ một origin (domain:port) sang origin khác.

**Vấn đề:** Mặc định browser **chặn** mọi request từ `http://localhost:5173` (React) sang `https://localhost:7xxx` (API) vì khác origin — gọi là **Same-Origin Policy**.

**Lỗi nếu không cấu hình CORS:**
```
Access to fetch at 'https://localhost:7xxx/api/auth/login'
from origin 'http://localhost:5173' has been blocked by CORS policy.
```

**Giải pháp:** Server khai báo danh sách origin được phép → browser cho qua:
```json
"Cors": {
  "AllowedOrigins": [ "http://localhost:5173" ]
}
```

**Lưu ý quan trọng:**
- CORS phải đứng **trước** `UseAuthentication` trong pipeline.
- `AllowCredentials()` cần thiết khi frontend gửi cookie hoặc Authorization header.
- Production: thay `localhost:5173` bằng domain thật.

</details>

---

<details>
<summary>🌊 Serilog — Structured Logging</summary>

**Là gì:** Thư viện ghi nhật ký hoạt động của app — giống hộp đen máy bay. Khi user báo lỗi, mở log ra đọc thay vì đoán mò.

**Vấn đề nếu không có logging:**
> User báo "Tôi đăng nhập không được lúc 2 giờ sáng" → không biết lúc đó data là gì, không tái hiện được lỗi.

**Với Serilog, mở log ra thấy ngay:**
```
[ERR] 02:13:45 POST /api/auth/login → 400
      Email: "user@gmail.com"
      Error: "Email hoặc mật khẩu không đúng"
```

**Tại sao không dùng `ILogger` mặc định của .NET?**

| Tính năng | ILogger mặc định | Serilog |
|---|---|---|
| In ra console | ✅ | ✅ |
| Lưu ra file | ❌ | ✅ |
| Tự chia file theo ngày | ❌ | ✅ |
| Tự xóa log cũ (giữ 7 ngày) | ❌ | ✅ |
| Gửi lên cloud (Seq, Datadog) | ❌ | ✅ |
| Cấu hình qua appsettings.json | Hạn chế | ✅ |

**Trong project này Serilog làm gì:**

1. **Log mọi request HTTP** (nhờ `UseSerilogRequestLogging`):
```
[INF] GET  /api/profile/me     → 200  45ms
[INF] POST /api/auth/login     → 200  120ms
[WRN] POST /api/auth/login     → 400  30ms   ← login sai
[ERR] GET  /api/questions/999  → 500  5ms    ← crash
```

2. **Lưu log ra file theo ngày, tự xóa sau 7 ngày:**
```
logs/
  log-20260626.txt   ← hôm nay
  log-20260625.txt   ← hôm qua
  ...                ← tự xóa file cũ hơn 7 ngày
```

3. **Phân cấp mức độ:**
- `Information` — hoạt động bình thường
- `Warning` — đáng chú ý (login sai nhiều lần)
- `Error` — lỗi cần xử lý
- `Fatal` — app sắp sập

4. **Kết hợp với GlobalExceptionHandler:** Exception nào xảy ra, lúc mấy giờ, stack trace đầy đủ → nằm hết trong file log.

**Cấu hình qua `appsettings.json`** — không cần sửa code khi muốn thay đổi log level:
```json
"Serilog": {
  "MinimumLevel": { "Default": "Information" },
  "WriteTo": [
    { "Name": "Console" },
    { "Name": "File", "Args": { "path": "logs/log-.txt", "rollingInterval": "Day", "retainedFileCountLimit": 7 } }
  ]
}
```

**Sink:** Console (dev) → File (staging/prod) → Seq/Datadog (production lớn).

> 💡 **Câu thần chú:** Khi app chạy production, bạn không thể mở debugger. Log là **mắt** của bạn để quan sát app từ xa. Serilog thường là thứ **đầu tiên** bạn nhìn vào khi user báo bug.

</details>

---

<details>
<summary>🛣️ React Router DOM — Client-side Routing</summary>

**Là gì:** Thư viện điều hướng cho React — chuyển trang mà **không reload browser** (Single Page Application).

**So sánh:**
| | Web truyền thống | React Router |
|---|---|---|
| Chuyển trang | Browser reload, server trả HTML mới | JavaScript thay component, không reload |
| Tốc độ | Chậm hơn | Tức thì |
| URL | Thay đổi | Thay đổi (nhưng không gọi server) |

**Các khái niệm chính:**
```tsx
// BrowserRouter: bao toàn bộ app, kích hoạt routing
// Routes: container chứa các route
// Route: map URL → Component
// Link: thay thế <a href> — không reload trang
// useNavigate: chuyển trang bằng code (sau khi login xong → về Home)
// useParams: lấy tham số từ URL (vd: /questions/:id → params.id)
```

**Trong project:** Điều hướng giữa /login, /register, /forgot-password, /dashboard, /practice...

</details>

---

<details>
<summary>📡 Axios — HTTP Client</summary>

**Là gì:** Thư viện gọi API HTTP từ React đến backend .NET — thay thế `fetch` có nhiều tính năng hơn.

**Tại sao dùng thay `fetch` mặc định:**
| | fetch (built-in) | Axios |
|---|---|---|
| Tự động parse JSON | ❌ Phải `.json()` thủ công | ✅ |
| Interceptor (gắn token tự động) | ❌ | ✅ |
| Xử lý lỗi HTTP (4xx, 5xx) | ❌ Không throw error | ✅ Tự throw |
| Cancel request | Phức tạp | ✅ Đơn giản |

**Axios instance:** Tạo 1 instance dùng chung với base URL và header — không phải viết lại mỗi lần:
```ts
const api = axios.create({ baseURL: 'https://localhost:7xxx/api' })

// Interceptor: tự gắn JWT token vào mọi request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
```

</details>

---

<details>
<summary>📋 React Hook Form — Form Management</summary>

**Là gì:** Thư viện quản lý state của form trong React — thay thế việc dùng `useState` cho từng input.

**Vấn đề nếu không dùng:**
```tsx
// Không có React Hook Form — rất verbose
const [email, setEmail] = useState('')
const [password, setPassword] = useState('')
const [emailError, setEmailError] = useState('')
// ... mỗi field cần 2-3 state, 1 form 5 field = 15+ state
```

**Với React Hook Form:**
```tsx
const { register, handleSubmit, formState: { errors } } = useForm()

// register("email") = gắn field vào form (theo dõi value + validation)
<input {...register("email", { required: "Email là bắt buộc" })} />
{errors.email && <span>{errors.email.message}</span>}
```

**Ưu điểm lớn:** Chỉ re-render component khi submit, không re-render khi gõ từng chữ → hiệu năng cao.

</details>

---

<details>
<summary>🛡️ Zod — Schema Validation</summary>

**Là gì:** Thư viện định nghĩa "schema" (quy tắc) cho dữ liệu — validate form, API response, config...

**Cách dùng:**
```ts
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
})

// TypeScript tự suy ra type từ schema — không phải viết interface riêng
type LoginForm = z.infer<typeof loginSchema>
// → { email: string; password: string }
```

**Kết hợp với React Hook Form qua `@hookform/resolvers`:**
```tsx
const { register, handleSubmit } = useForm<LoginForm>({
  resolver: zodResolver(loginSchema),  // Zod validate tự động khi submit
})
```

**Tại sao không dùng validation của React Hook Form thôi?** Zod cho phép tái sử dụng schema ở nhiều chỗ (form + API type + server validation), và dễ đọc hơn khi rule phức tạp.

</details>

---

<details>
<summary>🐻 Zustand — Global State Management</summary>

**Là gì:** Thư viện quản lý state toàn app (global state) — nhẹ, đơn giản, không cần boilerplate như Redux.

**Vấn đề nếu không có Zustand:**
```tsx
// Mỗi component muốn biết user là ai phải tự đọc localStorage
const email = localStorage.getItem('userEmail') // lặp khắp nơi
// Khi logout, phải tìm và clear từng component một
```

**Với Zustand — một store duy nhất, mọi component subscribe:**
```tsx
// Khai báo store
export const useAuthStore = create((set) => ({
  user: null,
  loginSuccess: (user) => set({ user, isAuthenticated: true }),
  logout: () => { clearTokens(); set({ user: null, isAuthenticated: false }) },
}))

// Dùng ở bất kỳ component nào — tự động re-render khi user thay đổi
const user = useAuthStore(state => state.user)
const logout = useAuthStore(state => state.logout)
```

**Tại sao không dùng React Context?**
| | React Context | Zustand |
|---|---|---|
| Re-render khi state thay đổi | Toàn bộ cây component | Chỉ component dùng field đó |
| Boilerplate | Provider + useContext mỗi lần | Chỉ `create()` một lần |
| Persist (lưu localStorage) | Tự viết | `persist` middleware có sẵn |

**`persist` middleware:** Tự động sync state vào localStorage — refresh trang không mất trạng thái login.

**Trong project này dùng cho:** Auth state (user, isAuthenticated), sau này có thể dùng cho theme, notification settings.

</details>

---

<details>
<summary>🔑 @react-oauth/google — Google OAuth</summary>

**Là gì:** Thư viện chính thức của Google để tích hợp Google Sign-In vào React app.

**Flow hoạt động:**
```
1. User nhấn nút "Đăng nhập với Google"
2. Google popup xuất hiện → user chọn tài khoản
3. Google cấp idToken cho frontend (chứng minh user là ai)
4. Frontend gửi idToken lên backend: POST /api/auth/google-login
5. Backend xác thực idToken với Google API
6. Backend tạo JWT của hệ thống → trả về accessToken + refreshToken
7. Frontend lưu token → đăng nhập thành công
```

**Tại sao không tự làm OAuth flow?** OAuth 2.0 có nhiều bước phức tạp (PKCE, state parameter, token exchange...). Thư viện này xử lý toàn bộ, chỉ cần nhận `credential` (idToken) trong callback.

**Cần thiết lập trước:**
- Tạo project trên Google Cloud Console
- Đăng ký `Client ID` → khai báo origin được phép (`localhost:5173`)
- Lưu `VITE_GOOGLE_CLIENT_ID` vào `.env`

**Cách dùng:**
```tsx
// main.tsx — bọc toàn app
<GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
  <App />
</GoogleOAuthProvider>

// LoginPage — component button Google
<GoogleLogin
  onSuccess={(res) => {
    // res.credential = idToken → gửi lên backend
    authService.googleLogin(res.credential)
  }}
  onError={() => setError('Đăng nhập Google thất bại')}
/>
```

</details>

---

<details>
<summary>📊 EPPlus — Đọc/ghi file Excel (.xlsx)</summary>

**Là gì:** Thư viện .NET để đọc và ghi file Excel `.xlsx` mà không cần cài Microsoft Office.

**Tại sao dùng:**
- Content Manager cần import hàng trăm câu hỏi từ file Excel một lúc — gọi API từng câu sẽ mất hàng giờ.
- EPPlus cho phép đọc toàn bộ sheet, validate từng hàng, rồi insert vào DB trong 1 request duy nhất.

**Cài đặt** (vào Infrastructure project):
```bash
dotnet add package EPPlus --version 7.6.1
```

**Lưu ý license:** EPPlus v5+ yêu cầu khai báo license context trước khi dùng. Dự án này dùng miễn phí (non-commercial):
```csharp
ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
```

**Cách dùng cơ bản:**
```csharp
using var package = new ExcelPackage(fileStream);
var sheet = package.Workbook.Worksheets[0];  // lấy sheet đầu tiên
var rowCount = sheet.Dimension?.Rows ?? 0;

for (int row = 2; row <= rowCount; row++)    // row 1 = header
{
    var content = sheet.Cells[row, 3].GetValue<string>();
    var part    = sheet.Cells[row, 1].GetValue<int>();
}
```

**Trong project này dùng cho:** `POST /api/question/import` — CM upload file `.xlsx` chứa danh sách câu hỏi, backend parse + validate từng hàng + insert hàng loạt vào DB, trả về báo cáo (thành công/lỗi theo từng hàng).

</details>

---

<details>
<summary>✍️ TipTap — Rich Text Editor</summary>

**Là gì:** Thư viện rich text editor headless cho React — cho phép soạn thảo văn bản có định dạng (bold, italic, danh sách...) trong trình duyệt, tương tự Google Docs thu nhỏ.

**Tại sao "headless":** TipTap không có giao diện sẵn — bạn tự xây toolbar và styling theo thiết kế của mình. Ngược lại với các editor như Quill hay CKEditor có giao diện cứng khó tùy chỉnh.

**Cài đặt:**
```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit
```

- `@tiptap/react` — React binding
- `@tiptap/pm` — ProseMirror core (engine bên dưới)
- `@tiptap/starter-kit` — gói extension cơ bản (Bold, Italic, BulletList, Heading...)

**Cách dùng cơ bản:**
```tsx
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

const editor = useEditor({
  extensions: [StarterKit],
  content: '<p>Nội dung ban đầu</p>',
  onUpdate: ({ editor }) => {
    const html = editor.getHTML()  // lấy HTML để lưu vào DB
  },
})

// editor.getHTML()  → "<p><strong>Câu hỏi</strong></p>"
// editor.getText()  → "Câu hỏi" (không có tag)
```

**Tại sao lưu HTML:** Nội dung câu hỏi TOEIC có thể có bold/italic/danh sách → cần lưu HTML để render đúng. Khi hiển thị dùng `dangerouslySetInnerHTML={{ __html: content }}`.

**Trong project này dùng cho:** Form tạo/sửa câu hỏi — soạn nội dung câu hỏi, giải thích đáp án, passage (đoạn văn Part 6–7) có rich text thay vì plain text.

</details>

---

<details>
<summary>🔔 Sonner — Toast Notifications</summary>

**Là gì:** Thư viện hiển thị thông báo tạm thời (toast) góc màn hình — thay thế `alert()` của trình duyệt bằng UI đẹp, chuyên nghiệp hơn.

**Tại sao không dùng `alert()`:**
| | `alert()` | Sonner |
|---|---|---|
| Giao diện | Popup xấu của hệ điều hành | Toast đẹp, có animation |
| Block UI | ✅ Chặn toàn bộ trang | ❌ Không block |
| Tự đóng | ❌ Phải bấm OK | ✅ Tự đóng sau vài giây |
| Customize | ❌ | ✅ màu sắc, icon, duration |

**Cách dùng:**
```tsx
import { toast } from 'sonner'

toast.success('Tạo câu hỏi thành công!')   // toast xanh lá
toast.error('Có lỗi xảy ra!')              // toast đỏ
toast.warning('Cảnh báo!')                 // toast vàng
toast('Thông báo thường')                  // toast xám
```

**Cài đặt qua shadcn:**
```bash
npx shadcn@latest add sonner
```

Sau đó đặt `<Toaster />` một lần duy nhất ở `App.tsx` — mọi `toast()` trong toàn app đều hiển thị qua đó.

**Trong project này dùng cho:** Thông báo tạo/sửa/xóa thành công hay thất bại ở các trang CM Dashboard (đề thi, câu hỏi).

</details>
