"use client";

import { Archive, Clock, Database, Download, FileText, HardDrive, ShieldAlert, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  deleteBackupAction,
  getBackupHistoryAction,
  getBackupSettingsAction,
  performManualBackupAction,
  saveBackupSettingsAction
} from "./backup-actions";
import { useEffect, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { toast } from "sonner";

export function BackupManager() {
  const [isPending, startTransition] = useTransition();
  const [settings, setSettings] = useState<any>({ enabled: false, frequency: 'DAILY', time: '00:00' });
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
        try {
            const [s, h] = await Promise.all([getBackupSettingsAction(), getBackupHistoryAction()]);
            if (s) setSettings(s);
            if (h) setHistory(h);
        } catch(e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    load();
  }, []);

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
        const h = await getBackupHistoryAction();
        setHistory(h);
      } else {
        toast.error(`Failed: ${res.error}`, { id: tId });
      }
    });
  };

  const handleDelete = async (id: string) => {
    if(!confirm("Delete this backup permanently?")) return;
    await deleteBackupAction(id);
    setHistory(prev => prev.filter(i => i.id !== id));
    toast.success("Backup deleted");
  }

  const formatSize = (bytes: any) => {
    const mb = Number(bytes) / (1024 * 1024);
    if (mb < 1) return `${(Number(bytes) / 1024).toFixed(1)} KB`;
    return `${mb.toFixed(2)} MB`;
  }

  if(loading) return <div className="p-4 text-sm text-muted-foreground">Loading backup system...</div>;

  return (
    <div className="space-y-6">
      
      {/* 1. SCHEDULE CARD */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
             <Clock className="h-5 w-5 text-indigo-500" /> Automatic Schedule
          </CardTitle>
          <CardDescription>Configure when the system should automatically back up the database and files.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/20">
             <div className="space-y-0.5">
                <Label>Enable Automatic Backups</Label>
                <p className="text-xs text-muted-foreground">Runs daily at the specified time.</p>
             </div>
             <Switch 
                checked={settings.enabled} 
                onCheckedChange={(v) => setSettings({...settings, enabled: v})} 
             />
          </div>

          <div className="grid grid-cols-2 gap-4">
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
                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                    </SelectContent>
                </Select>
             </div>
             <div className="space-y-2">
                <Label>Time (Server Time)</Label>
                <Input 
                    type="time" 
                    value={settings.time} 
                    onChange={(e) => setSettings({...settings, time: e.target.value})}
                    disabled={!settings.enabled}
                />
             </div>
          </div>
        </CardContent>
        <CardFooter className="justify-between border-t px-6 py-4 bg-muted/10">
           <div className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" /> Requires Cron Job setup on server.
           </div>
           <Button onClick={handleSaveSettings} disabled={isPending}>Save Schedule</Button>
        </CardFooter>
      </Card>

      {/* 2. MANUAL ACTIONS */}
      <Card>
         <CardHeader>
             <CardTitle className="flex items-center gap-2">
                <Archive className="h-5 w-5 text-indigo-500" /> Manual Backup
             </CardTitle>
             <CardDescription>Trigger an immediate snapshot of your system.</CardDescription>
         </CardHeader>
         <CardContent className="flex flex-col sm:flex-row gap-3">
             <Button 
                variant="outline" 
                className="flex-1 h-20 flex flex-col gap-2 hover:bg-indigo-50 hover:border-indigo-200 transition-all"
                onClick={() => handleManualBackup("database")}
                disabled={isPending}
             >
                <Database className="h-6 w-6 text-indigo-600" />
                <span className="font-semibold">Database Only</span>
             </Button>
             
             <Button 
                variant="outline" 
                className="flex-1 h-20 flex flex-col gap-2 hover:bg-indigo-50 hover:border-indigo-200 transition-all"
                onClick={() => handleManualBackup("files")}
                disabled={isPending}
             >
                <FileText className="h-6 w-6 text-indigo-600" />
                <span className="font-semibold">Files Only</span>
             </Button>
             
             <Button 
                variant="outline" 
                className="flex-1 h-20 flex flex-col gap-2 hover:bg-indigo-50 hover:border-indigo-200 transition-all"
                onClick={() => handleManualBackup("full")}
                disabled={isPending}
             >
                <HardDrive className="h-6 w-6 text-indigo-600" />
                <span className="font-semibold">Full System</span>
             </Button>
         </CardContent>
      </Card>

      {/* 3. HISTORY TABLE */}
      <Card>
         <CardHeader>
             <CardTitle>Backup History</CardTitle>
         </CardHeader>
         <CardContent>
             <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {history.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No backups found.</TableCell>
                            </TableRow>
                        )}
                        {history.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell className="font-medium text-xs">
                                    {format(new Date(item.createdAt), 'PPP p')}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="text-[10px]">{item.type.replace('_', ' ')}</Badge>
                                </TableCell>
                                <TableCell className="text-xs font-mono">{formatSize(item.size)}</TableCell>
                                <TableCell>
                                    <Badge className={item.status === 'SUCCESS' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500'}>
                                        {item.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                                        <a href={`/api/backups/${item.id}`} download>
                                            <Download className="h-4 w-4 text-muted-foreground" />
                                        </a>
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-50" onClick={() => handleDelete(item.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
             </div>
         </CardContent>
      </Card>
    </div>
  );
}