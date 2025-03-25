import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PhoneCall, Upload, BarChart3 } from "lucide-react"

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-4xl font-bold mb-4">Vishing Protection Tool</h1>
      <p className="text-xl text-center mb-8 max-w-2xl">
        Protect against voice phishing threats with real-time call analysis and detection
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Button asChild size="lg" className="flex items-center gap-2">
          <Link href="/calls">
            <PhoneCall className="h-5 w-5" />
            Make/Join Call
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="flex items-center gap-2">
          <Link href="/upload">
            <Upload className="h-5 w-5" />
            Upload Voice File
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="flex items-center gap-2">
          <Link href="/admin">
            <BarChart3 className="h-5 w-5" />
            Admin Dashboard
          </Link>
        </Button>
      </div>
    </div>
  )
}

