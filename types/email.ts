// Core email types
export interface User {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
}

export interface EmailAttachment {
  id: string;
  type: "IMAGE" | "VIDEO" | "FILE";
  url: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
}

export interface EmailRecipient {
  id: string;
  userId: string;
  emailId: string;
  folder: string;
  isRead: boolean;
  isStarred: boolean;
  type: "TO" | "CC" | "BCC";
  createdAt: Date;
  user: User;
}

export interface Email {
  id: string;
  subject: string;
  body: string;
  senderId: string;
  isStarred: boolean;
  senderFolder: string;
  isE2EE: boolean;
  createdAt: Date;
  updatedAt: Date;
  sender: User;
  attachments: {
    id: string;
    file: {
      id: string;
      url: string;
      name: string;
      mimeType: string | null;
      size: number | null;
    };
  }[];
  recipients: EmailRecipient[];
}

export interface EmailListItem {
  id: string;
  isRead?: boolean;
  isStarred?: boolean;
  email: Omit<Email, 'recipients'> & {
    recipients: Pick<EmailRecipient, 'user'>[];
  };
}

// Server action response types
export interface SendEmailData {
  toIds: string[];
  ccIds: string[];
  bccIds: string[];
  subject: string;
  body: string;
  fileIds?: string[];
  isE2EE?: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  hasNextPage: boolean;
  totalCount: number;
}

// Folder counts
export interface FolderCounts {
  all: number;
  inbox: number;
  sent: number;
  drafts: number;
  trash: number;
  starred: number;
  archive: number;
}

// Socket event types
export interface SocketEmailEvent {
  type: 'new-email' | 'email-sent' | 'email-deleted' | 'email-read';
  data: {
    id: string;
    senderId?: string;
    senderName?: string;
    subject?: string;
    preview?: string;
    createdAt?: Date;
  };
}