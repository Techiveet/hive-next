"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Archive,
  Clock,
  Database,
  Download,
  FileText,
  HardDrive,
  Save,
  ShieldAlert,
  Trash2
} from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ColumnDef, DataTable } from "@/components/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  deleteBackupAction,
  deleteManyBackupsAction,
  getBackupHistoryAction,
  getBackupSettingsAction,
  performManualBackupAction,
  saveBackupSettingsAction
} from "./backup-actions";
import { useEffect, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { toast } from "sonner";

type BackupRecord = {
  id: string;
  createdAt: string | Date;
  type: string;
  size: string;
  status: string;
  filename: string;
};

export function BackupManager() {
  const [isPending, startTransition] = useTransition();
  
  const [settings, setSettings] = useState<any>({ 
      enabled: false, 
      frequency: 'DAILY', 
      time: '00:00',
      retention: 7 
  });
  
  const [history, setHistory] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ STATE FOR DELETE DIALOGS
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteRows, setBulkDeleteRows] = useState<BackupRecord[] | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
        const [s, h] = await Promise.all([getBackupSettingsAction(), getBackupHistoryAction()]);
        if (s) setSettings(s);
        if (h) setHistory(h as any);
    } catch(e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const handleSaveSettings = () => {
    startTransition(async () => {
      await saveBackupSettingsAction(settings);
      toast.success("Backup schedule saved");
    });
  };

  const handleManualBackup = (scope: "database" | "files" | "full") => {
    const label = scope === "full" ? "Full System" : scope === "database" ? "Database" : "Files";
    const tId = toast.loading(`Creating ${label} backup...`);
    
    startTransition(async () => {
      const res = await performManualBackupAction(scope);
      if (res.success) {
        toast.success(`${label} backup created`, { id: tId });
        loadData();
      } else {
        toast.error(`Failed: ${res.error}`, { id: tId });
      }
    });
  };

  // ✅ 1. Single Delete Confirmation Logic
  const executeDelete = async () => {
    if (!deleteId) return;
    
    startTransition(async () => {
        await deleteBackupAction(deleteId);
        setHistory(prev => prev.filter(i => i.id !== deleteId));
        toast.success("Backup deleted");
        setDeleteId(null); // Close modal
    });
  }

  // ✅ 2. Bulk Delete Confirmation Logic
  const executeBulkDelete = async () => {
      if (!bulkDeleteRows) return;
      
      const ids = bulkDeleteRows.map(r => r.id);
      startTransition(async () => {
          await deleteManyBackupsAction(ids);
          setHistory(prev => prev.filter(item => !ids.includes(item.id)));
          toast.success(`${ids.length} backups deleted`);
          setBulkDeleteRows(null); // Close modal
      });
  };

  const formatSize = (sizeStr: string) => {
      const bytes = parseInt(sizeStr);
      if (isNaN(bytes)) return "0 B";
      const mb = bytes / (1024 * 1024);
      if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${mb.toFixed(2)} MB`;
  }

  const columns: ColumnDef<BackupRecord>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "createdAt",
      header: "Date",
      cell: ({ row }) => format(new Date(row.original.createdAt), 'MMM d, yyyy - p'),
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-[10px]">
            {row.original.type.replace('MANUAL_', '').replace('_', ' ')}
        </Badge>
      ),
    },
    {
      accessorKey: "size",
      header: "Size",
      cell: ({ row }) => <span className="font-mono text-xs">{formatSize(row.original.size)}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge className={row.original.status === 'SUCCESS' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500'}>
            {row.original.status}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                <a href={`/api/backups/${row.original.id}`} download>
                    <Download className="h-4 w-4 text-muted-foreground" />
                </a>
            </Button>
            {/* Trigger Single Delete Dialog */}
            <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-50" 
                onClick={() => setDeleteId(row.original.id)}
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
      ),
    }
  ];

  if(loading) return <div className="p-4 text-sm text-muted-foreground">Loading backup system...</div>;

  return (
    <div className="space-y-6">
      {/* ... SCHEDULE & MANUAL CARDS (Keep exactly as before) ... */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
             <Clock className="h-5 w-5 text-indigo-500" /> Automatic Schedule
          </CardTitle>
          <CardDescription>Configure automation and data retention policies.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/20">
             <div className="space-y-0.5">
                <Label>Enable Automatic Backups</Label>
                <p className="text-xs text-muted-foreground">System will run backups daily at the scheduled time.</p>
             </div>
             <Switch 
                checked={settings.enabled} 
                onCheckedChange={(v) => setSettings({...settings, enabled: v})} 
             />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="space-y-2">
                <Label>Backup Time</Label>
                <div className="relative">
                    <Input 
                        type="time" 
                        value={settings.time} 
                        onChange={(e) => setSettings({...settings, time: e.target.value})}
                        disabled={!settings.enabled}
                        className="font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Server time (UTC/Local)</p>
                </div>
             </div>
             <div className="space-y-2">
                <Label>Frequency</Label>
                <Select 
                    value={settings.frequency} 
                    onValueChange={(v) => setSettings({...settings, frequency: v})}
                    disabled={!settings.enabled}
                >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="DAILY">Daily</SelectItem>
                        <SelectItem value="WEEKLY">Weekly (Mondays)</SelectItem>
                    </SelectContent>
                </Select>
             </div>
             <div className="space-y-2">
                <Label>Retention Policy</Label>
                <Select 
                    value={String(settings.retention ?? 7)} 
                    onValueChange={(v) => setSettings({...settings, retention: parseInt(v)})}
                    disabled={!settings.enabled}
                >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="0">Test: Keep Only Latest</SelectItem>
                        <SelectItem value="3">Keep for 3 Days</SelectItem>
                        <SelectItem value="7">Keep for 7 Days</SelectItem>
                        <SelectItem value="14">Keep for 14 Days</SelectItem>
                        <SelectItem value="30">Keep for 30 Days</SelectItem>
                        <SelectItem value="90">Keep for 3 Months</SelectItem>
                        <SelectItem value="365">Keep for 1 Year</SelectItem>
                    </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1 text-orange-600 dark:text-orange-400">
                   Older backups are automatically deleted.
                </p>
             </div>
          </div>
        </CardContent>
        <CardFooter className="justify-between border-t px-6 py-4 bg-muted/10">
           <div className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" /> 
              Backups include Database + Public folder.
           </div>
           <Button onClick={handleSaveSettings} disabled={isPending}>
               <Save className="mr-2 h-4 w-4" /> Save Schedule
           </Button>
        </CardFooter>
      </Card>

      <Card>
         <CardHeader>
             <CardTitle className="flex items-center gap-2">
                <Archive className="h-5 w-5 text-indigo-500" /> Manual Actions
             </CardTitle>
             <CardDescription>Trigger an immediate snapshot regardless of schedule.</CardDescription>
         </CardHeader>
         <CardContent className="flex flex-col sm:flex-row gap-3">
             <Button variant="outline" className="flex-1 h-16 flex flex-col gap-1 hover:bg-indigo-50 hover:border-indigo-200 transition-all" onClick={() => handleManualBackup("database")} disabled={isPending}>
                <Database className="h-5 w-5 text-indigo-600" />
                <span className="text-xs font-semibold">Database Only</span>
             </Button>
             <Button variant="outline" className="flex-1 h-16 flex flex-col gap-1 hover:bg-indigo-50 hover:border-indigo-200 transition-all" onClick={() => handleManualBackup("files")} disabled={isPending}>
                <FileText className="h-5 w-5 text-indigo-600" />
                <span className="text-xs font-semibold">Files Only</span>
             </Button>
             <Button variant="outline" className="flex-1 h-16 flex flex-col gap-1 hover:bg-indigo-50 hover:border-indigo-200 transition-all" onClick={() => handleManualBackup("full")} disabled={isPending}>
                <HardDrive className="h-5 w-5 text-indigo-600" />
                <span className="text-xs font-semibold">Full System</span>
             </Button>
         </CardContent>
      </Card>

      {/* 3. HISTORY TABLE */}
      <DataTable 
        columns={columns} 
        data={history} 
        title="Backup History"
        description="View, download, or delete recent system backups."
        searchColumnId="type"
        searchPlaceholder="Search by type..."
        onDeleteRows={(rows) => setBulkDeleteRows(rows)} // ✅ Trigger Bulk Dialog
      />

      {/* ✅ SINGLE DELETE ALERT */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Delete this backup?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the backup file from storage and the database record.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={executeDelete} className="bg-rose-600 hover:bg-rose-700">
                    Delete Permanently
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ✅ BULK DELETE ALERT */}
      <AlertDialog open={!!bulkDeleteRows} onOpenChange={(open) => !open && setBulkDeleteRows(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Delete {bulkDeleteRows?.length} backups?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently remove {bulkDeleteRows?.length} selected backup files from storage and database records.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={executeBulkDelete} className="bg-rose-600 hover:bg-rose-700">
                    Delete All Selected
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}