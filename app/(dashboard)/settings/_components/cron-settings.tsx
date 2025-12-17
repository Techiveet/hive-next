"use client";

import { Activity, Play, RefreshCw, Square, Trash2, Zap } from "lucide-react"; // ✅ Added Trash2
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    deleteCronJobAction,
    getCronJobsAction,
    runCronJobManuallyAction,
    toggleCronJobAction
} from "./cron-actions";
import { useEffect, useRef, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export function CronSettings() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [isPending, startTransition] = useTransition();
  const [runningId, setRunningId] = useState<string | null>(null);

  // --- SIMULATOR STATE ---
  const [isSimulatorRunning, setIsSimulatorRunning] = useState(false);
  const [countdown, setCountdown] = useState(60);
  
  const isDev = process.env.NODE_ENV === "development";

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSimulatorRunning && isDev) {
      toast.info("Cron Simulator Started.");
      runBackupCheck();
      interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            runBackupCheck();
            return 60; 
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setCountdown(60);
    }
    return () => clearInterval(interval);
  }, [isSimulatorRunning]);

  const runBackupCheck = async () => {
    console.log("[Simulator] Pinging backup cron...");
    fetch("/api/cron/backup").then(async (res) => {
        const data = await res.json();
        if (data.ran > 0) {
            toast.success(`Simulator: Ran ${data.ran} scheduled backups!`);
            loadJobs();
        }
    });
  };

  const loadJobs = () => {
    startTransition(async () => {
        try {
            const data = await getCronJobsAction();
            setJobs(data);
        } catch (e) { }
    });
  };

  const handleToggle = async (id: string, current: boolean) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, enabled: !current } : j));
    try {
        await toggleCronJobAction(id, !current);
        toast.success(`Job ${!current ? 'enabled' : 'disabled'}`);
    } catch (e) {
        toast.error("Failed to update job");
        loadJobs();
    }
  };

  const handleRunNow = async (id: string, url: string) => {
    setRunningId(id);
    toast.info("Triggering job...");
    try {
        const res = await runCronJobManuallyAction(url);
        if (res.success || res.ran !== undefined) {
            toast.success("Job ran successfully");
        } else {
            toast.error("Job returned failure");
        }
        loadJobs();
    } catch (e) {
        toast.error("Failed to trigger job");
    } finally {
        setRunningId(null);
    }
  };

  // ✅ NEW: Delete Handler
  const handleDelete = async (id: string) => {
      if(!confirm("Are you sure? This will remove the job from the registry (it will be re-added if the code runs again).")) return;
      
      startTransition(async () => {
          try {
              await deleteCronJobAction(id);
              setJobs(prev => prev.filter(j => j.id !== id));
              toast.success("Job deleted");
          } catch(e) {
              toast.error("Failed to delete job");
          }
      })
  };

  return (
    <div className="space-y-6">

      {/* DEV SIMULATOR (Hidden in Prod) */}
      {isDev && (
        <Card className="border-indigo-500/20 bg-indigo-50/10 dark:bg-indigo-950/10">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                            <Zap className="h-5 w-5" /> Dev Mode: Cron Simulator
                        </CardTitle>
                        <CardDescription>
                            Simulate the Linux Cron loop locally.
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                        {isSimulatorRunning && (
                            <Badge variant="outline" className="animate-pulse border-indigo-500 text-indigo-500">
                                Next run in {countdown}s
                            </Badge>
                        )}
                        <Button 
                            size="sm" 
                            variant={isSimulatorRunning ? "destructive" : "default"}
                            onClick={() => setIsSimulatorRunning(!isSimulatorRunning)}
                        >
                            {isSimulatorRunning ? (
                                <><Square className="mr-2 h-4 w-4 fill-current" /> Stop Runner</>
                            ) : (
                                <><Play className="mr-2 h-4 w-4 fill-current" /> Start Runner</>
                            )}
                        </Button>
                    </div>
                </div>
            </CardHeader>
        </Card>
      )}

      {/* JOB REGISTRY */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
              <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-indigo-500" /> Cron Job Registry
              </CardTitle>
              <CardDescription>Monitor system background tasks.</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={loadJobs} disabled={isPending}>
              <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead>Job Name</TableHead>
                          <TableHead>Endpoint</TableHead>
                          <TableHead>Last Run</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Enabled</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {jobs.length === 0 && (
                          <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                  No jobs registered yet. Run a task to auto-register it.
                              </TableCell>
                          </TableRow>
                      )}
                      {jobs.map((job) => (
                          <TableRow key={job.id}>
                              <TableCell>
                                  <div className="font-medium">{job.name}</div>
                                  <div className="text-xs text-muted-foreground font-mono">{job.key}</div>
                              </TableCell>
                              <TableCell>
                                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{job.url}</code>
                              </TableCell>
                              <TableCell className="text-xs">
                                  {job.lastRunAt ? formatDistanceToNow(new Date(job.lastRunAt), { addSuffix: true }) : "Never"}
                              </TableCell>
                              <TableCell>
                                  {job.lastStatus === "SUCCESS" && <Badge className="bg-emerald-500 hover:bg-emerald-600">Success</Badge>}
                                  {job.lastStatus === "FAILED" && <Badge className="bg-rose-500 hover:bg-rose-600">Failed</Badge>}
                                  {!job.lastStatus && <Badge variant="outline">Pending</Badge>}
                              </TableCell>
                              <TableCell>
                                  <Switch 
                                      checked={job.enabled} 
                                      onCheckedChange={() => handleToggle(job.id, job.enabled)} 
                                  />
                              </TableCell>
                              <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                      <Button 
                                          size="sm" 
                                          variant="secondary" 
                                          disabled={runningId === job.id}
                                          onClick={() => handleRunNow(job.id, job.url)}
                                      >
                                          {runningId === job.id ? (
                                              <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" />
                                          ) : (
                                              <Play className="h-3.5 w-3.5 mr-1" /> 
                                          )}
                                          Run
                                      </Button>
                                      
                                      {/* ✅ DELETE BUTTON */}
                                      <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className="h-8 w-8 text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                                        onClick={() => handleDelete(job.id)}
                                      >
                                          <Trash2 className="h-4 w-4" />
                                      </Button>
                                  </div>
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