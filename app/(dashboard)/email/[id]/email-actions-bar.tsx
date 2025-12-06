"use client";

import { ArrowLeft, CornerUpLeft, Forward, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ComposeDialog } from "./../_components/compose-dialog";
import { deleteEmailsAction } from "./../email-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function EmailTopToolbar({ emailId }: { emailId: string }) {
  const router = useRouter();

  const handleDelete = async () => {
    await deleteEmailsAction([emailId], "inbox");
    toast.success("Email moved to trash");
    router.push("/email");
  };

  return (
    <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800 bg-background/95 backdrop-blur sticky top-0 z-10">
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => router.back()} 
        className="gap-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 pl-0 hover:bg-transparent"
      >
        <ArrowLeft className="h-5 w-5" /> 
        <span className="text-base font-medium">Back</span>
      </Button>

      <div className="flex gap-1">
        <Button variant="ghost" size="icon" onClick={handleDelete} className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

export function EmailReplyActions({ email, users }: { email: any, users: any[] }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);

  return (
    <>
      <div className="flex gap-3">
        <Button 
          onClick={() => setReplyOpen(true)}
          className="h-10 gap-2 bg-emerald-500 px-6 text-white hover:bg-emerald-600 shadow-sm"
        >
          <CornerUpLeft className="h-4 w-4" /> Reply
        </Button>
        
        <Button 
          variant="outline" 
          onClick={() => setForwardOpen(true)}
          className="h-10 gap-2 border-slate-700 bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
        >
          <Forward className="h-4 w-4" /> Forward
        </Button>
      </div>

      <ComposeDialog 
        users={users} 
        open={replyOpen} 
        onOpenChange={setReplyOpen}
        trigger={null} 
        defaultValues={{
            toId: email.senderId,
            subject: `Re: ${email.subject}`,
            body: `\n\n> On ${new Date(email.createdAt).toLocaleString()}, ${email.sender.name} wrote:\n> ${email.body}`
        }}
      />

      <ComposeDialog 
        users={users} 
        open={forwardOpen} 
        onOpenChange={setForwardOpen}
        trigger={null} 
        defaultValues={{
            subject: `Fwd: ${email.subject}`,
            body: `\n\n---------- Forwarded message ---------\nFrom: ${email.sender.name} <${email.sender.email}>\nDate: ${new Date(email.createdAt).toLocaleString()}\nSubject: ${email.subject}\n\n${email.body}`
        }}
      />
    </>
  );
}