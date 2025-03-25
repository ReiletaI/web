import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PhoneCall, Headset } from "lucide-react"

export default function CallsPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <h1 className="text-3xl font-bold tracking-tight">Vishing Protection - Call Interface</h1>
      <p className="text-muted-foreground">Choose your role to start or join a call session</p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Headset className="h-5 w-5" />
              Support Agent
            </CardTitle>
            <CardDescription>Handle incoming calls and monitor for vishing attempts</CardDescription>
          </CardHeader>
          <CardContent>
            <p>As a support agent, you'll be able to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Create call rooms for clients to join</li>
              <li>View real-time transcriptions of caller audio</li>
              <li>Report suspicious calls for further analysis</li>
              <li>Disconnect callers when needed</li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/calls/agent">Enter Agent Interface</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5" />
              Client
            </CardTitle>
            <CardDescription>Connect to a support agent via WebRTC</CardDescription>
          </CardHeader>
          <CardContent>
            <p>As a client, you'll be able to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Join a specific call room with a room ID</li>
              <li>Connect to any available support agent</li>
              <li>Communicate via real-time audio</li>
              <li>End the call at any time</li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" className="w-full">
              <Link href="/calls/client">Enter Client Interface</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

