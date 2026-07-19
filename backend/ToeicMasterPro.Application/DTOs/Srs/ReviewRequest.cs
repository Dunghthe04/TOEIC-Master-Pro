namespace ToeicMasterPro.Application.DTOs.Srs;
// quality: 0 (quên) → 5 (rất chắc) — chuẩn SM-2
public record ReviewRequest(
    Guid VocabularyId,
    int Quality
);