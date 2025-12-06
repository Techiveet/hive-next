import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmailReplyActions, EmailTopToolbar } from "./email-actions-bar";

import { EmailList } from "../_components/email-list";
import { EmailReadListener } from "../_components/email-read-listener";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { getCurrentSession } from "@/lib/auth-server";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ folder?: string }>;
}

export default async function EmailDetailPage(props: PageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const { user } = await getCurrentSession();

  if (!user) redirect("/sign-in");

  const folder = searchParams.folder || "inbox";

  // 1. FETCH LIST DATA
  let listEmails;
  
  if (folder === "sent") {
    listEmails = await prisma.email.findMany({
      where: { senderId: user.id },
      include: { sender: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
  } else if (folder === "all") {
    const [sent, received] = await Promise.all([
      prisma.email.findMany({ 
        where: { senderId: user.id }, 
        include: { sender: { select: { name: true, email: true } } }, 
        orderBy: { createdAt: "desc" } 
      }),
      prisma.emailRecipient.findMany({ 
        where: { userId: user.id }, 
        include: { email: { include: { sender: { select: { name: true, email: true } } } } }, 
        orderBy: { createdAt: "desc" } 
      }),
    ]);
    
    // Deduplicate
    const uniqueMap = new Map();
    [...sent, ...received].forEach((item) => {
      // @ts-ignore
      const id = item.email?.id || item.id;
      if (!uniqueMap.has(id)) uniqueMap.set(id, item);
    });

    listEmails = Array.from(uniqueMap.values()).sort((a, b) => 
      // @ts-ignore
      new Date(b.createdAt || b.email?.createdAt).getTime() - new Date(a.createdAt || a.email?.createdAt).getTime()
    );
  } else {
    // Specific folder (inbox, trash, archive, starred)
    // Note: for starred, we might need a specific query, but for now assuming folder filter handles it if passed
    // If folder == 'starred', we need custom query
    const whereClause: any = { userId: user.id };
    if (folder === 'starred') {
        whereClause.isStarred = true;
    } else {
        whereClause.folder = folder;
    }

    listEmails = await prisma.emailRecipient.findMany({
      where: whereClause,
      include: {
        email: { include: { sender: { select: { name: true, email: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  const formattedList = listEmails.map((e) => {
    // @ts-ignore
    const emailData = e.email || e;
    return {
      id: emailData.id,
      // @ts-ignore
      isRead: e.isRead ?? true,
      // @ts-ignore
      isStarred: e.isStarred ?? false,
      email: {
        id: emailData.id,
        subject: emailData.subject,
        body: emailData.body,
        createdAt: emailData.createdAt,
        sender: emailData.sender,
      },
    };
  });

  // 2. FETCH DETAIL
  const email = await prisma.email.findUnique({
    where: { id: params.id },
    include: {
      sender: { select: { id: true, name: true, email: true, image: true } },
      recipients: { where: { userId: user.id } },
    },
  });

  if (!email) return notFound();

  const isSender = email.senderId === user.id;
  const recipientRecord = email.recipients[0];

  if (!isSender && !recipientRecord) {
    return <div className="flex-1 flex items-center justify-center p-8 text-muted-foreground">Unauthorized.</div>;
  }

  const isRead = isSender ? true : (recipientRecord?.isRead ?? true);
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true } });

  return (
    <>
      <div className="hidden lg:block h-full w-[380px] min-w-0">
        <EmailList
          initialEmails={formattedList}
          currentUserId={user.id}
          folderName={folder}
        />
      </div>

      <div className="flex-1 flex flex-col h-full w-full min-w-0 rounded-xl bg-white shadow-sm border border-slate-200 dark:bg-[#0f172a] dark:border-slate-800 overflow-hidden relative">
        
        {!isSender && <EmailReadListener emailId={email.id} isRead={isRead} />}

        <div className="flex-none">
           <EmailTopToolbar emailId={email.id} />
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 absolute top-[70px] bottom-[80px] left-0 right-0">
          
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-8 break-words">
              {email.subject}
            </h1>
          </div>

          <div className="flex items-start justify-between mb-8">
            <div className="flex gap-4">
              <Avatar className="h-12 w-12 border-0">
                <AvatarImage src={email.sender.image || undefined} />
                <AvatarFallback className="bg-emerald-500 text-white font-bold text-lg">
                  {email.sender.name?.[0]?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-slate-900 dark:text-white">
                    {email.sender.name || "Unknown"}
                  </span>
                  <span className="text-sm text-slate-500">&lt;{email.sender.email}&gt;</span>
                </div>
                <span className="text-sm text-slate-500">to {isSender ? "me" : "me"}</span>
              </div>
            </div>

            <div className="text-right">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-300">
                {format(new Date(email.createdAt), "MMM d, yyyy")}
              </p>
              <p className="text-xs text-slate-500">
                {format(new Date(email.createdAt), "h:mm a")}
              </p>
            </div>
          </div>

          <div className="prose prose-lg dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed">
            <div className="whitespace-pre-wrap font-sans break-words">
              {email.body}
            </div>
          </div>
          
          <Separator className="my-10" />

          <div className="pb-8">
             <EmailReplyActions email={email} users={users} />
          </div>
        </div>
      </div>
    </>
  );
}