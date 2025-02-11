"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const { toast } = useToast()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!file) {
      toast({
        title: "Error",
        description: "Please select a file to upload.",
        variant: "destructive",
      })
      return
    }

    // TODO: Implement actual file upload to API
    console.log("Uploading file:", file.name)

    toast({
      title: "Success",
      description: "File uploaded successfully.",
    })
  }

  return (
    <div className="container mx-auto mt-10">
      <h1 className="text-2xl font-bold mb-4">Upload Voice File</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input type="file" onChange={handleFileChange} accept="audio/*" />
        <Button type="submit">Upload and Analyze</Button>
      </form>
    </div>
  )
}

