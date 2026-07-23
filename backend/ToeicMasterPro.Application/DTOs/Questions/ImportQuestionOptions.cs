namespace ToeicMasterPro.Application.DTOs.Questions;

/// <summary>Tùy chọn import — gắn media theo đề, tự sinh AudioFile (E26-T01-1 / E26-T01-38-40).</summary>
public record ImportQuestionOptions(
    Guid? TestId = null,
    /// <summary>Tự gán câu vừa import vào đề (cần TestId).</summary>
    bool AssignToTest = false
);
