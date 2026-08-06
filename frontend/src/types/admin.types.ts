// Khớp AdminController.GetOverview (camelCase từ System.Text.Json)
export interface AdminOverview {
    users: { total: number; new7Days: number }
    content: { totalTests: number; publishedTests: number; draftTests: number; totalQuestions: number }
    exams: { totalSessions: number; sessions7Days: number; averageScore: number }
    topTests: { testId: string; title: string; attempts: number }[]
}
