// app/(dashboard)/email/_components/compose-dialog.tsx
"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Lock, Plus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import React, { useEffect, useMemo, useState, useTransition } from "react";
import {
  RichEditorUploadedFile,
  RichTextEditor,
} from "@/components/ui/rich-text-editor";
import {
  getPublicKeysAction,
  getSenderPublicKeyAction,
} from "../encryption-actions";
import {
  saveDraftAction,
  sendEmailAction,
  updateDraftAction,
} from "../email-actions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pgpEncrypt } from "@/lib/pgp-utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// -----------------------------------------------------------------------------
// RECIPIENT INPUT COMPONENT
// -----------------------------------------------------------------------------
function RecipientInput({
  label,
  users,
  selectedIds,
  onChange,
}: {
  label: string;
  users: any[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = React.useState(false);

  const availableUsers = users.filter((u: any) => !selectedIds.includes(u.id));

  const addRecipient = (id: string) => {
    onChange([...selectedIds, id]);
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
        <span className="text-sm font-medium w-10 text-slate-500 dark:text-slate-400 pt-1.5">
          {label}:
        </span>

        <div className="flex flex-wrap gap-1 flex-1">
          {selectedIds.map((id) => {
            const user = users.find((u: any) => u.id === id);
            return (
              <Badge
                key={id}
                variant="secondary"
                className="flex items-center gap-1 font-normal pr-1"
              >
                {user?.name || user?.email}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(selectedIds.filter((x) => x !== id));
                  }}
                  className="ml-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 p-0.5 transition-colors"
                >
                  <X className="h-3 w-3 text-slate-500 hover:text-red-500" />
                </button>
              </Badge>
            );
          })}

          {/* ✅ Searchable "Add recipient" */}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="
                  h-7 px-2 rounded-md text-sm
                  border border-slate-200 dark:border-slate-700
                  bg-white dark:bg-slate-900
                  text-slate-700 dark:text-slate-200
                  hover:bg-slate-50 dark:hover:bg-slate-800
                  inline-flex items-center gap-1
                "
              >
                + Add recipient <ChevronsUpDown className="h-3.5 w-3.5 opacity-70" />
              </button>
            </PopoverTrigger>

            <PopoverContent className="p-0 w-[320px]">
              <Command>
                <CommandInput placeholder="Search user..." />
                <CommandList className="max-h-64">
                  <CommandEmpty>No user found.</CommandEmpty>

                  <CommandGroup>
                    {availableUsers.map((u: any) => {
                      const label = `${u.name ?? ""} (${u.email})`.trim();
                      return (
                        <CommandItem
                          key={u.id}
                          value={label}
                          onSelect={() => addRecipient(u.id)}
                          className="flex items-center justify-between"
                        >
                          <span className="truncate">{label}</span>
                          <Check className="h-4 w-4 opacity-0" />
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------
type ComposeAttachment = {
  id: string; // ✅ fileId
  type: "IMAGE" | "VIDEO" | "FILE";
  url: string;
  name: string;
  mimeType?: string | null;
};

type ComposeDialogProps = {
  users: any[];
  trigger?: React.ReactNode | null;
  defaultValues?: {
    toIds?: string[];
    toId?: string;
    ccIds?: string[];
    bccIds?: string[];
    subject?: string;
    body?: string;
    attachments?: ComposeAttachment[];
  };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type ImageEditorState = {
  src: string;
  alt: string;
};

export function ComposeDialog({
  users,
  trigger,
  defaultValues,
  open,
  onOpenChange,
}: ComposeDialogProps) {
  const router = useRouter();

  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [isPending, startTransition] = useTransition();

  // ✅ Draft Edit Mode
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);

  // Form State
  const [toIds, setToIds] = useState<string[]>([]);
  const [ccIds, setCcIds] = useState<string[]>([]);
  const [bccIds, setBccIds] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);

  // Encryption State
  const [isE2EE, setIsE2EE] = useState(false);
  const [recipientPublicKeys, setRecipientPublicKeys] = useState<{
    [key: string]: string;
  }>({});

  // Attachments & Image Editor
  const [attachments, setAttachments] = useState<ComposeAttachment[]>([]);
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [imageEditorState, setImageEditorState] =
    useState<ImageEditorState | null>(null);
  const [imageEditorEditor, setImageEditorEditor] = useState<any>(null);

  // --- Helpers ---
  const registerAttachment = (
    file: RichEditorUploadedFile,
    kind: ComposeAttachment["type"]
  ) => {
    if (!file.id) return;
    setAttachments((prev) => {
      if (prev.some((a) => a.id === file.id)) return prev;
      return [
        ...prev,
        {
          id: file.id,
          url: file.url,
          name: file.name,
          mimeType: file.mimeType ?? null,
          type: kind,
        },
      ];
    });
  };

  const allRecipientIds = useMemo(() => {
    return Array.from(new Set([...toIds, ...ccIds, ...bccIds]));
  }, [toIds, ccIds, bccIds]);

  // ✅ Load draft into composer
  const loadDraftIntoComposer = async (draftId: string) => {
    const res = await fetch(`/api/emails/drafts/${draftId}`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok || !json?.data)
      throw new Error(json?.error || "Failed to load draft");

    const d = json.data;

    setEditingDraftId(draftId);

    // If you don't store recipients in draft schema, keep empty (or adapt later)
    setToIds(d.toIds ?? []);
    setCcIds(d.ccIds ?? []);
    setBccIds(d.bccIds ?? []);
    setShowCcBcc(!!((d.ccIds?.length || 0) + (d.bccIds?.length || 0)));

    setSubject(d.subject ?? "");
    setBody(d.body ?? "");

    setAttachments(
      (d.attachments ?? [])
        .filter((a: any) => a?.id)
        .map((a: any) => ({
          id: a.id, // ✅ fileId
          url: a.url || "",
          name: a.name || "Attachment",
          mimeType: a.mimeType ?? null,
          type: a.type || "FILE",
        }))
    );

    // Reset encryption calc on open
    setIsE2EE(false);
    setRecipientPublicKeys({});
  };

  // --- Effects ---
  useEffect(() => {
    if (allRecipientIds.length === 0) {
      setRecipientPublicKeys({});
      setIsE2EE(false);
      return;
    }

    getPublicKeysAction(allRecipientIds).then((results) => {
      const keyMap = results.reduce(
        (acc, user) => {
          if (user.pgpPublicKey) {
            acc[user.id] = user.pgpPublicKey;
          }
          return acc;
        },
        {} as { [key: string]: string }
      );

      setRecipientPublicKeys(keyMap);
      const allHaveKeys = allRecipientIds.every((id) => keyMap[id]);
      setIsE2EE(allHaveKeys);
    });
  }, [allRecipientIds]);

  // ✅ Listen for Draft click event from email-list
  useEffect(() => {
    const handler = async (e: any) => {
      try {
        const draftId = e?.detail?.draftId;
        if (!draftId) return;

        setOpen(true);
        await loadDraftIntoComposer(draftId);
      } catch (err: any) {
        console.error(err);
        toast.error(err?.message || "Failed to open draft");
      }
    };

    window.addEventListener("open-draft-compose", handler);
    return () => window.removeEventListener("open-draft-compose", handler);
  }, [setOpen]);

  // Normal open (Compose button / defaultValues)
  useEffect(() => {
    if (!isOpen) return;

    const initialToIds =
      defaultValues?.toIds ?? (defaultValues?.toId ? [defaultValues.toId] : []);

    // If opened normally (not via draft event), clear draft edit mode
    if (!defaultValues && !editingDraftId) {
      setEditingDraftId(null);
    }

    // Only apply defaultValues when provided
    if (defaultValues) {
      setToIds(initialToIds ?? []);
      setCcIds(defaultValues?.ccIds ?? []);
      setBccIds(defaultValues?.bccIds ?? []);
      setSubject(defaultValues?.subject ?? "");
      setBody(defaultValues?.body ?? "");
      setShowCcBcc(
        !!(defaultValues?.ccIds?.length || defaultValues?.bccIds?.length)
      );
      setAttachments(defaultValues?.attachments ?? []);
    } else if (!editingDraftId) {
      // brand new compose
      setToIds([]);
      setCcIds([]);
      setBccIds([]);
      setSubject("");
      setBody("");
      setShowCcBcc(false);
      setAttachments([]);
    }

    setIsE2EE(false);
    setRecipientPublicKeys({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues, isOpen]);

  const resetForm = () => {
    setEditingDraftId(null);
    setToIds([]);
    setCcIds([]);
    setBccIds([]);
    setSubject("");
    setBody("");
    setShowCcBcc(false);
    setAttachments([]);
    setIsE2EE(false);
    setRecipientPublicKeys({});
  };

  // --- Handlers ---
  const handleSend = async () => {
    if (toIds.length === 0) return toast.error("Add at least one recipient");
    if (!subject.trim()) return toast.error("Subject is required");

    let finalBody = body;
    let finalSubject = subject;
    let encryptionStatus = isE2EE;

    if (isE2EE) {
      const recipientKeys = allRecipientIds
        .map((id) => recipientPublicKeys[id])
        .filter(Boolean);

      const senderKeyResult = await getSenderPublicKeyAction();
      const senderPublicKey = senderKeyResult?.publicKey;

      if (!senderPublicKey) {
        toast.warning(
          "Sender's key missing. Encryption skipped to prevent lock out of 'Sent' folder."
        );
        encryptionStatus = false;
      }

      const allKeysToEncryptFor = [
        ...(senderPublicKey ? [senderPublicKey] : []),
        ...recipientKeys,
      ];

      if (allKeysToEncryptFor.length === 0 || !encryptionStatus) {
        encryptionStatus = false;
      }

      if (encryptionStatus) {
        try {
          const encryptedBody = await pgpEncrypt(body, allKeysToEncryptFor);
          const encryptedSubject = await pgpEncrypt(
            subject,
            allKeysToEncryptFor
          );

          finalBody = btoa(encryptedBody);
          finalSubject = btoa(encryptedSubject);
          toast.success("Message encrypted successfully!");
        } catch (error) {
          console.error("Encryption Error:", error);
          toast.warning("Encryption failed. Sending unencrypted.");
          finalBody = body;
          finalSubject = subject;
          encryptionStatus = false;
        }
      }
    }

    startTransition(async () => {
      await sendEmailAction({
        toIds,
        ccIds,
        bccIds,
        subject: finalSubject,
        body: finalBody,
        fileIds: attachments.map((a) => a.id),
        isE2EE: encryptionStatus,
        draftId: editingDraftId ?? undefined, // ✅ optional cleanup on send
      });

      toast.success("Sent!");
      setOpen(false);

      router.refresh();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("refresh-sidebar-counts"));
      }

      resetForm();
    });
  };

  const handleSaveDraft = async () => {
    if (
      !subject.trim() &&
      !body.trim() &&
      toIds.length === 0 &&
      ccIds.length === 0 &&
      bccIds.length === 0 &&
      attachments.length === 0
    ) {
      setOpen(false);
      return;
    }

    startTransition(async () => {
      if (editingDraftId) {
        await updateDraftAction({
          id: editingDraftId,
          toIds,
          ccIds,
          bccIds,
          subject,
          body,
          fileIds: attachments.map((a) => a.id),
        });
        toast.success("Draft updated");
      } else {
        const res = await saveDraftAction({
          toIds,
          ccIds,
          bccIds,
          subject,
          body,
          fileIds: attachments.map((a) => a.id),
        });

        // If you want to keep editing the same newly created draft after Save:
        // setEditingDraftId(res?.id ?? null);

        toast.success("Draft saved");
      }

      setOpen(false);

      router.refresh();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("refresh-sidebar-counts"));
      }

      resetForm();
    });
  };

  // Image Editor Handlers
  const handleInsertImage = (editorInstance: any) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("open-file-manager", {
        detail: {
          filter: "images",
          onSelect: (file: RichEditorUploadedFile) => {
            editorInstance.chain().focus().setImage({ src: file.url }).run();
            registerAttachment(file, "IMAGE");
          },
        },
      })
    );
  };

  const handleEditImageClick = (
    editorInstance: any,
    attrs: { src?: string; alt?: string } | null
  ) => {
    if (!attrs?.src) return;
    setImageEditorEditor(editorInstance);
    setImageEditorState({
      src: attrs.src,
      alt: attrs.alt ?? "",
    });
    setImageEditorOpen(true);
  };

  const applyImageEdits = () => {
    if (!imageEditorEditor || !imageEditorState) return;
    imageEditorEditor
      .chain()
      .focus()
      .updateAttributes("image", {
        src: imageEditorState.src,
        alt: imageEditorState.alt,
      })
      .run();
    setImageEditorOpen(false);
  };

  const removeImage = () => {
    if (!imageEditorEditor) return;
    imageEditorEditor.chain().focus().deleteSelection().run();
    setImageEditorOpen(false);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      {trigger === undefined && (
        <DialogTrigger asChild>
          <Button className="w-full justify-center gap-2 h-11 bg-emerald-500 hover:bg-emerald-600 text-white shadow-md font-medium text-base rounded-lg transition-all">
            <Plus className="h-5 w-5" /> Compose
          </Button>
        </DialogTrigger>
      )}

      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent
        className="
          max-w-none w-[90vw] h-[90vh]
          p-0 gap-0
          bg-white dark:bg-slate-900
          border-slate-200 dark:border-slate-800
          overflow-hidden flex flex-col
        "
        style={{ maxWidth: "90vw" }}
      >
        <DialogHeader className="px-5 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800">
          <DialogTitle className="text-slate-900 dark:text-slate-100 text-sm font-semibold">
            {editingDraftId ? "Edit Draft" : "New Message"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-none px-5 pt-3 pb-2 space-y-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
            <RecipientInput
              label="To"
              users={users}
              selectedIds={toIds}
              onChange={setToIds}
            />

            <div className="flex justify-end -mt-2">
              {!showCcBcc && (
                <button
                  type="button"
                  onClick={() => setShowCcBcc(true)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Show CC/BCC
                </button>
              )}
            </div>

            {showCcBcc && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
                <RecipientInput
                  label="Cc"
                  users={users}
                  selectedIds={ccIds}
                  onChange={setCcIds}
                />
                <RecipientInput
                  label="Bcc"
                  users={users}
                  selectedIds={bccIds}
                  onChange={setBccIds}
                />
              </div>
            )}

            <Input
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="border-0 border-b border-slate-100 dark:border-slate-800 rounded-none px-0 focus-visible:ring-0 text-lg font-medium bg-transparent"
            />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3 bg-slate-50/20 dark:bg-slate-900/20">
            {isE2EE && (
              <div className="text-sm text-yellow-600 dark:text-yellow-400 mb-2 border-y border-yellow-200 dark:border-yellow-800 py-1 px-2 bg-yellow-50 dark:bg-yellow-950/50">
                E2EE Active: The message content will be encrypted before
                sending. Attachments are NOT encrypted.
              </div>
            )}

            <RichTextEditor
              value={body}
              onChange={setBody}
              placeholder="Type your message here... (Try typing '@' to mention someone)"
              mentionUsers={users}
              minHeight="220px"
              onImageButtonClick={handleInsertImage}
              onEditImageClick={handleEditImageClick}
              onAttachFile={(file, kind) => registerAttachment(file, kind)}
            />
          </div>

          <div className="flex-none px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2 bg-slate-50/60 dark:bg-slate-900/60">
            <div className="flex items-center justify-between">
              {isE2EE ? (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Lock className="w-3 h-3 fill-emerald-600 dark:fill-emerald-400" />
                  End-to-End Encryption (PGP) is Active
                </span>
              ) : (
                <span className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-red-500 dark:text-red-400" />
                  Encryption Disabled (Missing keys for one or more recipients)
                </span>
              )}
            </div>

            {attachments.length > 0 && (
              <div className="text-[11px] text-slate-500 flex items-center justify-between">
                <span>
                  {attachments.length} attachment
                  {attachments.length > 1 && "s"} will be sent
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveDraft}
                disabled={isPending}
                className="w-28"
              >
                {isPending
                  ? editingDraftId
                    ? "Updating..."
                    : "Saving..."
                  : editingDraftId
                    ? "Update draft"
                    : "Save draft"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Discard
              </Button>

              <Button
                type="button"
                onClick={handleSend}
                disabled={isPending}
                className="bg-emerald-600 hover:bg-emerald-700 w-24 text-white"
              >
                {isPending ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        </div>

        {/* Image Editor Modal */}
        {imageEditorOpen && imageEditorState && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-card text-card-foreground rounded-lg shadow-xl p-4 max-w-xl w-full">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">Edit image</h2>
                <button
                  type="button"
                  onClick={() => setImageEditorOpen(false)}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Close
                </button>
              </div>
              <div className="max-h-[320px] overflow-auto border rounded-md mb-4 bg-black/5 dark:bg-white/5 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageEditorState.src}
                  alt={imageEditorState.alt}
                  className="block max-w-full h-auto mx-auto rounded-md"
                />
              </div>
              <div className="space-y-2 mb-4">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Alt text (for accessibility)
                </label>
                <Input
                  value={imageEditorState.alt}
                  onChange={(e) =>
                    setImageEditorState((prev) =>
                      prev ? { ...prev, alt: e.target.value } : prev
                    )
                  }
                  placeholder="Describe the image"
                  className="text-sm"
                />
              </div>
              <div className="flex justify-between items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={removeImage}
                >
                  Remove image
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => setImageEditorOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" type="button" onClick={applyImageEdits}>
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
