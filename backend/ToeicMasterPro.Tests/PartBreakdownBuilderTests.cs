using ToeicMasterPro.Application.Common;

namespace ToeicMasterPro.Tests;

/// <summary>Day 30 Phần 2 — thống kê partBreakdown trên submit.</summary>
public class PartBreakdownBuilderTests
{
    [Fact]
    public void Build_orders_parts_ascending()
    {
        var stats = new Dictionary<int, (int Correct, int Total, int Skipped)>
        {
            [7] = (40, 54, 2),
            [1] = (5, 6, 0),
            [3] = (28, 39, 1),
        };

        var result = PartBreakdownBuilder.Build(stats);

        Assert.Equal([1, 3, 7], result.Select(x => x.Part).ToArray());
    }

    [Fact]
    public void Build_calculates_accuracy_one_decimal()
    {
        var stats = new Dictionary<int, (int Correct, int Total, int Skipped)>
        {
            [5] = (2, 3, 1),
        };

        var item = PartBreakdownBuilder.Build(stats).Single();

        Assert.Equal(2, item.Correct);
        Assert.Equal(3, item.Total);
        Assert.Equal(1, item.Skipped);
        Assert.Equal(66.7, item.AccuracyPercent);
    }

    [Fact]
    public void Build_partial_test_single_part()
    {
        var stats = new Dictionary<int, (int Correct, int Total, int Skipped)>
        {
            [5] = (25, 30, 0),
        };

        var result = PartBreakdownBuilder.Build(stats);

        Assert.Single(result);
        Assert.Equal(5, result[0].Part);
        Assert.Equal(83.3, result[0].AccuracyPercent);
    }

    [Fact]
    public void Build_empty_stats_returns_empty_list()
    {
        Assert.Empty(PartBreakdownBuilder.Build(new Dictionary<int, (int, int, int)>()));
    }
}
