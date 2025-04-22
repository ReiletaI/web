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

// Update the TranscriptionResponse interface to include source
export interface TranscriptionResponse {
  text: string
  success: boolean
  source?: string
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
export const API_BASE_URL = "/api"

// Error handling helper
const handleApiError = (error: any, customMessage: string) => {
  console.error(`${customMessage}:`, error)
  throw new Error(customMessage)
}

// Dashboard API functions
export async function uploadVoiceFile(file: File): Promise<{ success: boolean; message: string }> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error('Failed to upload file');
    }
    return await response.json();
  } catch (error) {
    return handleApiError(error, "Failed to upload voice file");
  }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const response = await fetch(`${API_BASE_URL}/dashboard/stats`, {
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error('Failed to fetch dashboard stats');
    }
    return await response.json();
  } catch (error) {
    return handleApiError(error, "Failed to fetch dashboard stats");
  }
}

export async function getMonthlyData(): Promise<MonthlyData[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/monthly/data`, {
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error('Failed to fetch monthly data');
    }
    return await response.json();
  } catch (error) {
    return handleApiError(error, "Failed to fetch monthly data");
  }
}

export async function getRecentDetections(limit = 5): Promise<CallAnalysis[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/recent/detections?limit=${limit}`);
    if (!response.ok) {
      throw new Error('Failed to fetch recent detections');
    }
    return await response.json();
  } catch (error) {
    return handleApiError(error, "Failed to fetch recent detections");
  }
}

// Add a new call analysis to the backend
export async function addCallAnalysis(data: Omit<CallAnalysis, "id">): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error('Failed to add call analysis');
    }
    return await response.json();
  } catch (error) {
    return handleApiError(error, "Failed to add call analysis");
  }
}

// WebRTC Call API functions
// Updated transcribeAudio function to handle both agent and client audio
export async function transcribeAudio(
  data: {
    audio_client?: string | ArrayBuffer,
    audio_support?: string | ArrayBuffer,
    roomId?: string | null,
    roomStatus?: string
  }
): Promise<TranscriptionResponse> {
  try {
    // Validate input data
    if (!data.audio_client && !data.audio_support) {
      console.error("No audio data provided for transcription");
      return { text: "No audio data provided", success: false };
    }

    // Create a request body
    const requestBody: any = {
      roomStatus: data.roomStatus || "unknown",
    };

    // Add audio streams if available
    if (data.audio_client) {
      requestBody.audio_client = data.audio_client;
    }

    if (data.audio_support) {
      requestBody.audio_support = data.audio_support;
    }

    // Add roomId if available
    if (data.roomId) {
      requestBody.roomId = data.roomId;
    }

    // Log request size rather than full content
    const clientSize = data.audio_client ?
      (typeof data.audio_client === 'string' ? data.audio_client.length : 'binary data') : 'none';
    const supportSize = data.audio_support ?
      (typeof data.audio_support === 'string' ? data.audio_support.length : 'binary data') : 'none';

    console.log(`Sending transcription request with roomId: ${data.roomId}, client audio size: ${clientSize}, support audio size: ${supportSize}`);

    // Update the endpoint to handle dual audio streams
    const response = await fetch(`${API_BASE_URL}/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      credentials: 'include'
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HTTP error! Status: ${response.status}, Body: ${errorText}`);
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Transcription error:", error);
    return { text: "Transcription failed", success: false };
  }
}

export async function saveConversation(
  audio: string | ArrayBuffer,
  roomId: string | null,
  vishingAnalysis: string | null,
): Promise<SaveConversationResponse> {
  let threatLevel: "high" | "medium" | "low";
  if (vishingAnalysis === "Fraud") {
    threatLevel = "high";
  } else if (vishingAnalysis === "Suspect") {
    threatLevel = "medium";
  } else {
    threatLevel = "low";
  }

  // Prepare analysis record data
  const callerNumber = `+33${Math.floor(100000000 + Math.random() * 900000000)}`;
  const recipientNumber = "+33123456789";
  const fileName = roomId ? `${roomId}` : `call_${Date.now()}`;
  const analysisData: Omit<CallAnalysis, "id"> = {
    fileName,
    dateAnalyzed: new Date().toISOString(),
    status: "pending",
    threatLevel,
    callerNumber,
    recipientNumber,
  };
  try {
    const result: any = await addCallAnalysis(analysisData);
    return {
      success: true,
      message: "Conversation analysis saved",
      fileId: String(result.id),
    };
  } catch (error) {
    console.error("Error saving conversation analysis:", error);
    return {
      success: false,
      message: "Failed to save conversation analysis",
    };
  }
}