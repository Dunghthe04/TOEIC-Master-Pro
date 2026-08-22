// Khớp DonationQrResponse / DonationStatusResponse ở backend (DTOs/Donations)

export interface DonationQr {
    orderCode: number
    /** Số tiền của mã — app ngân hàng điền sẵn số này, người chuyển vẫn sửa được */
    amount: number
    /** Chuỗi VietQR thô theo chuẩn EMVCo — tự render thành hình, không phải URL ảnh */
    qrCode: string
    bankName: string
    accountNumber: string
    accountName: string
    /** Nội dung chuyển khoản payOS cấp — người chuyển tay PHẢI gõ đúng chuỗi này */
    description: string
    checkoutUrl: string
    expiredAt: string | null
}

export interface DonationStatus {
    orderCode: number
    /** PENDING · PROCESSING · PAID · UNDERPAID · CANCELLED · EXPIRED · FAILED — nguyên văn từ payOS */
    status: string
    /** True khi đã có tiền vào (amountPaid > 0), kể cả ít hơn số điền sẵn trong mã */
    isPaid: boolean
    amountPaid: number
}
