import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-4xl font-bold mb-8">Vishing Protection Tool</h1>
      <div className="space-x-4">
        <Button asChild>
          <Link href="/upload">Upload Voice File</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin">Admin Dashboard</Link>
        </Button>
      </div>
    </div>
  )
}

