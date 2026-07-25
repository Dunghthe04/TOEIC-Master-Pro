using ToeicMasterPro.Application.Common;

namespace ToeicMasterPro.Tests;

public class ToeicScoreHelperTests
{
    // ── Partial (MVP) ─────────────────────────────────────────────────────

    [Fact]
    public void Part1_only_6_of_6_not_max_listening()
    {
        // Chỉ Part 1 (6 câu) — không được 495
        var score = ToeicScoreHelper.ConvertSectionScore(6, 6, ToeicScoredSection.Listening);
        Assert.Equal(30, score);
    }

    [Fact]
    public void Partial_reading_30_of_30_uses_mvp_not_ets()
    {
        // 30 câu Part 5 — chưa đủ 100 → MVP (ETS[30] Reading = 55, không áp dụng)
        var score = ToeicScoreHelper.ConvertSectionScore(30, 30, ToeicScoredSection.Reading);
        Assert.Equal(150, score);
    }

    [Fact]
    public void Empty_scope_returns_null()
    {
        Assert.Null(ToeicScoreHelper.ConvertSectionScore(0, 0, ToeicScoredSection.Listening));
    }

    // ── Full section — bảng ETS (WIE) ─────────────────────────────────────

    [Fact]
    public void Full_listening_95_of_100()
    {
        var score = ToeicScoreHelper.ConvertSectionScore(95, 100, ToeicScoredSection.Listening);
        Assert.Equal(495, score);
    }

    [Fact]
    public void Full_listening_perfect()
    {
        var score = ToeicScoreHelper.ConvertSectionScore(100, 100, ToeicScoredSection.Listening);
        Assert.Equal(495, score);
    }

    [Theory]
    [InlineData(76, ToeicScoredSection.Listening, 395)]
    [InlineData(76, ToeicScoredSection.Reading, 335)]
    [InlineData(52, ToeicScoredSection.Reading, 195)]
    [InlineData(95, ToeicScoredSection.Reading, 470)]
    public void Full_section_ets_spot_checks(int correct, ToeicScoredSection section, int expected)
    {
        var score = ToeicScoreHelper.ConvertSectionScore(correct, 100, section);
        Assert.Equal(expected, score);
    }

    [Fact]
    public void Full_section_same_raw_listening_higher_than_reading()
    {
        // Cùng 76/100 — Listening scaled cao hơn Reading (đúng bảng WIE)
        var listening = ToeicScoreHelper.ConvertSectionScore(76, 100, ToeicScoredSection.Listening);
        var reading = ToeicScoreHelper.ConvertSectionScore(76, 100, ToeicScoredSection.Reading);
        Assert.True(listening > reading);
        Assert.Equal(395, listening);
        Assert.Equal(335, reading);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(17)]
    public void Full_section_low_raw_scores_minimum_five(int correct)
    {
        Assert.Equal(5, ToeicScoreHelper.ConvertSectionScore(correct, 100, ToeicScoredSection.Listening));
        Assert.Equal(5, ToeicScoreHelper.ConvertSectionScore(correct, 100, ToeicScoredSection.Reading));
    }
}

/// <summary>Day 30 Bước 1c — kiểm tra cấu trúc bảng ETS (1a).</summary>
public class ToeicEtsConversionTableTests
{
    [Fact]
    public void Each_table_has_101_entries_indexed_by_correct_count()
    {
        Assert.Equal(ToeicEtsConversionTable.TableLength, ToeicEtsConversionTable.ListeningByCorrectCount.Length);
        Assert.Equal(ToeicEtsConversionTable.TableLength, ToeicEtsConversionTable.ReadingByCorrectCount.Length);
    }

    [Fact]
    public void Lookup_clamps_out_of_range()
    {
        Assert.Equal(5, ToeicEtsConversionTable.LookupListening(-5));
        Assert.Equal(495, ToeicEtsConversionTable.LookupListening(150));
        Assert.Equal(5, ToeicEtsConversionTable.LookupReading(-1));
        Assert.Equal(495, ToeicEtsConversionTable.LookupReading(999));
    }

    [Theory]
    [InlineData(0, 5)]
    [InlineData(17, 5)]
    [InlineData(76, 395)]
    [InlineData(95, 495)]
    [InlineData(100, 495)]
    public void Listening_lookup_matches_table(int correct, int expected)
    {
        Assert.Equal(expected, ToeicEtsConversionTable.LookupListening(correct));
        Assert.Equal(expected, ToeicEtsConversionTable.ListeningByCorrectCount[correct]);
    }

    [Theory]
    [InlineData(0, 5)]
    [InlineData(17, 5)]
    [InlineData(52, 195)]
    [InlineData(76, 335)]
    [InlineData(95, 470)]
    [InlineData(100, 495)]
    public void Reading_lookup_matches_table(int correct, int expected)
    {
        Assert.Equal(expected, ToeicEtsConversionTable.LookupReading(correct));
        Assert.Equal(expected, ToeicEtsConversionTable.ReadingByCorrectCount[correct]);
    }
}
