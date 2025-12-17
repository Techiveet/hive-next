"use client";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Edit3,
  FileJson,
  Languages,
  MoreHorizontal,
  Plus,
  Save,
  Search,
  Star,
  Trash2,
  UploadCloud,
  X
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  addMasterKeyAction,
  createLanguageAction,
  deleteLanguageAction,
  importLanguageAction,
  publishAllLanguagesAction,
  setLanguageAsDefaultAction,
  updateTranslationAction,
} from "./language-actions";
import { useRef, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Language = {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
  translations: any;
};

export function LanguageManager({ languages }: { languages: Language[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");

  const [selectedLang, setSelectedLang] = useState<Language | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const [showAddKey, setShowAddKey] = useState(false);
  const [keyGroup, setKeyGroup] = useState("");
  const [keyName, setKeyName] = useState("");
  const [keyValue, setKeyValue] = useState("");

  // Source Language Logic
  const sourceLang =
    languages.find((l) => l.isDefault) ||
    languages.find((l) => l.code === "en") ||
    languages[0];

  const sourceKeys = sourceLang
    ? (sourceLang.translations as Record<string, string>)
    : {};

  // --- Handlers ---

  const handleCreateLanguage = () => {
    if (!newCode || !newName) return toast.error("Fields required");
    startTransition(async () => {
      try {
        await createLanguageAction(newCode, newName);
        toast.success("Language created");
        setIsCreateOpen(false);
        setNewCode("");
        setNewName("");
        router.refresh();
      } catch (e: any) {
        toast.error(e.message);
      }
    });
  };

  const handleOpenTranslate = (lang: Language) => {
    setSelectedLang(lang);
    setEditValues({ ...(lang.translations as Record<string, string>) });
    setShowAddKey(false);
  };

  const handleSaveSingleKey = (key: string) => {
    if (!selectedLang) return;
    const value = editValues[key];
    if (value === undefined) return; 

    startTransition(async () => {
      try {
        await updateTranslationAction(selectedLang.id, { [key]: value });
        toast.success("Key saved");
        router.refresh();
      } catch (e) {
        toast.error("Failed to save");
      }
    });
  };

  const handleSaveAll = () => {
      if(!selectedLang) return;
      startTransition(async () => {
          await updateTranslationAction(selectedLang.id, editValues);
          toast.success("Translations published");
          setSelectedLang(null); 
          router.refresh();
      })
  }

  const handlePublishAll = () => {
    startTransition(async () => {
        await publishAllLanguagesAction();
        toast.success("All languages exported to JSON files");
    });
  };

  const handleAddKeyAction = () => {
    if (!keyName || !keyValue) return toast.error("Key and Value required");
    startTransition(async () => {
      await addMasterKeyAction(keyGroup, keyName, keyValue);
      toast.success("Key added to system");
      setKeyGroup("");
      setKeyName("");
      setKeyValue("");
      // Don't close modal, just refresh so user can see it
      router.refresh();
    });
  };

  const handleExport = (lang: Language) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(lang.translations, null, 2));
    const node = document.createElement('a');
    node.setAttribute("href", dataStr);
    node.setAttribute("download", `${lang.code}.json`);
    document.body.appendChild(node);
    node.click();
    node.remove();
    toast.success(`Downloaded ${lang.code}.json`);
  };

  const triggerImport = (lang: Language) => {
    // We use the ref to store which language ID we are importing into, 
    // but since ref changes don't trigger render, we need to know which ID 
    // when the onChange event fires. We can use a temp state variable or just careful closure.
    // A simple way: set it in a data attribute on the input? No. 
    // Let's just use a state for "importingLangId"
    // BUT actually, we can just set selectedLang temporarily even if we don't show the modal.
    // Or simpler: just click the input, and in onChange find the lang from a closure if we render inputs per row? 
    // Better: Use the single hidden input and track ID in a ref or state.
    
    // Let's use a hack: store the ID on the input element itself
    if (fileInputRef.current) {
        fileInputRef.current.setAttribute("data-lang-id", lang.id);
        fileInputRef.current.setAttribute("data-lang-name", lang.name);
        fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const langId = e.target.getAttribute("data-lang-id");
    const langName = e.target.getAttribute("data-lang-name");

    if (!file || !langId) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      startTransition(async () => {
        try {
          const res = await importLanguageAction(langId, content);
          toast.success(`Imported ${res.count} keys to ${langName}`);
          router.refresh();
        } catch (err) {
          toast.error("Import failed");
        } finally {
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      });
    };
    reader.readAsText(file);
  };

  const handleSetDefault = (id: string) => {
    startTransition(async () => {
      await setLanguageAsDefaultAction(id);
      toast.success("Default language updated");
      router.refresh();
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete language?")) return;
    startTransition(async () => {
      await deleteLanguageAction(id);
      router.refresh();
    });
  };

  const getProgress = (lang: Language) => {
    const total = Object.keys(sourceKeys).length;
    if (total === 0) return 0;
    const translated = Object.keys(lang.translations || {}).filter(k => sourceKeys[k]).length;
    return Math.round((translated / total) * 100);
  };

  const filteredKeys = Object.entries(sourceKeys).filter(
    ([key, val]) =>
      key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(val).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <input type="file" ref={fileInputRef} accept=".json" className="hidden" onChange={handleFileChange} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
                <Languages className="h-5 w-5 text-indigo-600" />
                Language Settings
            </CardTitle>
            <CardDescription>Manage available languages.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handlePublishAll} disabled={isPending}>
                <UploadCloud className="mr-2 h-4 w-4" /> Sync Files
            </Button>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  <Plus className="mr-2 h-4 w-4" /> Add Language
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Language</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2"><Label>Name</Label><Input placeholder="Amharic" value={newName} onChange={e => setNewName(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Code</Label><Input placeholder="am" value={newCode} onChange={e => setNewCode(e.target.value)} /></div>
                </div>
                <DialogFooter><Button onClick={handleCreateLanguage} disabled={isPending}>Create</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent>
            <div className="rounded-md border">
                <div className="grid grid-cols-12 gap-4 bg-muted/50 p-3 text-xs font-medium uppercase text-muted-foreground border-b">
                    <div className="col-span-3">Language</div>
                    <div className="col-span-2">Code</div>
                    <div className="col-span-4">Progress</div>
                    <div className="col-span-3 text-right">Actions</div>
                </div>
                
                {languages.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No languages found.</div>}

                {languages.map(lang => {
                    const progress = getProgress(lang);
                    return (
                        <div key={lang.id} className="grid grid-cols-12 items-center gap-4 p-3 border-b last:border-0 hover:bg-muted/5">
                            <div className="col-span-3 font-medium flex items-center gap-2">
                                {lang.name}
                                {lang.isDefault && <Badge variant="secondary" className="text-[10px] bg-indigo-100 text-indigo-700">Default</Badge>}
                            </div>
                            <div className="col-span-2 text-sm uppercase text-muted-foreground">{lang.code}</div>
                            <div className="col-span-4 pr-6">
                                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden" title={`${progress}% Translated`}>
                                    <div className={cn("h-full transition-all", progress === 100 ? "bg-emerald-500" : "bg-indigo-500")} style={{width: `${progress}%`}} />
                                </div>
                            </div>
                            <div className="col-span-3 flex justify-end gap-2">
                                {/* Primary Action: Translate */}
                                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleOpenTranslate(lang)}>
                                    <Edit3 className="mr-2 h-3.5 w-3.5 text-indigo-500"/> Translate
                                </Button>

                                {/* Dropdown for everything else to fix layout messing up */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        {!lang.isDefault && (
                                            <DropdownMenuItem onClick={() => handleSetDefault(lang.id)}>
                                                <Star className="mr-2 h-4 w-4" /> Make Default
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleExport(lang)}>
                                            <ArrowUpFromLine className="mr-2 h-4 w-4" /> Export JSON
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => triggerImport(lang)}>
                                            <ArrowDownToLine className="mr-2 h-4 w-4" /> Import JSON
                                        </DropdownMenuItem>
                                        {!lang.isDefault && (
                                            <>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-rose-600 focus:text-rose-600" onClick={() => handleDelete(lang.id)}>
                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    )
                })}
            </div>
        </CardContent>
      </Card>

      {/* TRANSLATE MODAL */}
      <Dialog open={!!selectedLang} onOpenChange={(open) => !open && setSelectedLang(null)}>
         <DialogContent className="flex flex-col gap-0 p-0 sm:max-h-[85vh] sm:h-[85vh] sm:max-w-5xl overflow-hidden bg-background">
            {/* Header */}
            <div className="border-b p-4 flex items-center justify-between bg-background z-10">
                <div>
                    <DialogTitle className="flex items-center gap-2">
                         <Languages className="h-5 w-5 text-indigo-600" />
                         <span>Translating: <span className="text-indigo-600">{selectedLang?.name}</span></span>
                    </DialogTitle>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelectedLang(null)}>Close</Button>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col gap-3 border-b bg-muted/30 p-4 shrink-0 z-10">
                <div className="flex items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search keys..." className="pl-9 bg-background" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    </div>
                    <Button size="sm" className={cn("text-white", showAddKey ? "bg-slate-600" : "bg-indigo-600")} onClick={() => setShowAddKey(!showAddKey)}>
                        {showAddKey ? <X className="mr-2 h-4 w-4"/> : <Plus className="mr-2 h-4 w-4"/>}
                        {showAddKey ? "Cancel" : "Add Key"}
                    </Button>
                </div>

                {/* Add Key Form */}
                {showAddKey && (
                    <div className="grid grid-cols-12 gap-2 items-end bg-white dark:bg-slate-950 border p-3 rounded-md shadow-sm animate-in slide-in-from-top-2">
                        <div className="col-span-3">
                            <Label className="text-xs">Group</Label>
                            <Input value={keyGroup} onChange={e => setKeyGroup(e.target.value)} className="h-8 text-xs" placeholder="optional" />
                        </div>
                        <div className="col-span-4">
                            <Label className="text-xs">Key</Label>
                            <Input value={keyName} onChange={e => setKeyName(e.target.value)} className="h-8 text-xs" placeholder="required" />
                        </div>
                        <div className="col-span-4">
                            <Label className="text-xs">Value ({sourceLang?.code})</Label>
                            <Input value={keyValue} onChange={e => setKeyValue(e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div className="col-span-1">
                            <Button size="sm" className="h-8 w-full bg-emerald-600 text-white" onClick={handleAddKeyAction} disabled={isPending}>Save</Button>
                        </div>
                    </div>
                )}
            </div>

            {/* List Header */}
            <div className="grid grid-cols-12 border-b bg-muted px-6 py-2 text-xs font-semibold uppercase text-muted-foreground shrink-0">
                <div className="col-span-3">Key</div>
                <div className="col-span-4">Source ({sourceLang?.code})</div>
                <div className="col-span-4">Translation ({selectedLang?.code})</div>
                <div className="col-span-1 text-right">Save</div>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto min-h-0 bg-background">
                <div className="divide-y">
                    {filteredKeys.map(([key, sourceVal]) => (
                        <div key={key} className="grid grid-cols-12 gap-4 px-6 py-3 items-center hover:bg-muted/5 group">
                            <div className="col-span-3 overflow-hidden text-ellipsis">
                                <code className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded select-all block truncate" title={key}>{key}</code>
                            </div>
                            <div className="col-span-4 text-sm text-foreground leading-snug break-words pr-2">
                                {sourceVal}
                            </div>
                            <div className="col-span-4">
                                <Input 
                                    value={editValues[key] || ""}
                                    onChange={(e) => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
                                    placeholder={sourceVal}
                                    className={cn("h-8 text-sm bg-transparent focus-visible:ring-1 focus-visible:ring-indigo-500", editValues[key] && "bg-emerald-50/10 border-emerald-500/50")}
                                />
                            </div>
                            <div className="col-span-1 text-right">
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" onClick={() => handleSaveSingleKey(key)} disabled={isPending}>
                                    <Save className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <DialogFooter className="p-4 border-t bg-background shrink-0">
                 <div className="flex w-full justify-between items-center">
                     <div className="text-xs text-muted-foreground">Showing {filteredKeys.length} keys</div>
                     <Button onClick={handleSaveAll} disabled={isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        {isPending ? "Saving..." : "Save All Changes"}
                     </Button>
                 </div>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}