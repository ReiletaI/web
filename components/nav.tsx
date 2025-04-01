import Link from "next/link";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import logo from "@/public/logo-nobg.png";

export function Nav() {
  return (
    <nav className="flex justify-between items-center p-4 bg-gray-100">
      <Link href="/" className="text-lg font-bold flex items-center gap-2">
        <Image src={logo} alt="Logo" width={92} height={32} />
      </Link>
      <div className="space-x-4">
        <Button asChild variant="ghost">
          <Link href="/upload">Upload</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/calls">Calls</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/admin">Admin</Link>
        </Button>
      </div>
    </nav>
  );
}
