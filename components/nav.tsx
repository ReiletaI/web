import Link from "next/link"
import { Button } from "@/components/ui/button"

export function Nav() {
  return (
    <nav className="flex justify-between items-center p-4 bg-gray-100">
      <Link href="/" className="text-lg font-bold">
        Vishing Protection
      </Link>
      <div className="space-x-4">
        <Button asChild variant="ghost">
          <Link href="/upload">Upload</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/admin">Admin</Link>
        </Button>
      </div>
    </nav>
  )
}

