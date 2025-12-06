"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PenSquare, PlusCircle, Save } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveDraftAction, sendEmailAction } from "../email-actions";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type ComposeProps = {
  users: any[];
  // ✅ Allow passing a custom trigger (or null to hide default button)
  trigger?: React.ReactNode; 
  defaultValues?: {
    toId?: string;
    subject?: string;
    body?: string;
  };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function ComposeDialog({ users, trigger, defaultValues, open: controlledOpen, onOpenChange }: ComposeProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [isPending, startTransition] = useTransition();
  const [hasMounted, setHasMounted] = useState(false);

  const [toId, setToId] = useState(defaultValues?.toId || "");
  const [subject, setSubject] = useState(defaultValues?.subject || "");
  const [body, setBody] = useState(defaultValues?.body || "");

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (defaultValues) {
        if(defaultValues.toId) setToId(defaultValues.toId);
        if(defaultValues.subject) setSubject(defaultValues.subject);
        if(defaultValues.body) setBody(defaultValues.body);
    }
  }, [defaultValues, isOpen]); // Reset when opening

  const handleSend = () => {
    if (!toId || !subject) return toast.error("Recipient and Subject are required");
    startTransition(async () => {
      const res = await sendEmailAction({ toIds: [toId], subject, body });
      if (res.success) {
        toast.success("Email sent!");
        setOpen(false);
        setSubject("");
        setBody("");
        setToId("");
      }
    });
  };

  const handleSaveDraft = () => {
    if (!subject) return toast.error("Subject is required to save draft");
    startTransition(async () => {
      await saveDraftAction({ toIds: [toId], subject, body });
      toast.success("Draft saved");
      setOpen(false);
    });
  };

  if (!hasMounted) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {/* ✅ Only render trigger if NOT controlled or if trigger prop is passed */}
      {trigger !== undefined ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button className="w-full justify-center gap-2 h-11 bg-emerald-500 hover:bg-emerald-600 text-white shadow-md font-medium text-base rounded-lg">
            <PlusCircle className="h-5 w-5" /> Compose Mail
          </Button>
        </DialogTrigger>
      )}
      
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
             {defaultValues?.subject?.startsWith("Re:") ? "Reply" : defaultValues?.subject?.startsWith("Fwd:") ? "Forward" : "New Message"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <Select onValueChange={setToId} value={toId}>
              <SelectTrigger>
                <SelectValue placeholder="To: Select Recipient" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input 
            placeholder="Subject" 
            value={subject} 
            onChange={(e) => setSubject(e.target.value)} 
          />
          <Textarea 
            placeholder="Write your message..." 
            className="min-h-[200px]" 
            value={body} 
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex justify-between items-center">
            <Button variant="outline" onClick={handleSaveDraft} disabled={isPending} className="gap-2">
                <Save className="h-4 w-4" /> Save Draft
            </Button>

            <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleSend} disabled={isPending} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                    {isPending ? "Sending..." : "Send Message"}
                </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}