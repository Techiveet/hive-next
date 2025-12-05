"use client";

import { Ban, CheckCircle, Laptop, Network, Plus, RefreshCw, ShieldAlert, Trash2 } from "lucide-react"; // ✅ Added Icons
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ColumnDef, DataTable } from "@/components/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  addIpAddressAction,
  getIpSettingsAction,
  removeIpAddressAction,
  saveIpSettingsAction,
  updateIpRuleAction
} from "./ip-actions";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { toast } from "sonner";

type AllowedIp = {
  ip: string;
  label: string;
  action: "ALLOW" | "BLOCK";
  addedAt: string;
};

export function IpManager() {
  const [isPending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(false);
  const [strategy, setStrategy] = useState<"ALLOW" | "BLOCK">("ALLOW");
  const [ips, setIps] = useState<AllowedIp[]>([]);
  
  const [newIp, setNewIp] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newAction, setNewAction] = useState<"ALLOW" | "BLOCK">("ALLOW");
  const [currentIp, setCurrentIp] = useState<string | null>(null);

  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setCurrentIp(data.ip))
      .catch(() => {});
      
    startTransition(async () => {
        const data = await getIpSettingsAction();
        setEnabled(data.enabled);
        setStrategy((data.strategy as "ALLOW" | "BLOCK") || "ALLOW");
        setIps(data.allowList as AllowedIp[]);
    });
  }, []);

  const handleSave = (newEnabled: boolean, newStrategy: "ALLOW" | "BLOCK") => {
      setEnabled(newEnabled);
      setStrategy(newStrategy);
      startTransition(async () => {
          await saveIpSettingsAction(newEnabled, newStrategy);
          toast.success(`System updated`);
      });
  };

  const handleAdd = () => {
    if (!newIp) return toast.error("IP Address is required");
    startTransition(async () => {
        try { 
            await addIpAddressAction(newIp, newLabel || "Device", newAction); 
            toast.success(`Rule Added`); 
            setNewIp(""); setNewLabel(""); 
            const d = await getIpSettingsAction(); setIps(d.allowList as any); 
        } catch(e:any) { toast.error(e.message); }
    });
  };

  // ✅ Toggle Action Handler
  const handleToggleAction = (ip: string, currentAction: "ALLOW" | "BLOCK") => {
      const newAction = currentAction === "ALLOW" ? "BLOCK" : "ALLOW";
      startTransition(async () => {
          await updateIpRuleAction(ip, newAction);
          
          // Optimistic Update
          setIps(prev => prev.map(item => 
              item.ip === ip ? { ...item, action: newAction } : item
          ));
          
          toast.success(`IP ${newAction === 'ALLOW' ? 'Allowed' : 'Blocked'}`);
      });
  };

  const handleRemove = (ip: string) => {
      if(!confirm("Delete this rule?")) return;
      startTransition(async () => { 
          await removeIpAddressAction(ip); 
          setIps(prev=>prev.filter(i=>i.ip!==ip)); 
          toast.success("Rule Removed"); 
      });
  };

  const addCurrentIp = () => { 
      if(currentIp) { 
          setNewIp(currentIp); 
          setNewLabel("My Device"); 
          setNewAction("ALLOW");
      } 
  };

  const columns: ColumnDef<AllowedIp>[] = [
      { 
        accessorKey: "action", 
        header: "Effect", 
        cell: ({row}) => (
            <div className={`flex items-center gap-2 font-medium text-[10px] uppercase px-2 py-1 rounded-md w-fit ${row.original.action === "ALLOW" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                {row.original.action === "ALLOW" ? <CheckCircle className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
                {row.original.action}
            </div>
        )
      },
      { accessorKey: "ip", header: "IP Address", cell: ({row}) => <span className="font-mono text-xs">{row.original.ip}</span> },
      { accessorKey: "label", header: "Label", cell: ({row}) => <span className="text-xs">{row.original.label}</span> },
      { accessorKey: "addedAt", header: "Date", cell: ({row}) => <span className="text-xs text-muted-foreground">{row.original.addedAt ? format(new Date(row.original.addedAt), 'MMM d') : '-'}</span> },
      { 
        id: "actions", 
        header: " ", 
        cell: ({row}) => (
            <div className="flex justify-end gap-2">
                {/* ✅ Toggle Button */}
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 text-xs px-2"
                    onClick={() => handleToggleAction(row.original.ip, row.original.action)}
                    disabled={isPending}
                    title={row.original.action === "ALLOW" ? "Block this IP" : "Allow this IP"}
                >
                    {row.original.action === "ALLOW" ? (
                        <span className="flex items-center text-amber-600 hover:text-amber-700">
                            <Ban className="h-3.5 w-3.5 mr-1" /> Block
                        </span>
                    ) : (
                        <span className="flex items-center text-emerald-600 hover:text-emerald-700">
                            <CheckCircle className="h-3.5 w-3.5 mr-1" /> Allow
                        </span>
                    )}
                </Button>

                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-50" onClick={() => handleRemove(row.original.ip)}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        ) 
      }
  ];

  return (
    <div className="space-y-6">
      {/* CONFIG CARD */}
      <Card className={enabled ? (strategy === "ALLOW" ? "border-indigo-500/50 bg-indigo-50/10" : "border-orange-500/50 bg-orange-50/10") : ""}>
        <CardHeader className="pb-4">
           <div className="flex items-center justify-between">
              <div className="space-y-1">
                 <CardTitle className="flex items-center gap-2"><Network className="h-5 w-5 text-indigo-500" /> Access Control</CardTitle>
                 <CardDescription>
                     {strategy === "ALLOW" ? "Blacklist Mode: Allow everyone EXCEPT listed Blocked IPs." : "Whitelist Mode: Block everyone EXCEPT listed Allowed IPs."}
                 </CardDescription>
              </div>
              <Switch checked={enabled} onCheckedChange={(v) => handleSave(v, strategy)} disabled={isPending} />
           </div>
        </CardHeader>
        <CardContent>
           <div className="flex items-center gap-4">
               <Label>Default Behavior:</Label>
               <Select value={strategy} onValueChange={(v: any) => handleSave(enabled, v)} disabled={!enabled}>
                   <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                   <SelectContent>
                       <SelectItem value="ALLOW">Allow Everyone (Default)</SelectItem>
                       <SelectItem value="BLOCK">Block Everyone (Strict)</SelectItem>
                   </SelectContent>
               </Select>
           </div>
        </CardContent>
      </Card>

      {/* LIST CARD */}
      <Card>
         <CardHeader><CardTitle className="text-sm font-medium">IP Rules</CardTitle></CardHeader>
         <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3 items-end border p-3 rounded-md bg-muted/20">
                <div className="space-y-1 w-[120px]">
                    <Label className="text-xs">Action</Label>
                    <Select value={newAction} onValueChange={(v: any) => setNewAction(v)}>
                        <SelectTrigger className="h-9 text-xs font-medium"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALLOW">Allow</SelectItem>
                            <SelectItem value="BLOCK">Block</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1 flex-1 w-full">
                    <Label className="text-xs">IP Address</Label>
                    <div className="relative">
                        <Input value={newIp} onChange={e=>setNewIp(e.target.value)} className="font-mono text-xs" placeholder="1.2.3.4" />
                        {currentIp && <button onClick={addCurrentIp} className="absolute right-2 top-2 text-[10px] text-indigo-600 hover:underline flex gap-1"><Laptop className="h-3 w-3"/> My IP</button>}
                    </div>
                </div>
                <div className="space-y-1 flex-1 w-full">
                    <Label className="text-xs">Label</Label>
                    <Input value={newLabel} onChange={e=>setNewLabel(e.target.value)} className="text-xs" placeholder="Description" />
                </div>
                <Button size="sm" onClick={handleAdd} disabled={isPending} className={newAction === "BLOCK" ? "bg-rose-600 hover:bg-rose-700" : ""}>
                    {newAction === "BLOCK" ? "Block IP" : "Allow IP"}
                </Button>
            </div>
            <DataTable columns={columns} data={ips} searchColumnId="label" searchPlaceholder="Search..." />
         </CardContent>
      </Card>
    </div>
  );
}