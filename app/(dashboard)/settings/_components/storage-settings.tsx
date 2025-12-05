"use client";

import { AlertCircle, Cloud, HardDrive, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getStorageSettingsAction, saveStorageSettingsAction } from "./storage-actions";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // ✅ Ensure this component exists or use standard textarea
import { toast } from "sonner";

export function StorageSettings() {
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    provider: "LOCAL",
    accessKeyId: "",
    secretAccessKey: "",
    bucket: "",
    region: "us-east-1",
    endpoint: "",
    gdriveJson: "", // ✅ Google Drive JSON
  });

  useEffect(() => {
    startTransition(async () => {
        const data = await getStorageSettingsAction();
        if (data) setForm(prev => ({ ...prev, ...data }));
    });
  }, []);

  const handleSave = () => {
    startTransition(async () => {
        await saveStorageSettingsAction(form);
        toast.success("Storage settings saved");
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-indigo-500" /> Storage Provider
        </CardTitle>
        <CardDescription>Choose where system files and backups are stored.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
            <Label>Active Provider</Label>
            <Select value={form.provider} onValueChange={(v) => setForm({...form, provider: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="LOCAL">Local Server</SelectItem>
                    <SelectItem value="S3">AWS S3</SelectItem>
                    <SelectItem value="GDRIVE">Google Drive</SelectItem> 
                    <SelectItem value="R2">Cloudflare R2</SelectItem>
                    <SelectItem value="SPACES">DigitalOcean Spaces</SelectItem>
                </SelectContent>
            </Select>
        </div>

        {/* --- GOOGLE DRIVE FORM --- */}
        {form.provider === "GDRIVE" && (
            <div className="space-y-4 border p-4 rounded-md bg-muted/10">
                <div className="flex items-center gap-2 text-sm font-medium text-indigo-600">
                    <Cloud className="h-4 w-4" /> Google Drive Configuration
                </div>
                <div className="space-y-2">
                    <Label>Service Account JSON</Label>
                    <div className="text-[11px] text-muted-foreground mb-1">
                        Go to Google Cloud Console {'>'} IAM & Admin {'>'} Service Accounts {'>'} Create Key (JSON). Paste the entire content here.
                    </div>
                    <Textarea 
                        className="font-mono text-xs min-h-[150px]"
                        value={form.gdriveJson || ""} 
                        onChange={e => setForm({...form, gdriveJson: e.target.value})} 
                        placeholder='{ "type": "service_account", "project_id": ... }' 
                    />
                </div>
                <div className="flex items-start gap-2 bg-yellow-50 text-yellow-800 p-3 rounded text-xs border border-yellow-200">
                    <AlertCircle className="h-4 w-4 mt-0.5" />
                    <div>
                        <strong>Important:</strong> Enable the "Google Drive API" in your Google Cloud project. 
                        Files will be stored in a folder named "Hive Backups" in the Service Account's drive.
                        To see files, you must share that folder with your personal email later.
                    </div>
                </div>
            </div>
        )}

        {/* --- S3 / R2 / SPACES FORM --- */}
        {(form.provider === "S3" || form.provider === "R2" || form.provider === "SPACES") && (
            <div className="grid grid-cols-2 gap-4 border p-4 rounded-md bg-muted/10">
                 <div className="col-span-2 flex items-center gap-2 text-sm font-medium text-indigo-600">
                    <Cloud className="h-4 w-4" /> Cloud Configuration
                 </div>
                 <div className="space-y-2">
                    <Label>Access Key ID</Label>
                    <Input value={form.accessKeyId || ""} onChange={e => setForm({...form, accessKeyId: e.target.value})} placeholder="AKIA..." />
                 </div>
                 <div className="space-y-2">
                    <Label>Secret Access Key</Label>
                    <Input type="password" value={form.secretAccessKey || ""} onChange={e => setForm({...form, secretAccessKey: e.target.value})} placeholder="SK..." />
                 </div>
                 <div className="space-y-2">
                    <Label>Bucket Name</Label>
                    <Input value={form.bucket || ""} onChange={e => setForm({...form, bucket: e.target.value})} placeholder="my-app-storage" />
                 </div>
                 <div className="space-y-2">
                    <Label>Region</Label>
                    <Input value={form.region || ""} onChange={e => setForm({...form, region: e.target.value})} placeholder="us-east-1" />
                 </div>
                 
                 {(form.provider === "R2" || form.provider === "SPACES") && (
                    <div className="col-span-2 space-y-2">
                        <Label>Endpoint URL</Label>
                        <Input value={form.endpoint || ""} onChange={e => setForm({...form, endpoint: e.target.value})} placeholder="e.g. https://nyc3.digitaloceanspaces.com" />
                    </div>
                 )}
            </div>
        )}
      </CardContent>
      <CardFooter className="justify-end bg-muted/10 border-t p-4">
          <Button onClick={handleSave} disabled={isPending}>
              <Save className="mr-2 h-4 w-4" /> Save Configuration
          </Button>
      </CardFooter>
    </Card>
  );
}