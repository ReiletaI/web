"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  addDoc,
  getDocs,
  getDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { transcribeAudio, saveConversation, logCallData } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAguEchebVAngzujeazNb4SHJxitICl--k",
  authDomain: "reilet-ai.firebaseapp.com",
  projectId: "reilet-ai",
  storageBucket: "reilet-ai.firebasestorage.app",
  messagingSenderId: "598129406719",
  appId: "1:598129406719:web:3d12c40133ade1a025d2ca",
  measurementId: "G-GBRE0JM15T",
};

// WebRTC configuration
const rtcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export default function AgentCallPage() {
  // State variables
  const [isAgentAvailable, setIsAgentAvailable] = useState(false);
  const [isAgentMuted, setIsAgentMuted] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState("00:00");
  const [statusMessage, setStatusMessage] = useState("Disconnected");
  const [transcription, setTranscription] = useState<
    { text: string; source: string }[]
  >([]);
  const [isInitializing, setIsInitializing] = useState(false);

  // Refs for WebRTC - initialize without browser APIs
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null); // Initialize as null instead of new MediaStream()
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const callStartTimeRef = useRef<Date | null>(null);
  const callDurationTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Update the transcription recorder ref to store both agent and client recorders
  const transcriptionRecorderRef = useRef<{
    agent: MediaRecorder | null;
    client: MediaRecorder | null;
  }>({
    agent: null,
    client: null,
  });
  const fullRecorderRef = useRef<MediaRecorder | null>(null);
  const fullChunksRef = useRef<Blob[]>([]);
  const firestoreRef = useRef<any>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const firebaseAppRef = useRef<any>(null);
  // Add a ref to store the current roomId to avoid closure issues
  const currentRoomIdRef = useRef<string | null>(null);
  const currentStatusRef = useRef<string>("Disconnected");

  // Toast for notifications
  const { toast } = useToast();

  // Update the currentRoomIdRef whenever roomId changes
  useEffect(() => {
    currentRoomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    currentStatusRef.current = statusMessage;
  }, [statusMessage]);

  // Initialize browser-specific objects after component mounts
  useEffect(() => {
    // Create MediaStream instance on the client side
    if (typeof window !== "undefined" && window.MediaStream) {
      remoteStreamRef.current = new MediaStream();
    }

    try {
      // Only initialize Firebase once
      if (!firebaseAppRef.current) {
        firebaseAppRef.current = initializeApp(firebaseConfig);
        firestoreRef.current = getFirestore(firebaseAppRef.current);
      }
    } catch (error) {
      console.error("Error initializing Firebase:", error);
      toast({
        title: "Firebase Error",
        description: "Failed to initialize Firebase. Please refresh the page.",
        variant: "destructive",
      });
    }

    // Cleanup on unmount
    return () => {
      if (peerConnectionRef.current) {
        endCurrentSession();
      }
    };
  }, [toast]);

  // Toggle agent availability
  const toggleAvailability = async () => {
    if (isAgentAvailable) {
      // Set agent to unavailable
      setIsAgentAvailable(false);
      setStatusMessage("Disconnected");
      endCurrentSession();
    } else {
      // Prevent multiple initialization attempts
      if (isInitializing) return;

      setIsInitializing(true);

      // Set agent to available and create a new room
      setIsAgentAvailable(true);
      setStatusMessage("Setting up...");

      try {
        // Create a new room immediately instead of using setTimeout
        await createNewRoom();
      } catch (error) {
        console.error("Error creating room:", error);
        setStatusMessage("Failed to set up call. Please try again.");
        setIsAgentAvailable(false);
        toast({
          title: "Setup Error",
          description: "Failed to set up call. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsInitializing(false);
      }
    }
  };

  // Create a new call room
  const createNewRoom = async () => {
    // Ensure MediaStream is available
    if (typeof window === "undefined" || !window.MediaStream) {
      toast({
        title: "Browser Compatibility Error",
        description:
          "Your browser doesn't support required features for calls.",
        variant: "destructive",
      });
      return;
    }

    // Validate Firebase is initialized
    if (!firestoreRef.current) {
      console.error("Firestore not initialized");
      setStatusMessage("Error: Firebase not initialized");
      setIsAgentAvailable(false);
      return;
    }

    // End any existing session
    if (peerConnectionRef.current) {
      endCurrentSession();
    }

    // Reset recorder variables
    transcriptionRecorderRef.current = {
      agent: null,
      client: null,
    };
    fullRecorderRef.current = null;
    fullChunksRef.current = [];

    // Generate a unique room ID
    const newRoomId = Math.random().toString(36).substring(2, 10);
    setRoomId(newRoomId);
    // Also update the ref immediately to avoid any race conditions
    currentRoomIdRef.current = newRoomId;

    setStatusMessage("Accessing microphone...");

    // Get the support agent's own microphone
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
    } catch (e) {
      console.error("Error accessing audio devices:", e);
      setStatusMessage(
        "Error accessing microphone. Please check your permissions."
      );
      setIsAgentAvailable(false);
      toast({
        title: "Microphone Error",
        description:
          "Failed to access microphone. Please check your permissions.",
        variant: "destructive",
      });
      return;
    }

    setStatusMessage("Setting up WebRTC...");

    // Setup WebRTC peer connection
    try {
      const peerConnection = new RTCPeerConnection(rtcConfig);
      peerConnectionRef.current = peerConnection;

      // Log ICE connection state changes
      peerConnection.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", peerConnection.iceConnectionState);
      };

      // Log signaling state changes
      peerConnection.onsignalingstatechange = () => {
        console.log("Signaling state:", peerConnection.signalingState);
      };

      // Log connection state changes
      peerConnection.onconnectionstatechange = () => {
        console.log("Connection state:", peerConnection.connectionState);

        // Handle connection failures
        if (peerConnection.connectionState === "failed") {
          console.error("WebRTC connection failed");
          toast({
            title: "Connection Failed",
            description: "WebRTC connection failed. Please try again.",
            variant: "destructive",
          });

          // Attempt to recreate the room
          if (isAgentAvailable) {
            setStatusMessage("Connection failed. Retrying...");
            setTimeout(() => {
              if (isAgentAvailable) {
                createNewRoom();
              }
            }, 2000);
          }
        }
      };
    } catch (e) {
      console.error("Error creating RTCPeerConnection:", e);
      setStatusMessage("Error setting up WebRTC. Please try again.");
      setIsAgentAvailable(false);
      toast({
        title: "WebRTC Error",
        description: "Failed to set up WebRTC connection. Please try again.",
        variant: "destructive",
      });
      return;
    }

    // Add the support agent's audio tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        if (peerConnectionRef.current && localStreamRef.current) {
          peerConnectionRef.current.addTrack(track, localStreamRef.current);
        }
      });
    }

    // Initialize remoteStream if not already done
    if (!remoteStreamRef.current) {
      remoteStreamRef.current = new MediaStream();
    }

    // Set the remote audio element to play client audio
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStreamRef.current;
    }

    // When remote track (client audio) is received, add it to remoteStream
    if (peerConnectionRef.current) {
      peerConnectionRef.current.ontrack = (event) => {
        if (remoteStreamRef.current) {
          event.streams[0].getTracks().forEach((track) => {
            remoteStreamRef.current?.addTrack(track);
          });

          // Once remote audio is available, display connection status
          if (remoteStreamRef.current.getAudioTracks().length > 0) {
            setStatusMessage("Connected");

            // Start call timer
            startCallTimer();

            // Start transcription recorders for both agent and client
            startTranscriptionRecorders();

            // Start full conversation recorder (combined local+remote)
            if (
              !fullRecorderRef.current &&
              localStreamRef.current &&
              remoteStreamRef.current.getAudioTracks().length > 0
            ) {
              startFullRecorder();
            }
          }
        }
      };
    }

    setStatusMessage("Creating Firestore room...");

    // Create Firestore room document for signaling
    try {
      const roomRef = doc(collection(firestoreRef.current, "rooms"), newRoomId);
      const callerCandidatesCollection = collection(
        roomRef,
        "callerCandidates"
      );

      if (peerConnectionRef.current) {
        peerConnectionRef.current.onicecandidate = (event) => {
          if (event.candidate) {
            console.log(
              "New ICE candidate for agent:",
              event.candidate.candidate.substring(0, 50) + "..."
            );
            addDoc(callerCandidatesCollection, event.candidate.toJSON()).catch(
              (err) => console.error("Error adding ICE candidate:", err)
            );
          }
        };
      }

      // Create offer and store it in Firestore
      if (peerConnectionRef.current) {
        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);

        const roomWithOffer = {
          offer: {
            type: offer.type,
            sdp: offer.sdp,
          },
          status: "waiting",
          agentUsername: "agent", // Add agent username for the client to see
          createdAt: serverTimestamp(),
        };

        await setDoc(roomRef, roomWithOffer);

        // Listen for answer and ICE candidates from the client and room status changes
        const unsubscribe = onSnapshot(
          roomRef,
          async (snapshot) => {
            const data = snapshot.data();
            if (!peerConnectionRef.current) {
              console.log(
                "Peer connection no longer exists, ignoring room update"
              );
              return;
            }

            // Validate room is still active
            const isRoomValid = await validateRoomStatus(newRoomId);
            if (!isRoomValid && peerConnectionRef.current) {
              console.log("Room is no longer valid");
              setStatusMessage("Room expired or invalid.");
              endCurrentSession();

              // If agent is still available, create a new room
              if (isAgentAvailable) {
                setStatusMessage("Creating new room...");
                setTimeout(() => {
                  if (isAgentAvailable) {
                    createNewRoom().catch((err) => {
                      console.error("Error recreating room:", err);
                      setStatusMessage("Failed to create new room.");
                    });
                  }
                }, 1500);
              }
              return;
            }

            if (
              !peerConnectionRef.current.currentRemoteDescription &&
              data &&
              data.answer
            ) {
              // Client is connecting
              setStatusMessage("Call found, connecting...");

              try {
                const answer = new RTCSessionDescription(data.answer);
                await peerConnectionRef.current.setRemoteDescription(answer);
              } catch (err) {
                console.error("Error setting remote description:", err);
                toast({
                  title: "Connection Error",
                  description: "Failed to establish connection with client.",
                  variant: "destructive",
                });
              }
            }

            // Check if client has ended the call
            if (data && data.status === "ended" && peerConnectionRef.current) {
              setStatusMessage("Call disconnected.");
              endCurrentSession();

              // If agent is still available, create a new room after a short delay
              if (isAgentAvailable) {
                setStatusMessage("Preparing new room...");
                setTimeout(() => {
                  if (isAgentAvailable) {
                    createNewRoom().catch((err) => {
                      console.error("Error recreating room:", err);
                      setStatusMessage("Failed to create new room.");
                    });
                  }
                }, 1500);
              }
            }
          },
          (error) => {
            console.error("Error in room snapshot listener:", error);
            setStatusMessage("Error monitoring call status.");
            toast({
              title: "Monitoring Error",
              description: "Failed to monitor call status. Please try again.",
              variant: "destructive",
            });
          }
        );

        // Listen for ICE candidates from the client
        const calleeCandidatesCollection = collection(
          roomRef,
          "calleeCandidates"
        );
        const unsubscribeCalleeCandidates = onSnapshot(
          calleeCandidatesCollection,
          (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === "added") {
                const candidate = new RTCIceCandidate(change.doc.data());
                console.log(
                  "Received ICE candidate from client:",
                  candidate.candidate.substring(0, 50) + "..."
                );
                peerConnectionRef.current
                  ?.addIceCandidate(candidate)
                  .catch((err) =>
                    console.error(
                      "Error adding ICE candidate from client:",
                      err
                    )
                  );
              }
            });
          },
          (error) => {
            console.error("Error in ICE candidates listener:", error);
          }
        );

        setStatusMessage("Waiting for caller...");
      }
    } catch (error) {
      console.error("Error setting up Firestore room:", error);
      setStatusMessage("Error creating call room. Please try again.");
      setIsAgentAvailable(false);
      toast({
        title: "Room Creation Error",
        description: "Failed to create call room. Please try again.",
        variant: "destructive",
      });

      // Clean up resources
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    }
  };

  // Validate if a room is still active
  const validateRoomStatus = async (roomId: string) => {
    if (!roomId || !firestoreRef.current) return false;

    try {
      const roomRef = doc(firestoreRef.current, "rooms", roomId);
      const roomSnapshot = await getDoc(roomRef);

      if (!roomSnapshot.exists()) {
        return false;
      }

      const roomData = roomSnapshot.data();

      // Check if room is valid (not ended)
      if (roomData.status === "ended" || roomData.status === "expired") {
        console.log(`Room is already ${roomData.status}`);
        return false;
      }

      // Check if room is too old (created more than 15 minutes ago)
      if (roomData.createdAt) {
        const roomAge =
          new Date().getTime() - roomData.createdAt.toDate().getTime();
        const maxRoomAge = 15 * 60 * 1000; // 15 minutes in milliseconds

        if (roomAge > maxRoomAge) {
          console.log("Room is too old, marking as expired");
          await updateDoc(roomRef, {
            status: "expired",
            endedAt: serverTimestamp(),
          });
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error("Error validating room:", error);
      return false;
    }
  };

  // Start call timer
  const startCallTimer = () => {
    // Initialize call start time
    callStartTimeRef.current = new Date();

    // Update timer display every second
    callDurationTimerRef.current = setInterval(() => {
      if (!callStartTimeRef.current) return;

      const now = new Date();
      const diff = now.getTime() - callStartTimeRef.current.getTime();

      // Convert to minutes and seconds
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      // Format display
      setCallDuration(
        `${minutes.toString().padStart(2, "0")}:${seconds
          .toString()
          .padStart(2, "0")}`
      );
    }, 1000);
  };

  // Toggle mute
  const toggleMute = () => {
    if (!localStreamRef.current) return;

    const newMuteState = !isAgentMuted;
    setIsAgentMuted(newMuteState);

    // Mute/unmute agent's microphone
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !newMuteState;
    });

    console.log("Agent microphone " + (newMuteState ? "muted" : "unmuted"));
  };

  // Disconnect client
  const disconnectClient = () => {
    if (window.confirm("Are you sure you want to disconnect the call?")) {
      console.log("Disconnecting client...");

      // Stop full recorder and save the conversation with the correct roomId
      if (
        fullRecorderRef.current &&
        fullRecorderRef.current.state === "recording"
      ) {
        fullRecorderRef.current.stop();
        // Give time for the recorder.onstop to process before ending the session
        setTimeout(() => {
          sendCallDataToBackend();
          endCurrentSession();

          // Add a small delay before creating a new room
          if (isAgentAvailable) {
            setStatusMessage("Ready for next call...");
            setTimeout(() => {
              if (isAgentAvailable) {
                createNewRoom().catch((err) => {
                  console.error("Error recreating room:", err);
                  setStatusMessage("Failed to create new room.");
                });
              }
            }, 1500);
          }
        }, 500);
      } else {
        sendCallDataToBackend();
        endCurrentSession();

        if (isAgentAvailable) {
          setStatusMessage("Ready for next call...");
          setTimeout(() => {
            if (isAgentAvailable) {
              createNewRoom().catch((err) => {
                console.error("Error recreating room:", err);
                setStatusMessage("Failed to create new room.");
              });
            }
          }, 1500);
        }
      }
    }
  };

  // Report client (placeholder)
  const reportClient = () => {
    toast({
      title: "Report Submitted",
      description:
        "Reporting functionality will be implemented in a future update.",
    });
  };

  // End current session
  const endCurrentSession = () => {
    console.log("Ending current session...");

    // Stop transcription recorders
    if (
      transcriptionRecorderRef.current.agent &&
      transcriptionRecorderRef.current.agent.state === "recording"
    ) {
      transcriptionRecorderRef.current.agent.stop();
    }

    if (
      transcriptionRecorderRef.current.client &&
      transcriptionRecorderRef.current.client.state === "recording"
    ) {
      transcriptionRecorderRef.current.client.stop();
    }

    transcriptionRecorderRef.current = {
      agent: null,
      client: null,
    };

    // Stop full conversation recorder
    if (
      fullRecorderRef.current &&
      fullRecorderRef.current.state === "recording"
    ) {
      fullRecorderRef.current.stop();
      fullRecorderRef.current = null;
      fullChunksRef.current = [];
    }

    // Stop call timer
    if (callDurationTimerRef.current) {
      clearInterval(callDurationTimerRef.current);
      callDurationTimerRef.current = null;
    }

    // Calculate call duration for logging
    let callDurationSeconds = 0;
    if (callStartTimeRef.current) {
      callDurationSeconds = Math.floor(
        (new Date().getTime() - callStartTimeRef.current.getTime()) / 1000
      );
      callStartTimeRef.current = null;
    }

    // Stop peer connection and media
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Clear the remote stream
    if (typeof window !== "undefined" && window.MediaStream) {
      remoteStreamRef.current = new MediaStream();
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStreamRef.current;
      }
    } else {
      remoteStreamRef.current = null;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
    }

    // Reset UI
    setCallDuration("00:00");
    setTranscription([]);

    // Update room status in Firestore and remove listeners
    if (roomId && firestoreRef.current) {
      const roomRef = doc(firestoreRef.current, "rooms", roomId);

      // Add custom metadata to help with cleanup
      updateDoc(roomRef, {
        status: "ended",
        endedAt: serverTimestamp(),
        callDuration: callDurationSeconds,
        properlyTerminated: true, // Flag to indicate proper termination
      }).catch((err) => {
        console.error("Error updating room status:", err);
      });

      // Delete ICE candidates to prevent future reconnection attempts
      const callerCandidatesRef = collection(roomRef, "callerCandidates");
      const calleeCandidatesRef = collection(roomRef, "calleeCandidates");

      // Use the correct Firebase v9 pattern for deleting documents
      getDocs(callerCandidatesRef).then((snapshot) => {
        snapshot.forEach((document) => {
          // Use deleteDoc with the document reference instead of doc.ref.delete()
          deleteDoc(
            doc(
              firestoreRef.current,
              "rooms",
              roomId,
              "callerCandidates",
              document.id
            )
          ).catch((err) =>
            console.error("Error deleting caller candidate:", err)
          );
        });
      });

      getDocs(calleeCandidatesRef).then((snapshot) => {
        snapshot.forEach((document) => {
          // Use deleteDoc with the document reference instead of doc.ref.delete()
          deleteDoc(
            doc(
              firestoreRef.current,
              "rooms",
              roomId,
              "calleeCandidates",
              document.id
            )
          ).catch((err) =>
            console.error("Error deleting callee candidate:", err)
          );
        });
      });

      // Clear the roomId state and ref
      setRoomId(null);
      currentRoomIdRef.current = null;
    }
  };

  // Start transcription recorders for both agent and client
  const startTranscriptionRecorders = () => {
    console.log("Starting transcription recorders...");

    // Start agent recorder if local stream is available
    if (
      localStreamRef.current &&
      localStreamRef.current.getAudioTracks().length > 0
    ) {
      const agentRecorder = createAndStartRecorder(
        localStreamRef.current,
        "agent"
      );
      if (agentRecorder) {
        transcriptionRecorderRef.current.agent = agentRecorder;
      }
    }

    // Start client recorder if remote stream is available
    if (
      remoteStreamRef.current &&
      remoteStreamRef.current.getAudioTracks().length > 0
    ) {
      const clientRecorder = createAndStartRecorder(
        remoteStreamRef.current,
        "client"
      );
      if (clientRecorder) {
        transcriptionRecorderRef.current.client = clientRecorder;
      }
    }
  };

  // Create and start a recorder for a specific stream and source type
  const createAndStartRecorder = (
    stream: MediaStream,
    sourceType: "agent" | "client"
  ): MediaRecorder | null => {
    const options = { mimeType: "audio/webm" };

    try {
      const recorder = new MediaRecorder(stream, options);

      recorder.ondataavailable = async (event) => {
        if (event.data && event.data.size > 0) {
          console.log(
            `${sourceType} transcription data available, size:`,
            event.data.size
          );
          const audioBlob = event.data;
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64data = reader.result;
            // Use the refs to get the current values
            const activeRoomId = currentRoomIdRef.current;
            const currentStatus = currentStatusRef.current;

            // Log the values we're using
            console.log(
              `Sending ${sourceType} transcription with roomId: ${activeRoomId}, status: ${currentStatus}`
            );

            if (!activeRoomId) {
              console.error(
                `No active room ID available for ${sourceType} transcription`
              );
              return;
            }

            // Send the chunk for transcription using the API function
            try {
              console.log(
                `Sending ${sourceType} audio chunk for transcription...`
              );
              const response = await transcribeAudio(
                base64data,
                activeRoomId,
                currentStatus,
                sourceType // Add sourceType to the API call
              );

              // Add proper null/undefined checks
              if (response && response.success !== false && response.text) {
                // Safely log the response text with substring
                const previewText = response.text.substring(0, 50) + "...";
                console.log(
                  `${sourceType} transcription received:`,
                  previewText
                );

                // Add the transcription with source information
                setTranscription((prev) => [
                  ...prev,
                  {
                    text: response.text,
                    source: sourceType,
                  },
                ]);
              } else {
                console.error(
                  `${sourceType} transcription failed or returned invalid data:`,
                  response
                );
              }
            } catch (err) {
              console.error(`${sourceType} transcription error:`, err);
            }
          };
        }
      };

      recorder.onstop = () => {
        console.log(`${sourceType} transcription recorder stopped`);
        // Schedule the next recording if we're still connected
        if (
          peerConnectionRef.current &&
          ((sourceType === "client" &&
            remoteStreamRef.current &&
            remoteStreamRef.current.getAudioTracks().length > 0) ||
            (sourceType === "agent" &&
              localStreamRef.current &&
              localStreamRef.current.getAudioTracks().length > 0))
        ) {
          setTimeout(() => {
            if (sourceType === "client" && remoteStreamRef.current) {
              const newRecorder = createAndStartRecorder(
                remoteStreamRef.current,
                sourceType
              );
              if (newRecorder) {
                transcriptionRecorderRef.current.client = newRecorder;
              }
            } else if (sourceType === "agent" && localStreamRef.current) {
              const newRecorder = createAndStartRecorder(
                localStreamRef.current,
                sourceType
              );
              if (newRecorder) {
                transcriptionRecorderRef.current.agent = newRecorder;
              }
            }
          }, 100); // Small delay to prevent overlap
        }
      };

      // Start recording
      recorder.start();
      console.log(`${sourceType} transcription recorder started`);

      // Stop after 25 seconds (increased from 15 to match your new code)
      setTimeout(() => {
        if (recorder && recorder.state === "recording") {
          recorder.stop();
        }
      }, 25000);

      return recorder;
    } catch (e) {
      console.error(`MediaRecorder error for ${sourceType} transcription:`, e);
      toast({
        title: "Transcription Error",
        description: `Failed to start ${sourceType} transcription recording.`,
        variant: "destructive",
      });
      return null;
    }
  };

  // Start full recorder
  const startFullRecorder = () => {
    if (!remoteStreamRef.current || !localStreamRef.current) return;

    console.log("Starting full conversation recorder...");

    try {
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();

      // Add local stream to the mix
      if (
        localStreamRef.current &&
        localStreamRef.current.getAudioTracks().length > 0
      ) {
        const localSource = audioContext.createMediaStreamSource(
          localStreamRef.current
        );
        localSource.connect(destination);
      }

      // Add remote stream to the mix
      if (
        remoteStreamRef.current &&
        remoteStreamRef.current.getAudioTracks().length > 0
      ) {
        const remoteSource = audioContext.createMediaStreamSource(
          remoteStreamRef.current
        );
        remoteSource.connect(destination);
      }

      // Create recorder with the combined destination stream
      const options = { mimeType: "audio/webm" };
      try {
        fullRecorderRef.current = new MediaRecorder(
          destination.stream,
          options
        );
      } catch (e) {
        console.error("MediaRecorder error for full conversation:", e);
        toast({
          title: "Recording Error",
          description: "Failed to start call recording.",
          variant: "destructive",
        });
        return;
      }

      fullChunksRef.current = [];
      // Store the roomId at recording start using the ref
      const recordingRoomId = currentRoomIdRef.current;

      fullRecorderRef.current.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          console.log("Full recording data available, size:", event.data.size);
          fullChunksRef.current.push(event.data);
        }
      };

      fullRecorderRef.current.onstop = () => {
        console.log("Full recorder stopped, processing recording...");
        const fullBlob = new Blob(fullChunksRef.current, {
          type: "audio/webm",
        });
        const reader = new FileReader();
        reader.readAsDataURL(fullBlob);
        reader.onloadend = async () => {
          const base64data = reader.result;
          // Use the API function to save the conversation
          try {
            console.log("Saving full conversation recording...");
            const response = await saveConversation(
              base64data,
              recordingRoomId
            );
            console.log("Full conversation saved:", response);

            if (response.success) {
              toast({
                title: "Recording Saved",
                description: "Call recording has been saved successfully.",
              });
            } else {
              toast({
                title: "Recording Error",
                description: "Failed to save call recording.",
                variant: "destructive",
              });
            }
          } catch (err) {
            console.error("Error saving conversation:", err);
            toast({
              title: "Recording Error",
              description: "Failed to save call recording.",
              variant: "destructive",
            });
          }
        };
      };

      fullRecorderRef.current.start(); // record continuously until the call ends
      console.log("Full conversation recorder started");
    } catch (error) {
      console.error("Error setting up full recorder:", error);
      toast({
        title: "Recording Error",
        description: "Failed to set up call recording.",
        variant: "destructive",
      });
    }
  };

  // Send call data to backend
  const sendCallDataToBackend = async () => {
    // Calculate call duration for sending to backend
    let callDurationSeconds = 0;
    if (callStartTimeRef.current) {
      callDurationSeconds = Math.floor(
        (new Date().getTime() - callStartTimeRef.current.getTime()) / 1000
      );
    }

    // Use the API function to log call data
    try {
      console.log("Sending call data to backend...");
      await logCallData({
        agentUsername: "agent",
        callDuration: callDurationSeconds,
        callStart: callStartTimeRef.current
          ? callStartTimeRef.current.toISOString()
          : null,
        roomId: currentRoomIdRef.current,
      });
    } catch (err) {
      console.error("Error logging call data:", err);
      toast({
        title: "Logging Error",
        description: "Failed to log call data.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <h1 className="text-3xl font-bold tracking-tight">
        Agent Call Interface
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Calling Interface</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Agent Status */}
            <div className="flex items-center justify-between">
              <div>
                <Button
                  onClick={toggleAvailability}
                  variant={isAgentAvailable ? "destructive" : "default"}
                  disabled={isInitializing}
                >
                  {isInitializing
                    ? "Initializing..."
                    : isAgentAvailable
                    ? "Disconnect"
                    : "Connect"}
                </Button>
                <p className="mt-2">
                  <strong>Status:</strong> <span>{statusMessage}</span>
                </p>
              </div>

              {roomId && (
                <div className="text-right">
                  <p>
                    <strong>Room ID:</strong> <span>{roomId}</span>
                  </p>
                  <p>
                    <strong>Call Duration:</strong> <span>{callDuration}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Call Controls - only show when connected */}
            {statusMessage === "Connected" && (
              <div className="flex space-x-4">
                <Button onClick={toggleMute} variant="outline">
                  {isAgentMuted ? "Unmute" : "Mute"}
                </Button>
                <Button onClick={disconnectClient} variant="destructive">
                  Disconnect Caller
                </Button>
                <Button onClick={reportClient} variant="outline">
                  Report
                </Button>
              </div>
            )}

            {/* Transcription */}
            {transcription.length > 0 && (
              <div className="mt-6">
                <h2 className="text-xl font-semibold mb-2">Transcription:</h2>
                <div className="bg-muted p-4 rounded-md h-64 overflow-y-auto">
                  {transcription.map((item, index) => (
                    <p
                      key={index}
                      className={`mb-2 ${
                        item.source === "agent"
                          ? "text-blue-600"
                          : "text-green-600"
                      }`}
                    >
                      <strong>
                        {item.source === "agent" ? "Agent: " : "Client: "}
                      </strong>
                      {item.text}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <audio ref={remoteAudioRef} autoPlay playsInline />
    </div>
  );
}
