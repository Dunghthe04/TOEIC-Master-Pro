import api from '@/api/axios'
import type { DonationQr, DonationStatus } from '@/types/donation.types'

export const donationService = {
    createQr: (amount: number) =>
        api.post<DonationQr>('/donation/qr', { amount }).then(r => r.data),

    getStatus: (orderCode: number) =>
        api.get<DonationStatus>(`/donation/${orderCode}/status`).then(r => r.data),
}
