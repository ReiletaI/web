"use client"

import { useEffect, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getRecentDetections, type CallAnalysis } from "@/lib/api"
import { Phone, PhoneForwarded } from "lucide-react"

export function RecentDetections() {
  const [recentDetections, setRecentDetections] = useState<CallAnalysis[]>([])

  useEffect(() => {
    getRecentDetections().then(setRecentDetections)
  }, [])

  return (
    <div className="space-y-8">
      {recentDetections.map((detection) => (
        <div key={detection.id} className="flex items-center">
          <Avatar className="h-9 w-9">
            <AvatarImage src={`/avatars/${detection.id}.png`} alt="Avatar" />
            <AvatarFallback>{detection.fileName.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="ml-4 space-y-1 flex-grow">
            <p className="text-sm font-medium leading-none">{detection.fileName}</p>
            <p className="text-sm text-muted-foreground">{new Date(detection.dateAnalyzed).toLocaleDateString()}</p>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />
              <span>{detection.callerNumber}</span>
              <PhoneForwarded className="h-3 w-3 ml-2" />
              <span>{detection.recipientNumber}</span>
            </div>
          </div>
          <div className="ml-auto font-medium text-right">
            <p>
              {detection.status === "verified" && "Verified Threat"}
              {detection.status === "pending" && "Pending Verification"}
              {detection.status === "false_positive" && "False Positive"}
            </p>
            <p
              className={`text-xs mt-1 ${
                detection.threatLevel === "high"
                  ? "text-red-500"
                  : detection.threatLevel === "medium"
                    ? "text-yellow-500"
                    : "text-green-500"
              }`}
            >
              {detection.threatLevel.charAt(0).toUpperCase() + detection.threatLevel.slice(1)} Threat
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

