using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToeicMasterPro.Application.DTOs.Srs;
using ToeicMasterPro.Domain.Common;

namespace ToeicMasterPro.Application.Common.Interfaces
{
    public interface ISrsService
    {
        // Bắt đầu học 1 từ (tạo UserVocabulary nếu chưa có)
        Task<Result<SrsCardResponse>> LearnAsync(Guid vocabularyId);

        // Danh sách thẻ đến hạn ôn (NextReviewDate <= UtcNow.Date)
        Task<IReadOnlyList<SrsCardResponse>> GetDueAsync();

        // Nộp kết quả ôn → chạy SM-2
        Task<Result<SrsCardResponse>> ReviewAsync(ReviewRequest req);
        // Thống kê tiến độ user hiện tại
        Task<Result<SrsProgressResponse>> GetProgressAsync();
    }
}
