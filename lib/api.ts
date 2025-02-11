export interface CallAnalysis {
  id: string
  fileName: string
  dateAnalyzed: string
  status: "verified" | "pending" | "false_positive"
  threatLevel: "high" | "medium" | "low"
  callerNumber: string // Numéro de téléphone appelant
  recipientNumber: string // Numéro de téléphone appelé
}

export interface DashboardStats {
  totalCallsAnalyzed: number
  threatsDetected: number
  threatsVerified: number
  pendingVerification: number
}

export interface MonthlyData {
  month: string
  callsAnalyzed: number
}

// Mock data
const mockCallAnalyses: CallAnalysis[] = [
  {
    id: "1",
    fileName: "call_001.mp3",
    dateAnalyzed: "2023-04-01",
    status: "verified",
    threatLevel: "high",
    callerNumber: "+33123456789",
    recipientNumber: "+33987654321",
  },
  {
    id: "2",
    fileName: "call_002.mp3",
    dateAnalyzed: "2023-04-02",
    status: "pending",
    threatLevel: "medium",
    callerNumber: "+33234567890",
    recipientNumber: "+33876543210",
  },
  {
    id: "3",
    fileName: "call_003.mp3",
    dateAnalyzed: "2023-04-03",
    status: "false_positive",
    threatLevel: "low",
    callerNumber: "+33345678901",
    recipientNumber: "+33765432109",
  },
  {
    id: "4",
    fileName: "call_004.mp3",
    dateAnalyzed: "2023-04-04",
    status: "verified",
    threatLevel: "high",
    callerNumber: "+33456789012",
    recipientNumber: "+33654321098",
  },
  {
    id: "5",
    fileName: "call_005.mp3",
    dateAnalyzed: "2023-04-05",
    status: "pending",
    threatLevel: "medium",
    callerNumber: "+33567890123",
    recipientNumber: "+33543210987",
  },
]

const mockDashboardStats: DashboardStats = {
  totalCallsAnalyzed: 1234,
  threatsDetected: 42,
  threatsVerified: 18,
  pendingVerification: 24,
}

const mockMonthlyData: MonthlyData[] = [
  { month: "Jan", callsAnalyzed: 980 },
  { month: "Feb", callsAnalyzed: 1200 },
  { month: "Mar", callsAnalyzed: 1100 },
  { month: "Apr", callsAnalyzed: 1400 },
  { month: "May", callsAnalyzed: 1700 },
  { month: "Jun", callsAnalyzed: 1300 },
  { month: "Jul", callsAnalyzed: 1500 },
  { month: "Aug", callsAnalyzed: 1800 },
  { month: "Sep", callsAnalyzed: 2000 },
  { month: "Oct", callsAnalyzed: 1900 },
  { month: "Nov", callsAnalyzed: 2200 },
  { month: "Dec", callsAnalyzed: 2400 },
]

// Mock API functions
export async function uploadVoiceFile(file: File): Promise<{ success: boolean; message: string }> {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // Simulate successful upload 90% of the time
  if (Math.random() < 0.9) {
    return { success: true, message: "File uploaded and analyzed successfully." }
  } else {
    throw new Error("Failed to upload file. Please try again.")
  }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 500))

  return mockDashboardStats
}

export async function getMonthlyData(): Promise<MonthlyData[]> {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 700))

  return mockMonthlyData
}

export async function getRecentDetections(limit = 5): Promise<CallAnalysis[]> {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 600))

  return mockCallAnalyses.slice(0, limit)
}

