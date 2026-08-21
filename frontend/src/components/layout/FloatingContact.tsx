// ──────────────────────────────────────────────────────────
// FloatingContact.tsx — Widget liên hệ nổi ở góc phải màn hình
//
// Zalo · Messenger · Gọi điện · Instagram. Mỗi nút có logo thương hiệu,
// vòng sóng lan (ping) thu hút mắt, hiệu ứng xuất hiện lần lượt và nhãn
// trượt ra khi rê chuột.
//
// Gắn một lần ở App.tsx nên có mặt ở mọi trang, TRỪ màn làm bài
// (xem EXAM_ROUTES bên dưới).
//
// Muốn đổi thông tin liên hệ: sửa các giá trị trong CONTACT_LINKS.
// ──────────────────────────────────────────────────────────

import { matchPath, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

// Các màn dùng ExamShell — phủ full màn hình (fixed inset-0 z-50) và có nút
// Next / Nộp bài ở đúng góc phải dưới, tức là chỗ widget đứng. Hiện ở đây là
// che mất nút bấm của người đang thi.
const EXAM_ROUTES = ['/mock-test/:id/play', '/mock-test/history/:sessionId']

// Thông tin liên hệ — thay bằng thông tin thật của bạn.
const CONTACT_LINKS = {
  zaloPhone: '0911892004', // Số điện thoại/ID Zalo
  messengerId: 'dunghoang1809', // Tên trang hoặc username Facebook
  phone: '0911892004', // Số hotline gọi trực tiếp
  instagram: 'is_dunghoang', // Username Instagram
} as const

// Mỗi mục = 1 nút liên hệ. Gradient lấy đúng màu nhận diện thương hiệu.
type ContactItem = {
  label: string
  href: string
  gradient: string
  glow: string
  icon: React.ReactNode
}

const CONTACT_ITEMS: ContactItem[] = [
  {
    label: 'Chat Zalo',
    href: `https://zalo.me/${CONTACT_LINKS.zaloPhone}`,
    gradient: 'from-[#0068ff] to-[#0084ff]',
    glow: 'shadow-[0_8px_24px_-6px_rgba(0,104,255,0.7)]',
    icon: <ZaloIcon />,
  },
  {
    label: 'Nhắn Messenger',
    href: `https://m.me/${CONTACT_LINKS.messengerId}`,
    gradient: 'from-[#00b2ff] via-[#006aff] to-[#a033ff]',
    glow: 'shadow-[0_8px_24px_-6px_rgba(0,106,255,0.7)]',
    icon: <MessengerIcon />,
  },
  {
    label: 'Gọi ngay',
    href: `tel:${CONTACT_LINKS.phone}`,
    gradient: 'from-[#12b76a] to-[#00a3ff]',
    glow: 'shadow-[0_8px_24px_-6px_rgba(18,183,106,0.7)]',
    icon: <PhoneIcon />,
  },
  {
    label: 'Theo dõi Instagram',
    href: `https://instagram.com/${CONTACT_LINKS.instagram}`,
    gradient: 'from-[#feda75] via-[#d62976] to-[#4f5bd5]',
    glow: 'shadow-[0_8px_24px_-6px_rgba(214,41,118,0.7)]',
    icon: <InstagramIcon />,
  },
]

export default function FloatingContact() {
  const { pathname } = useLocation()
  if (EXAM_ROUTES.some(route => matchPath(route, pathname))) return null

  return (
    <div className="fixed right-4 bottom-5 z-50 flex flex-col items-end gap-3.5 sm:right-5">
      {CONTACT_ITEMS.map((item, index) => {
        // Lệch pha theo thứ tự nút: xuất hiện lần lượt và nhấp nhô so le nhau
        const staggerDelay = `${index * 120}ms`

        return (
          <a
            key={item.label}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={item.label}
            style={{ animationDelay: staggerDelay }}
            className="group animate-contact-in flex items-center"
          >
            {/* Nhãn trượt ra khi rê chuột */}
            <span className="pointer-events-none mr-3 translate-x-3 rounded-full bg-slate-900/90 px-3 py-1.5 text-sm font-medium whitespace-nowrap text-white opacity-0 shadow-lg backdrop-blur transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100">
              {item.label}
            </span>

            {/* Nút tròn + vòng sóng lan, nhấp nhô nhẹ khi đứng yên */}
            <span
              style={{ animationDelay: staggerDelay }}
              className="animate-contact-float relative flex size-13 shrink-0 items-center justify-center"
            >
              <span
                style={{ animationDelay: staggerDelay }}
                className={cn(
                  'animate-contact-ping absolute inset-0 rounded-full bg-gradient-to-br opacity-60',
                  item.gradient,
                )}
              />
              <span
                className={cn(
                  'relative flex size-13 items-center justify-center rounded-full bg-gradient-to-br text-white transition-transform duration-300 group-hover:scale-110 group-active:scale-95',
                  item.gradient,
                  item.glow,
                )}
              >
                {item.icon}
              </span>
            </span>
          </a>
        )
      })}
    </div>
  )
}

// ── Logo thương hiệu (SVG nội tuyến để không cần thêm thư viện) ──

function ZaloIcon() {
  return (
    <span className="text-[15px] font-extrabold tracking-tight italic select-none">
      Zalo
    </span>
  )
}

function MessengerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-6.5" aria-hidden="true">
      <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.9 1.19 5.4 3.14 7.15.16.14.26.35.26.57l.06 1.86c.02.6.63.98 1.17.74l2.07-.91c.17-.08.36-.09.53-.04.91.25 1.88.38 2.88.38 5.64 0 10-4.13 10-9.7S17.64 2 12 2Zm6 7.46-2.94 4.66c-.47.74-1.47.93-2.18.4l-2.34-1.75a.6.6 0 0 0-.72 0l-3.16 2.4c-.42.32-.97-.18-.69-.63l2.94-4.66c.47-.74 1.47-.93 2.18-.4l2.34 1.75c.21.16.51.16.72 0l3.16-2.4c.42-.32.97.18.69.63Z" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="animate-contact-shake size-6" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-6" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}
