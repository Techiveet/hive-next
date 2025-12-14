"use client";

import {
  ArrowLeft,
  CornerUpLeft,
  CornerUpRight,
  MoreVertical,
  Printer,
  Trash2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { deleteEmailsAction } from "../email-actions";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// Types matching what we pass from the server page
interface Attachment {
  id: string;
  name: string;
  url: string;
  size: number | null;
  mimeType: string | null;
  type: "IMAGE" | "VIDEO" | "FILE";
}

interface EmailData {
  id: string;
  recipientId: string; // The ID used for deletion (either email ID or recipient ID)
  subject: string;
  body: string;
  createdAt: Date | string;
  folder: string;
  sender: {
    name: string | null;
    email: string;
    image?: string | null;
  };
  recipients: {
    user: { name: string | null; email: string };
  }[];
  attachments: Attachment[];
  type?: "sent" | "received";
}

interface EmailDetailProps {
  email: EmailData;
  currentUserId: string;
  backLink: string; // URL to go back to (preserves folder/search params)
}

export function EmailDetail({ email, currentUserId, backLink }: EmailDetailProps) {
  const router = useRouter();

  const handleDelete = async () => {
    try {
      // Determine correct folder context for deletion
      const folderContext = email.type === "sent" ? "sent" : email.folder;
      
      const result = await deleteEmailsAction([email.recipientId], folderContext);
      
      if (result.success) {
        toast.success("Email moved to trash");
        router.push(backLink); // Go back to list
        router.refresh();      // Refresh list data
      }
    } catch (error) {
      toast.error("Failed to delete email");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      
      {/* --- Toolbar --- */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          {/* Back Button (Visible on Mobile/Tablet) */}
          <Link href={backLink} className="lg:hidden">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-slate-500 hover:text-slate-700"
            onClick={handlePrint}
            title="Print"
          >
            <Printer className="h-4 w-4" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            onClick={handleDelete}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(email.body)}>
                Copy Body
              </DropdownMenuItem>
              <DropdownMenuItem>Mark as Unread</DropdownMenuItem>
              <DropdownMenuItem className="text-red-600">Report Spam</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* --- Scrollable Content Area --- */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        
        {/* Header: Subject & Tags */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            {email.subject}
          </h1>
          <div className="flex flex-wrap gap-2">
             {/* You can map labels/tags here if you have them */}
          </div>
        </div>

        {/* Sender Info */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border border-slate-200 dark:border-slate-700">
              <AvatarImage src={email.sender.image || undefined} />
              <AvatarFallback className="bg-emerald-100 text-emerald-700 font-bold">
                {email.sender.name?.[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {email.sender.name || email.sender.email}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  &lt;{email.sender.email}&gt;
                </span>
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                to {email.recipients.map(r => r.user.name || "me").join(", ")}
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {format(new Date(email.createdAt), "MMM d, yyyy")}
            </div>
            <div className="text-xs text-slate-500">
              {format(new Date(email.createdAt), "h:mm a")}
            </div>
          </div>
        </div>

        {/* Email Body */}
        <div className="prose prose-slate dark:prose-invert max-w-none mb-8">
          <div dangerouslySetInnerHTML={{ __html: email.body }} />
        </div>

        {/* Attachments */}
        {email.attachments.length > 0 && (
          <div className="mb-8 border-t border-slate-100 dark:border-slate-800 pt-4">
            <h4 className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-300">
              {email.attachments.length} Attachment{email.attachments.length > 1 ? 's' : ''}
            </h4>
            <div className="flex flex-wrap gap-3">
              {email.attachments.map((att) => (
                <a
                  key={att.id}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors min-w-[200px]"
                >
                  <div className="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center text-xs font-bold uppercase text-slate-500 group-hover:bg-white group-hover:shadow-sm transition-all">
                    {att.mimeType?.split('/')[1] || "FILE"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate text-slate-700 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                      {att.name}
                    </div>
                    {att.size && (
                      <div className="text-xs text-slate-500">
                        {(att.size / 1024).toFixed(1)} KB
                      </div>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Reply Actions */}
        <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" className="gap-2">
            <CornerUpLeft className="h-4 w-4" /> Reply
          </Button>
          <Button variant="outline" className="gap-2">
            <CornerUpRight className="h-4 w-4" /> Forward
          </Button>
        </div>
      </div>
    </div>
  );
}