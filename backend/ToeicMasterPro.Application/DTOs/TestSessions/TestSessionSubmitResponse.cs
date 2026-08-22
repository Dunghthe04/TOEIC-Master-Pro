namespace ToeicMasterPro.Application.DTOs.TestSessions;

/// <summary>
/// Chi tiết 1 câu sau khi nộp bài — dùng màn review (Day 30 polish thêm).
/// </summary>
public record SessionAnswerReview(
  Guid QuestionId,
  int OrderIndex,
  string Part,
  Guid? SelectedOptionId,
  Guid CorrectOptionId,
  string CorrectLabel,
  bool IsCorrect,
  string? Explanation,

  /// <summary>
  /// Lời đoạn băng (Part 1–4), quan trọng nhất ở Part 3–4.
  ///
  /// 🔴 CỐ Ý chỉ có Ở ĐÂY, không có trong PlayQuestionItem: PlayQuestionItem là payload trả
  /// về TRONG LÚC ĐANG THI, nên transcript nằm ở đó là gửi nguyên lời đoạn băng xuống trình
  /// duyệt trước khi học viên nghe — mở DevTools là đọc thay vì nghe. Cùng họ lỗi với Day 34
  /// (lộ IsCorrect cho người chưa đăng nhập) và Day 47 (máy tra đáp án ở /practice/submit).
  ///
  /// 3 câu cùng nhóm Part 3–4 trả về CÙNG một nội dung. Frontend đã gộp nhóm theo audioUrl
  /// (examListening.ts) nên hiện MỘT LẦN cho cả nhóm, đừng render 3 lần liên tiếp.
  /// </summary>
  string? Transcript
);

/// <summary>
/// Response POST /api/test-session/{id}/submit — kết quả sau khi nộp.
///
/// Mục đích:
///   - Chấm điểm, đổi Status → Completed, ghi CompletedAt.
///   - Trả điểm Listening / Reading / Total (chuẩn TOEIC 5–495 / 10–990).
///   - Trả thống kê theo Part (partBreakdown) — Day 30 Phần 2.
///   - Trả danh sách review từng câu (đáp án đúng + giải thích).
/// </summary>
public record TestSessionSubmitResponse(
  Guid SessionId,
  int CorrectCount,
  int TotalCount,
  int SkippedCount,
  /// <summary>Điểm Listening 5–495; null nếu session không có Part 1–4.</summary>
  int? ListeningScore,
  /// <summary>Điểm Reading 5–495; null nếu session không có Part 5–7.</summary>
  int? ReadingScore,
  /// <summary>Tổng 10–990.</summary>
  int? TotalScore,
  DateTime CompletedAt,
  /// <summary>Thống kê đúng/tổng theo Part trong phạm vi phiên.</summary>
  List<PartBreakdownItem> PartBreakdown,
  List<SessionAnswerReview> Reviews
);
