"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { initializeApp } from "firebase/app"
import {
  getFirestore,
  collection,
  doc,
  updateDoc,
  onSnapshot,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore"

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAguEchebVAngzujeazNb4SHJxitICl--k",
  authDomain: "reilet-ai.firebaseapp.com",
  projectId: "reilet-ai",
  storageBucket: "reilet-ai.firebasestorage.app",
  messagingSenderId: "598129406719",
  appId: "1:598129406719:web:3d12c40133ade1a025d2ca",
  measurementId: "G-GBRE0JM15T",
}

// WebRTC configuration with multiple STUN servers for better connectivity
const rtcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 10, // Increase candidate pool size
}

export default function ClientCallPage() {
  // State variables
  const [roomId, setRoomId] = useState("")
  const [inputRoomId, setInputRoomId] = useState("")
  const [callDuration, setCallDuration] = useState("00:00")
  const [statusMessage, setStatusMessage] = useState("")
  const [agentName, setAgentName] = useState("Not connected")
  const [isMuted, setIsMuted] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [connectionProgress, setConnectionProgress] = useState("")

  // Refs for WebRTC - initialize without browser APIs
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null) // Initialize as null instead of new MediaStream()
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const callStartTimeRef = useRef<Date | null>(null)
  const callDurationTimerRef = useRef<NodeJS.Timeout | null>(null)
  const firestoreRef = useRef<any>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const roomAvailabilityUnsubscribeRef = useRef<(() => void) | null>(null)
  const firebaseAppRef = useRef<any>(null)
  const unsubscribeRoomRef = useRef<(() => void) | null>(null)
  const unsubscribeCallerCandidatesRef = useRef<(() => void) | null>(null)

  // Toast for notifications
  const { toast } = useToast()

  // Initialize browser-specific objects after component mounts
  useEffect(() => {
    // Create MediaStream instance on the client side
    if (typeof window !== "undefined" && window.MediaStream) {
      remoteStreamRef.current = new MediaStream()
    }

    // Rest of initialization code...
    try {
      // Only initialize Firebase once
      if (!firebaseAppRef.current) {
        console.log("Initializing Firebase...")
        firebaseAppRef.current = initializeApp(firebaseConfig)
        firestoreRef.current = getFirestore(firebaseAppRef.current)
        console.log("Firebase initialized successfully")
      }
    } catch (error) {
      console.error("Error initializing Firebase:", error)
      toast({
        title: "Firebase Error",
        description: "Failed to initialize Firebase. Please refresh the page.",
        variant: "destructive",
      })
    }

    // Cleanup on unmount
    return () => {
      if (peerConnectionRef.current) {
        endCall()
      }

      // Unsubscribe from room availability listener if active
      if (roomAvailabilityUnsubscribeRef.current) {
        roomAvailabilityUnsubscribeRef.current()
        roomAvailabilityUnsubscribeRef.current = null
      }

      // Unsubscribe from room and ICE candidate listeners
      if (unsubscribeRoomRef.current) {
        unsubscribeRoomRef.current()
        unsubscribeRoomRef.current = null
      }

      if (unsubscribeCallerCandidatesRef.current) {
        unsubscribeCallerCandidatesRef.current()
        unsubscribeCallerCandidatesRef.current = null
      }
    }
  }, [toast])

  // Join a specific room
  const joinCall = async (specifiedRoomId: string) => {
    // Ensure MediaStream is available
    if (typeof window === "undefined" || !window.MediaStream) {
      toast({
        title: "Browser Compatibility Error",
        description: "Your browser doesn't support required features for calls.",
        variant: "destructive",
      })
      return
    }

    if (!specifiedRoomId) {
      toast({
        title: "Input Required",
        description: "Please enter a room ID or use Connect to Support.",
        variant: "destructive",
      })
      return
    }

    // Prevent multiple join attempts
    if (isJoining) return
    setIsJoining(true)
    setConnectionProgress("Starting connection process...")

    try {
      // Validate Firebase is initialized
      if (!firestoreRef.current) {
        throw new Error("Firebase not initialized")
      }

      setRoomId(specifiedRoomId)
      setStatusMessage("Connecting to support agent...")
      setConnectionProgress("Checking room validity...")

      // First, validate that the room exists and is available
      const roomRef = doc(firestoreRef.current, "rooms", specifiedRoomId)
      const roomSnapshot = await getDoc(roomRef)

      if (!roomSnapshot.exists()) {
        throw new Error("Room does not exist")
      }

      const roomData = roomSnapshot.data()
      if (roomData.status !== "waiting") {
        throw new Error(`Room is not available (status: ${roomData.status})`)
      }

      setConnectionProgress("Requesting microphone access...")
      console.log("Requesting microphone access...")

      try {
        localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
        console.log("Microphone access granted")
      } catch (micError) {
        console.error("Error accessing microphone:", micError)
        throw new Error("Failed to access microphone. Please check your permissions.")
      }

      // Initialize remoteStream if not already done
      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream()
      }

      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStreamRef.current
      }

      setConnectionProgress("Setting up WebRTC connection...")
      console.log("Creating RTCPeerConnection...")

      try {
        peerConnectionRef.current = new RTCPeerConnection(rtcConfig)
      } catch (rtcError) {
        console.error("Error creating RTCPeerConnection:", rtcError)
        throw new Error("Failed to create WebRTC connection")
      }

      // Log connection state changes
      peerConnectionRef.current.onconnectionstatechange = () => {
        const state = peerConnectionRef.current?.connectionState
        console.log("Connection state:", state)
        setConnectionProgress(`WebRTC connection state: ${state}`)

        // Handle connection failures
        if (state === "failed") {
          console.error("WebRTC connection failed")
          toast({
            title: "Connection Failed",
            description: "WebRTC connection failed. Please try again.",
            variant: "destructive",
          })
          closeConnection()
        } else if (state === "connected") {
          setConnectionProgress("WebRTC connection established!")
        }
      }

      // Log ICE connection state changes
      peerConnectionRef.current.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", peerConnectionRef.current?.iceConnectionState)
      }

      // Log signaling state changes
      peerConnectionRef.current.onsignalingstatechange = () => {
        console.log("Signaling state:", peerConnectionRef.current?.signalingState)
      }

      // Add local tracks to peer connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          if (peerConnectionRef.current && localStreamRef.current) {
            peerConnectionRef.current.addTrack(track, localStreamRef.current)
          }
        })
      }

      // Handle remote tracks
      peerConnectionRef.current.ontrack = (event) => {
        console.log("Remote track received:", event.track.kind)
        if (remoteStreamRef.current) {
          event.streams[0].getTracks().forEach((track) => {
            remoteStreamRef.current?.addTrack(track)
          })

          if (remoteStreamRef.current.getAudioTracks().length > 0) {
            console.log("Remote audio track added, connection established")
            setStatusMessage("Connected")
            setIsConnected(true)
            setConnectionProgress("")

            // Start call timer
            startCallTimer()
          }
        }
      }

      setConnectionProgress("Accessing room data...")
      console.log("Accessing room:", specifiedRoomId)

      // Set up ICE candidate collection
      const calleeCandidates = collection(roomRef, "calleeCandidates")

      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("New ICE candidate for client:", event.candidate.candidate.substring(0, 50) + "...")
          addDoc(calleeCandidates, event.candidate.toJSON()).catch((err) =>
            console.error("Error adding ICE candidate:", err),
          )
        }
      }

      try {
        setConnectionProgress("Getting room offer...")
        console.log("Getting room data...")

        const roomData = roomSnapshot.data()
        const offer = roomData.offer

        // Get agent username from room data
        setAgentName(roomData.agentUsername || "Unknown")
        console.log("Agent name:", roomData.agentUsername || "Unknown")

        setConnectionProgress("Setting up WebRTC connection...")
        console.log("Setting remote description (offer)...")

        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer))
        } catch (sdpError) {
          console.error("Error setting remote description:", sdpError)
          throw new Error("Failed to process connection offer")
        }

        console.log("Creating answer...")
        const answer = await peerConnectionRef.current.createAnswer()
        console.log("Setting local description (answer)...")
        await peerConnectionRef.current.setLocalDescription(answer)

        setConnectionProgress("Sending connection response...")
        console.log("Updating room with answer...")

        try {
          await updateDoc(roomRef, {
            answer: { type: answer.type, sdp: answer.sdp },
            status: "connected",
          })
        } catch (updateError) {
          console.error("Error updating room with answer:", updateError)
          throw new Error("Failed to send connection response")
        }

        // Listen for ICE candidates from the agent
        setConnectionProgress("Setting up connection listeners...")
        console.log("Setting up ICE candidates listener...")

        const unsubscribeCallerCandidates = onSnapshot(
          collection(roomRef, "callerCandidates"),
          (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === "added") {
                const candidate = new RTCIceCandidate(change.doc.data())
                console.log("Received ICE candidate from agent:", candidate.candidate.substring(0, 50) + "...")
                peerConnectionRef.current
                  ?.addIceCandidate(candidate)
                  .catch((err) => console.error("Error adding ICE candidate from agent:", err))
              }
            })
          },
          (error) => {
            console.error("Error in ICE candidates listener:", error)
          },
        )

        unsubscribeCallerCandidatesRef.current = unsubscribeCallerCandidates

        // Listen for room status changes (e.g., if agent disconnects)
        console.log("Setting up room status listener...")
        const unsubscribeRoom = onSnapshot(
          roomRef,
          (snapshot) => {
            const data = snapshot.data()
            if (!data) {
              console.log("Room document deleted")
              return
            }

            if (data.status === "ended" && peerConnectionRef.current) {
              console.log("Call ended by support agent")
              setStatusMessage("Call ended by support agent.")
              closeConnection()
            }
          },
          (error) => {
            console.error("Error in room snapshot listener:", error)
            // If we can't listen to the room, close the connection for safety
            if (peerConnectionRef.current) {
              setStatusMessage("Connection error. Please try again.")
              closeConnection()
            }
          },
        )

        unsubscribeRoomRef.current = unsubscribeRoom

        setConnectionProgress("Waiting for agent to accept the call...")
      } catch (error) {
        console.error("Error joining call:", error)
        throw error
      }
    } catch (error) {
      console.error("Error joining call:", error)

      // Provide more specific error messages based on the error type
      let errorMessage = "Failed to join call. Please try again."

      if (error instanceof Error) {
        if (error.message.includes("Room does not exist")) {
          errorMessage = "The room ID you entered does not exist. Please check and try again."
        } else if (error.message.includes("Room is not available")) {
          errorMessage = "This room is no longer available. Please try another room or connect to support."
        } else if (error.message.includes("microphone")) {
          errorMessage = "Failed to access microphone. Please check your permissions and try again."
        } else if (error.message.includes("WebRTC")) {
          errorMessage = "Failed to set up call connection. Please check your network and try again."
        }
      }

      setStatusMessage(`Error: ${errorMessage}`)
      closeConnection()

      toast({
        title: "Join Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsJoining(false)
    }
  }

  // Find and join an available room
  const findAndJoinAvailableRoom = async () => {
    // Ensure MediaStream is available
    if (typeof window === "undefined" || !window.MediaStream) {
      toast({
        title: "Browser Compatibility Error",
        description: "Your browser doesn't support required features for calls.",
        variant: "destructive",
      })
      return
    }

    // Prevent multiple search attempts
    if (isSearching) return
    setIsSearching(true)

    setStatusMessage("Looking for available support agents...")
    setConnectionProgress("Searching for available agents...")
    setInputRoomId("")

    try {
      // Validate Firebase is initialized
      if (!firestoreRef.current) {
        throw new Error("Firebase not initialized")
      }

      console.log("Querying for available rooms...")
      const roomsQuery = query(
        collection(firestoreRef.current, "rooms"),
        where("status", "==", "waiting"),
        orderBy("createdAt"),
        limit(1),
      )

      const roomsSnapshot = await getDocs(roomsQuery)

      if (roomsSnapshot.empty) {
        console.log("No available rooms found, setting up listener")
        setStatusMessage("Waiting for support agent...")
        setConnectionProgress("No agents available. Waiting for one to become available...")
        // Set up a listener for any new available rooms
        setupRoomAvailabilityListener()
      } else {
        const availableRoom = roomsSnapshot.docs[0]
        console.log("Available room found:", availableRoom.id)
        setConnectionProgress(`Agent found! Room ID: ${availableRoom.id}`)
        joinCall(availableRoom.id)
      }
    } catch (error) {
      console.error("Error finding available room:", error)
      setStatusMessage("Error finding available room. Please try entering a room ID manually.")
      setConnectionProgress("")

      toast({
        title: "Search Error",
        description: "Failed to find available support agents. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSearching(false)
    }
  }

  // Listen for any new available rooms
  const setupRoomAvailabilityListener = () => {
    // Validate Firebase is initialized
    if (!firestoreRef.current) {
      console.error("Firebase not initialized")
      return
    }

    console.log("Setting up room availability listener...")
    const q = query(collection(firestoreRef.current, "rooms"), where("status", "==", "waiting"), orderBy("createdAt"))

    // Unsubscribe from previous listener if exists
    if (roomAvailabilityUnsubscribeRef.current) {
      roomAvailabilityUnsubscribeRef.current()
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty && !peerConnectionRef.current) {
          // New room available
          const availableRoom = snapshot.docs[0]
          console.log("Support agent found:", availableRoom.id)
          setStatusMessage("Support agent found, connecting...")
          setConnectionProgress(`Agent found! Room ID: ${availableRoom.id}`)

          // Unsubscribe before joining to prevent duplicate joins
          unsubscribe()
          roomAvailabilityUnsubscribeRef.current = null

          joinCall(availableRoom.id)
        }
      },
      (error) => {
        console.error("Error in room availability listener:", error)
        setStatusMessage("Error monitoring for available agents.")
        setConnectionProgress("")

        toast({
          title: "Monitoring Error",
          description: "Failed to monitor for available agents. Please try again.",
          variant: "destructive",
        })
      },
    )

    // Store the unsubscribe function so we can call it when needed
    roomAvailabilityUnsubscribeRef.current = unsubscribe
    return unsubscribe
  }

  // Start call timer
  const startCallTimer = () => {
    // Initialize call start time
    callStartTimeRef.current = new Date()

    // Update timer display every second
    callDurationTimerRef.current = setInterval(() => {
      if (!callStartTimeRef.current) return

      const now = new Date()
      const diff = now.getTime() - callStartTimeRef.current.getTime()

      // Convert to minutes and seconds
      const minutes = Math.floor(diff / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)

      // Format display
      setCallDuration(`${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`)
    }, 1000)
  }

  // Toggle mute
  const toggleMute = () => {
    if (!localStreamRef.current) return

    const newMuteState = !isMuted
    setIsMuted(newMuteState)

    // Mute/unmute client's microphone
    localStreamRef.current.getTracks().forEach((track) => {
      track.enabled = !newMuteState
    })

    console.log("Client microphone " + (newMuteState ? "muted" : "unmuted"))

    toast({
      title: newMuteState ? "Microphone Muted" : "Microphone Unmuted",
      description: newMuteState ? "Your microphone is now muted." : "Your microphone is now unmuted.",
    })
  }

  // End call
  const endCall = () => {
    setStatusMessage("Ending call...")
    setConnectionProgress("Ending call...")

    // Update room status in Firestore if there's a valid roomId
    if (roomId && firestoreRef.current) {
      console.log("Updating room status to ended...")
      const roomRef = doc(firestoreRef.current, "rooms", roomId)
      // Make sure we update the Firestore record BEFORE closing the connection
      updateDoc(roomRef, {
        status: "ended",
        endedAt: serverTimestamp(),
      })
        .then(() => {
          console.log("Room status updated successfully")
          setStatusMessage("Call ended successfully.")
          closeConnection()
        })
        .catch((err) => {
          console.error("Error updating room status:", err)
          setStatusMessage("Error ending call, but connection closed.")
          closeConnection()

          toast({
            title: "Call End Error",
            description: "There was an issue ending the call properly, but your connection has been closed.",
            variant: "destructive",
          })
        })
    } else {
      setStatusMessage("Call ended.")
      closeConnection()
    }
  }

  // Close connection
  const closeConnection = () => {
    console.log("Closing connection...")
    setConnectionProgress("")

    // Unsubscribe from listeners
    if (unsubscribeRoomRef.current) {
      unsubscribeRoomRef.current()
      unsubscribeRoomRef.current = null
    }

    if (unsubscribeCallerCandidatesRef.current) {
      unsubscribeCallerCandidatesRef.current()
      unsubscribeCallerCandidatesRef.current = null
    }

    // Stop call timer
    if (callDurationTimerRef.current) {
      clearInterval(callDurationTimerRef.current)
      callDurationTimerRef.current = null
    }

    // Close connections - ensure clean release of resources
    if (peerConnectionRef.current) {
      try {
        // Close the peer connection properly
        peerConnectionRef.current.getSenders().forEach((sender) => {
          if (sender.track) {
            sender.track.stop()
          }
        })
        peerConnectionRef.current.close()
      } catch (e) {
        console.error("Error closing peer connection:", e)
      } finally {
        peerConnectionRef.current = null
      }
    }

    // Ensure streams are properly cleaned up
    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach((track) => track.stop())
      } catch (e) {
        console.error("Error stopping local tracks:", e)
      } finally {
        localStreamRef.current = null
      }
    }

    // Clear the remote stream
    if (typeof window !== "undefined" && window.MediaStream) {
      remoteStreamRef.current = new MediaStream()
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStreamRef.current
      }
    } else {
      remoteStreamRef.current = null
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null
      }
    }

    // Reset UI
    setInputRoomId("")
    setIsMuted(false)
    setAgentName("Not connected")
    setCallDuration("00:00")
    setIsConnected(false)

    // Reset variables
    setRoomId("")
    callStartTimeRef.current = null
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <h1 className="text-3xl font-bold tracking-tight">Client Call Interface</h1>

      <Card>
        <CardHeader>
          <CardTitle>Join a Call</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {!isConnected ? (
              <div className="space-y-4">
                <div className="grid w-full items-center gap-1.5">
                  <label htmlFor="roomIdInput">Enter Room ID:</label>
                  <Input
                    id="roomIdInput"
                    value={inputRoomId}
                    onChange={(e) => setInputRoomId(e.target.value)}
                    placeholder="Enter room ID"
                    disabled={isJoining || isSearching}
                  />
                </div>

                <div className="flex space-x-4">
                  <Button onClick={() => joinCall(inputRoomId)} disabled={isJoining || isSearching || !inputRoomId}>
                    {isJoining ? "Joining..." : "Join Call"}
                  </Button>
                  <Button onClick={findAndJoinAvailableRoom} variant="outline" disabled={isJoining || isSearching}>
                    {isSearching ? "Searching..." : "Connect to Support"}
                  </Button>
                </div>

                {connectionProgress && (
                  <div className="mt-2 p-2 bg-muted rounded text-sm">
                    <p className="font-semibold">Connection Progress:</p>
                    <p>{connectionProgress}</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex justify-between">
                  <div>
                    <p>
                      <strong>Support Agent:</strong> {agentName}
                    </p>
                    <p>
                      <strong>Call Duration:</strong> {callDuration}
                    </p>
                  </div>

                  <div className="flex space-x-4">
                    <Button onClick={toggleMute} variant="outline">
                      {isMuted ? "Unmute" : "Mute"}
                    </Button>
                    <Button onClick={endCall} variant="destructive">
                      End Call
                    </Button>
                  </div>
                </div>
              </>
            )}

            {statusMessage && (
              <div className="mt-4 p-3 bg-muted rounded-md">
                <p>{statusMessage}</p>
              </div>
            )}

            {/* Hidden audio element for playback */}
            <audio ref={remoteAudioRef} autoPlay className="hidden" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

