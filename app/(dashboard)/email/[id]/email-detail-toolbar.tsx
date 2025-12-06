"use client";

import { ArrowLeft, Reply, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function EmailDetailToolbar() {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between border-b p-4 bg-background/95 backdrop-blur sticky top-0 z-10">
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => router.back()} 
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> 
          Back
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" title="Reply">
          <Reply className="h-4 w-4 text-muted-foreground" />
        </Button>
        <Button variant="ghost" size="icon" title="Delete">
          <Trash2 className="h-4 w-4 text-red-500/70 hover:text-red-600" />
        </Button>
      </div>
    </div>
  );
}