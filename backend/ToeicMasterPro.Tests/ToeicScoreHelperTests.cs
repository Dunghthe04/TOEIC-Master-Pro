using ToeicMasterPro.Application.Common;

namespace ToeicMasterPro.Tests;

public class ToeicScoreHelperTests
{
    [Fact]
    public void Part1_only_6_of_6_not_max_listening()
    {
        // Chỉ Part 1 (6 câu) — không được 495
        var score = ToeicScoreHelper.ConvertSectionScore(6, 6, 100);
        Assert.Equal(30, score);
    }

    [Fact]
    public void Full_listening_95_of_100()
    {
        var score = ToeicScoreHelper.ConvertSectionScore(95, 100, 100);
        Assert.Equal(470, score);
    }

    [Fact]
    public void Full_listening_perfect()
    {
        var score = ToeicScoreHelper.ConvertSectionScore(100, 100, 100);
        Assert.Equal(495, score);
    }

    [Fact]
    public void Empty_scope_returns_null()
    {
        Assert.Null(ToeicScoreHelper.ConvertSectionScore(0, 0, 100));
    }
}
