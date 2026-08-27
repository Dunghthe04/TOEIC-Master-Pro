/**
 * Một CỤM trong sổ tay lỗi sai — đề bài bên trái, các câu bên phải.
 *
 * ─── VÌ SAO HAI CỘT ─────────────────────────────────────────────────────────────────
 *
 * Bản đầu vẽ phẳng: mỗi câu một thẻ, mỗi thẻ tự mang ảnh bài đọc của nó. Cụm 131–134
 * Part 6 thế là hiện CÙNG một ảnh bốn lần, mỗi bản chiếm gần trọn màn hình. Người học
 * phải cuộn qua ba bản sao của thứ vừa đọc mới tới câu tiếp theo.
 *
 * Xếp một cột trên–dưới cũng không cứu được: đọc tới câu thứ ba thì bài đọc đã cuộn khỏi
 * màn hình, mà Part 6–7 thì phải vừa nhìn bài vừa chọn đáp án.
 *
 * Nên: đề bài MỘT lần ở cột trái, `sticky` để cuộn hết cụm vẫn thấy; câu hỏi xếp dọc ở
 * cột phải. Cùng bố cục với lúc thi và với màn xem lại kết quả — người học không phải
 * học lại cách đọc màn hình.
 *
 * Màn hẹp (< lg) thì xếp chồng: đề bài trên, câu dưới. Hai cột ở 400px bề ngang thì cột
 * nào cũng không đọc nổi.
 */
import { Volume2 } from 'lucide-react'
import PassageImage from '@/components/exam/PassageImage'
import ReviewQuestionCard from '@/components/review/ReviewQuestionCard'
import { partToNumber } from '@/lib/examListening'
import { isPassageGroupCode } from '@/lib/examReading'
import { getMediaUrl } from '@/lib/media'
import type { ReviewCluster } from '@/lib/reviewNotebook'

type Props = {
    cluster: ReviewCluster
    onResolved: (questionId: string, remaining: number) => void
}

export default function ReviewClusterCard({ cluster, onResolved }: Props) {
    // Câu đứng một mình (Part 1, 2, 5): đề bài là của riêng nó, để nguyên thẻ tự vẽ.
    // Ép vào bố cục hai cột thì cột trái trống trơn hoặc chỉ có một dòng — tệ hơn.
    if (cluster.standalone) {
        // Bó lại max-w-3xl: trang rộng 88rem để chứa được ảnh bài đọc ở cỡ thật, nhưng
        // một câu Part 5 kéo dài hết 1408px thì dòng chữ quá dài — mắt đọc tới cuối dòng
        // là mất chỗ đầu dòng sau.
        return (
            <div className="max-w-3xl">
                <ReviewQuestionCard item={cluster.items[0]} onResolved={onResolved} showMedia />
            </div>
        )
    }

    const first = cluster.items[0]
    const partNum = partToNumber(first.part)

    /**
     * Đoạn văn THẬT, hoặc null.
     *
     * 🔴 Có `passage` không có nghĩa là có đoạn văn. Cột Passage trong Excel thường chỉ
     * chứa MÃ NHÓM ("131-134") để gom câu lại, còn nội dung nằm trong ảnh. Đổ thẳng ra
     * màn hình thì người học thấy dòng "131-134" nằm chình ình chỗ bài đọc. Màn thi lọc
     * bằng `isPassageGroupCode`, ở đây phải lọc y hệt.
     */
    const passageHtml =
        first.passage?.trim() && !isPassageGroupCode(first.passage) ? first.passage : null

    /**
     * Liệt kê ĐÚNG các số câu đang có, không viết thành khoảng.
     *
     * Sổ tay chỉ chứa câu làm sai, nên cụm 131–134 thường chỉ còn 131 và 134. Viết
     * "Câu 131–134" là hứa hai câu không hề có mặt bên dưới.
     */
    const numbers = cluster.items
        .map((i) => i.questionNumber)
        .filter((n): n is number => n !== null)

    // Cụm nhiều văn bản (Part 7 double/triple passage): viền MỘT vòng quanh cả chồng ảnh
    // thay vì viền từng ảnh — giống màn thi, để ba văn bản đọc ra là một bộ đề chứ không
    // phải ba thứ rời rạc.
    const multiImage = cluster.imageUrls.length > 1

    return (
        // Cột trái RỘNG HƠN cột phải (1.35 : 1), không chia đôi.
        // Hai cột chứa hai thứ khác nhau: bên trái là ảnh chụp trang đề — cỡ chữ do ảnh
        // quyết định, hẹp đi là không đọc được; bên phải chỉ là 4 dòng phương án, rộng
        // thêm cũng không đọc nhanh hơn. Chia đôi đều là cho bên không cần chỗ phần chỗ
        // của bên cần.
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
            {/* ── Cột trái: đề bài, dính khi cuộn ──
                top-28 = dưới thanh điều hướng (h-16) cộng dải tên đề đang dính ở top-16.
                max-h + overflow để một bài đọc dài không phá mất tính "dính". */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
                <p className="mb-2 text-xs font-semibold text-slate-500">
                    Part {partNum}
                    {numbers.length > 0 && (
                        <> · Câu {numbers.join(', ')} dùng chung đề bài này</>
                    )}
                </p>

                {cluster.audioUrl && (
                    <div className="mb-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <Volume2 className="h-4 w-4 shrink-0 text-[#1a4d7c]" />
                        <audio
                            controls
                            preload="none"
                            src={getMediaUrl(cluster.audioUrl)}
                            className="w-full"
                        />
                    </div>
                )}

                {/* 🔴 KHÔNG dùng `w-full`. Ảnh bài đọc được cắt từ PDF 200 DPI nên số pixel
                    của chúng đã tỉ lệ đúng với cỡ chữ trên giấy; kéo cho vừa cột là ảnh hẹp
                    bị phóng to (mờ, chữ quá khổ) còn ảnh rộng bị thu nhỏ — cùng một tờ đề mà
                    ra ba cỡ chữ. <PassageImage> nhân bề ngang THẬT với một hệ số dùng chung.
                    Cùng component với màn thi, nên ba nơi không thể lệch cỡ nhau. */}
                {cluster.imageUrls.length > 0 && (
                    <div className={`mb-2 bg-white ${multiImage ? 'border-2 border-slate-800' : ''}`}>
                        {cluster.imageUrls.map((url) => (
                            <PassageImage key={url} url={url} bordered={!multiImage} />
                        ))}
                    </div>
                )}

                {passageHtml && (
                    <div
                        className="prose prose-sm max-w-none text-[15px] leading-relaxed text-slate-800"
                        dangerouslySetInnerHTML={{ __html: passageHtml }}
                    />
                )}
            </div>

            {/* ── Cột phải: các câu ── */}
            <div className="space-y-3">
                {cluster.items.map((item) => (
                    <ReviewQuestionCard
                        key={item.questionId}
                        item={item}
                        onResolved={onResolved}
                        showMedia={false}
                    />
                ))}
            </div>
        </div>
    )
}
