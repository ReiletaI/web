export interface CallAnalysis {
  id: string
  fileName: string
  dateAnalyzed: string
  status: "verified" | "pending" | "false_positive"
  threatLevel: "high" | "medium" | "low"
  callerNumber: string
  recipientNumber: string
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

export interface TranscriptionResponse {
  text: string
  success: boolean
}

export interface SaveConversationResponse {
  success: boolean
  message: string
  fileId?: string
}

export interface CallData {
  agentUsername: string
  callDuration: number
  callStart: string | null
  roomId: string | null
}

// API Base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000"

// Error handling helper
const handleApiError = (error: any, customMessage: string) => {
  console.error(`${customMessage}:`, error)
  throw new Error(customMessage)
}

// Dashboard API functions
export async function uploadVoiceFile(file: File): Promise<{ success: boolean; message: string }> {
  try {
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Simulate successful upload 90% of the time
    if (Math.random() < 0.9) {
      return { success: true, message: "File uploaded and analyzed successfully." }
    } else {
      throw new Error("Failed to upload file. Please try again.")
    }
  } catch (error) {
    return handleApiError(error, "Failed to upload voice file")
  }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 500))

    return mockDashboardStats
  } catch (error) {
    return handleApiError(error, "Failed to fetch dashboard stats")
  }
}

export async function getMonthlyData(): Promise<MonthlyData[]> {
  try {
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 700))

    return mockMonthlyData
  } catch (error) {
    return handleApiError(error, "Failed to fetch monthly data")
  }
}

export async function getRecentDetections(limit = 5): Promise<CallAnalysis[]> {
  try {
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 600))

    return mockCallAnalyses.slice(0, limit)
  } catch (error) {
    return handleApiError(error, "Failed to fetch recent detections")
  }
}

// WebRTC Call API functions
export async function transcribeAudio(
  audio: string | ArrayBuffer,
  roomId: string | null,
  roomStatus: string,
): Promise<TranscriptionResponse> {
  try {
    // Create a request body where roomId is either a string or omitted entirely
    const requestBody: any = {
      audio,
      roomStatus,
    }

    // Only include roomId if it's not null
    if (roomId !== null) {
      requestBody.roomId = roomId
    }

    console.log("Sending request body:", requestBody)

    const response = await fetch(`${API_BASE_URL}/groq/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`HTTP error! Status: ${response.status}, Body: ${errorText}`)
      throw new Error(`HTTP error! Status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Transcription error:", error)
    return { text: "Transcription failed", success: false }
  }
}

export async function saveConversation(
  audio: string | ArrayBuffer,
  roomId: string | null,
): Promise<SaveConversationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/save_conversation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audio,
        roomId,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error saving conversation:", error)
    return {
      success: false,
      message: "Failed to save conversation recording",
    }
  }
}

export async function logCallData(callData: CallData): Promise<{ success: boolean }> {
  try {
    // In a real implementation, this would make an API call
    console.log("Sending call data to backend:", callData)

    // For now, just simulate a successful response
    return { success: true }

    // Uncomment for actual implementation:
    // const response = await fetch(`${API_BASE_URL}/log_call`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(callData)
    // });
    //
    // if (!response.ok) {
    //   throw new Error(`HTTP error! Status: ${response.status}`);
    // }
    //
    // return await response.json();
  } catch (error) {
    console.error("Error logging call data:", error)
    return { success: false }
  }
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

