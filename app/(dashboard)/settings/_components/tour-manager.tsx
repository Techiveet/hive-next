"use client";

import * as React from "react";

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import {
  deleteTourConfigAction,
  upsertTourConfigAction,
} from "../settings-actions";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type TourStepDTO = {
  id: string;
  order: number;
  selector: string;
  title: string;
  body: string;
  placement: string;
  padding: number | null;
  rectX: number | null;
  rectY: number | null;
  rectWidth: number | null;
  rectHeight: number | null;
  onlyPathPrefix: string | null;
};

type TourDTO = {
  id: string;
  tenantId: string | null;
  tenantKey: string;
  key: string;
  name: string;
  isActive: boolean;
  version: number;
  steps: TourStepDTO[];
};

type StepForm = {
  id?: string;
  selector: string;
  title: string;
  body: string;
  placement?: string;
  padding?: number | null;
  rect?: { x?: number; y?: number; width?: number; height?: number };
  onlyPathPrefix?: string | null;
};

type TourForm = {
  targetTenantId: string; // "" => GLOBAL
  tourKey: string;
  name: string;
  version: string;
  isEnabled: boolean;
  steps: StepForm[];
};

const SIDEBAR_DEFAULT_RECT = { x: 3, y: 1, width: 254, height: 744 } as const;

function toForm(t: TourDTO): TourForm {
  return {
    targetTenantId: t.tenantId ?? "",
    tourKey: t.key,
    name: t.name ?? "",
    version: String(t.version ?? 1),
    isEnabled: !!t.isActive,
    steps: (t.steps ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        id: s.id,
        selector: s.selector ?? "",
        title: s.title ?? "",
        body: s.body ?? "",
        placement: s.placement ?? "right",
        padding: s.padding ?? null,
        rect: {
          x: s.rectX ?? undefined,
          y: s.rectY ?? undefined,
          width: s.rectWidth ?? undefined,
          height: s.rectHeight ?? undefined,
        },
        onlyPathPrefix: s.onlyPathPrefix ?? null,
      })),
  };
}

function makeNewTourForm(): TourForm {
  return {
    targetTenantId: "",
    tourKey: "",
    name: "",
    version: "1",
    isEnabled: true,
    steps: [
      {
        id: "sidebar",
        selector: `[data-tour="sidebar"]`,
        title: "Sidebar Navigation",
        body: "Use the sidebar to move between modules quickly.",
        placement: "right",
        padding: 8,
        rect: { ...SIDEBAR_DEFAULT_RECT },
      },
    ],
  };
}

function isFiniteNumber(v: unknown) {
  return typeof v === "number" && Number.isFinite(v);
}

function parseMaybeNumber(raw: string): number | undefined {
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function TourManager({ initialTours }: { initialTours: TourDTO[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [tours, setTours] = useState<TourDTO[]>(initialTours);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, TourForm>>({});
  const [newTour, setNewTour] = useState<TourForm>(makeNewTourForm());

  React.useEffect(() => setTours(initialTours), [initialTours]);

  const refresh = () => router.refresh();

  const dispatchTourUpdated = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event("tour-config-updated"));
  };

  const toggleExpand = (tourId: string) => {
    setExpanded((p) => ({ ...p, [tourId]: !p[tourId] }));
    setDrafts((prev) => {
      if (prev[tourId]) return prev;
      const tour = initialTours.find((x) => x.id === tourId);
      if (!tour) return prev;
      return { ...prev, [tourId]: toForm(tour) };
    });
  };

  const clearTourStorage = React.useCallback((tenantId: string | null, tourKey: string) => {
    if (typeof window === "undefined") return;

    const tenantKey = tenantId ?? "GLOBAL";
    const keys = [
      `tour:${tenantKey}:${tourKey}:active`,
      `tour:${tenantKey}:${tourKey}:step`,
      `tour:${tenantKey}:${tourKey}:seen`,
      `tour:${tenantKey}:${tourKey}:version`,
      `tour:${tourKey}:active`,
      `tour:${tourKey}:step`,
      `tour:${tourKey}:seen`,
      `tour:${tourKey}:version`,
    ];

    keys.forEach((k) => localStorage.removeItem(k));

    const prefixes = [
      `tour:${tenantKey}:${tourKey}:`,
      `tour:${tourKey}:`,
      `tour:${tenantKey}|${tourKey}`,
      `tour:${tenantKey}@${tourKey}`,
    ];

    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (prefixes.some((p) => k.startsWith(p))) localStorage.removeItem(k);
    }

    window.dispatchEvent(new CustomEvent("tour:stop", { detail: { tourKey } }));
  }, []);

  function validateTourForm(form: TourForm) {
    const tourKey = form.tourKey.trim();
    if (!tourKey) throw new Error("Tour key is required.");

    const version = Number(form.version);
    if (!Number.isFinite(version) || version < 1) {
      throw new Error("Tour version must be a number >= 1.");
    }

    if (!Array.isArray(form.steps) || form.steps.length === 0) {
      throw new Error("At least one step is required.");
    }

    form.steps.forEach((s, idx) => {
      if (!String(s.selector ?? "").trim()) throw new Error(`Step ${idx + 1}: selector is required`);
      if (!String(s.title ?? "").trim()) throw new Error(`Step ${idx + 1}: title is required`);
      if (!String(s.body ?? "").trim()) throw new Error(`Step ${idx + 1}: body is required`);

      // rect validation (optional, but if partially set -> must be complete & valid)
      const r = s.rect;
      const anyRect =
        r &&
        (r.x !== undefined || r.y !== undefined || r.width !== undefined || r.height !== undefined);

      if (anyRect) {
        if (
          !r ||
          !isFiniteNumber(r.x) ||
          !isFiniteNumber(r.y) ||
          !isFiniteNumber(r.width) ||
          !isFiniteNumber(r.height)
        ) {
          throw new Error(`Step ${idx + 1}: rect must have x, y, width, height (numbers)`);
        }
        if ((r.width ?? 0) <= 0 || (r.height ?? 0) <= 0) {
          throw new Error(`Step ${idx + 1}: rect width/height must be > 0`);
        }
      }
    });

    return { tourKey, version };
  }

  function saveTourForm(form: TourForm, opts?: { after?: () => void }) {
    let parsed: { tourKey: string; version: number };
    try {
      parsed = validateTourForm(form);
    } catch (e: any) {
      toast.error(e?.message || "Invalid tour config");
      return;
    }

    const toastId = toast.loading("Saving tour...");
    startTransition(async () => {
      try {
        await upsertTourConfigAction({
          targetTenantId: form.targetTenantId.trim() ? form.targetTenantId.trim() : null,
          tourKey: parsed.tourKey,
          version: parsed.version,
          isEnabled: !!form.isEnabled,
          name: form.name?.trim() || undefined,
          steps: form.steps.map((s) => ({
            id: s.id,
            selector: String(s.selector).trim(),
            title: String(s.title).trim(),
            body: String(s.body).trim(),
            placement: (s.placement || "right").trim(),
            padding:
              typeof s.padding === "number" && Number.isFinite(s.padding)
                ? Math.round(s.padding)
                : undefined,
            rect: s.rect,
            onlyPathPrefix: s.onlyPathPrefix ?? undefined,
          })),
        });

        clearTourStorage(form.targetTenantId.trim() ? form.targetTenantId.trim() : null, parsed.tourKey);

        toast.success("Tour saved", { id: toastId });
        opts?.after?.();
        dispatchTourUpdated();
        refresh();
      } catch (err: any) {
        console.error(err);
        toast.error(err?.message || "Failed to save tour", { id: toastId });
      }
    });
  }

  function createTour() {
    saveTourForm(newTour, { after: () => setNewTour(makeNewTourForm()) });
  }

  function deleteTour(form: TourForm) {
    const tourKey = form.tourKey.trim();
    if (!tourKey) return toast.error("Tour key is required.");

    const toastId = toast.loading("Deleting tour...");
    startTransition(async () => {
      try {
        await deleteTourConfigAction({
          targetTenantId: form.targetTenantId.trim() ? form.targetTenantId.trim() : null,
          tourKey,
        });

        clearTourStorage(form.targetTenantId.trim() ? form.targetTenantId.trim() : null, tourKey);

        toast.success("Tour deleted", { id: toastId });
        dispatchTourUpdated();
        refresh();
      } catch (err: any) {
        console.error(err);
        toast.error(err?.message || "Failed to delete tour", { id: toastId });
      }
    });
  }

  function bumpVersion(form: TourForm, setForm: (next: TourForm) => void) {
    const next = { ...form, version: String((Number(form.version) || 1) + 1) };
    setForm(next);
    saveTourForm(next);
  }

  function addStep(form: TourForm, setForm: (next: TourForm) => void) {
    const next: TourForm = {
      ...form,
      steps: [
        ...form.steps,
        {
          id: `step-${Date.now()}`,
          selector: `[data-tour="your-selector"]`,
          title: `Step ${form.steps.length + 1}`,
          body: "Step description",
          placement: "right",
          padding: 8,
        },
      ],
    };
    setForm(next);
  }

  function removeStep(form: TourForm, setForm: (next: TourForm) => void, idx: number) {
    const next = { ...form, steps: form.steps.filter((_, i) => i !== idx) };
    setForm(next);
  }

  function moveStep(form: TourForm, setForm: (next: TourForm) => void, idx: number, dir: -1 | 1) {
    const nextSteps = [...form.steps];
    const swapWith = idx + dir;
    if (swapWith < 0 || swapWith >= nextSteps.length) return;
    [nextSteps[idx], nextSteps[swapWith]] = [nextSteps[swapWith], nextSteps[idx]];
    setForm({ ...form, steps: nextSteps });
  }

  return (
    <div className="space-y-4">
      {/* CREATE NEW TOUR */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-2 text-sm font-semibold">Create new tour</div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Target Tenant ID (optional)</Label>
            <Input
              value={newTour.targetTenantId}
              onChange={(e) => setNewTour((p) => ({ ...p, targetTenantId: e.target.value }))}
              placeholder="Leave empty for GLOBAL"
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label>Tour Key</Label>
            <Input
              value={newTour.tourKey}
              onChange={(e) => setNewTour((p) => ({ ...p, tourKey: e.target.value }))}
              placeholder="dashboard"
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={newTour.name}
              onChange={(e) => setNewTour((p) => ({ ...p, name: e.target.value }))}
              placeholder="Dashboard Tour"
              disabled={isPending}
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Enabled</Label>
            <Switch
              checked={newTour.isEnabled}
              onCheckedChange={(v) => setNewTour((p) => ({ ...p, isEnabled: !!v }))}
              disabled={isPending}
            />
          </div>

          <Button type="button" onClick={createTour} disabled={isPending}>
            <Plus className="mr-2 h-4 w-4" />
            Create Tour
          </Button>
        </div>
      </div>

      {/* LIST EXISTING TOURS */}
      {tours.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">
          No tours found.
        </div>
      ) : (
        <div className="space-y-3">
          {tours.map((t) => {
            const isOpen = !!expanded[t.id];
            const form = drafts[t.id] ?? toForm(t);

            const setForm = (next: TourForm) => setDrafts((prev) => ({ ...prev, [t.id]: next }));

            return (
              <div key={t.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleExpand(t.id)}
                      className="rounded-md p-1 hover:bg-muted"
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>

                    <div>
                      <div className="text-sm font-semibold">
                        {t.name}{" "}
                        <span className="ml-2 rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          {t.tenantId ? `TENANT:${t.tenantId}` : "GLOBAL"}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        key: <span className="font-mono">{t.key}</span> • version:{" "}
                        <span className="font-mono">{t.version}</span> • steps:{" "}
                        <span className="font-mono">{t.steps.length}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Active</span>
                      <Switch
                        checked={form.isEnabled}
                        onCheckedChange={(v) => {
                          const next = { ...form, isEnabled: !!v };
                          setForm(next);
                          saveTourForm(next);
                        }}
                        disabled={isPending}
                      />
                    </div>

                    <Button type="button" variant="outline" onClick={() => bumpVersion(form, setForm)} disabled={isPending}>
                      Bump version
                    </Button>

                    <Button type="button" variant="destructive" onClick={() => deleteTour(form)} disabled={isPending}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>

                {isOpen && (
                  <>
                    <Separator className="my-4" />

                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="space-y-2 md:col-span-1">
                        <Label>Target Tenant ID</Label>
                        <Input
                          value={form.targetTenantId}
                          onChange={(e) => setForm({ ...form, targetTenantId: e.target.value })}
                          disabled={isPending}
                          placeholder="GLOBAL if empty"
                        />
                      </div>

                      <div className="space-y-2 md:col-span-1">
                        <Label>Tour Key</Label>
                        <Input
                          value={form.tourKey}
                          onChange={(e) => setForm({ ...form, tourKey: e.target.value })}
                          disabled={isPending}
                        />
                      </div>

                      <div className="space-y-2 md:col-span-1">
                        <Label>Name</Label>
                        <Input
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          disabled={isPending}
                        />
                      </div>

                      <div className="space-y-2 md:col-span-1">
                        <Label>Version</Label>
                        <Input
                          type="number"
                          min={1}
                          value={form.version}
                          onChange={(e) => setForm({ ...form, version: e.target.value })}
                          disabled={isPending}
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        Steps target CSS selectors (example:{" "}
                        <span className="font-mono">[data-tour="nav-dashboard"]</span>)
                      </div>

                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" onClick={() => addStep(form, setForm)} disabled={isPending}>
                          <Plus className="mr-2 h-4 w-4" />
                          Add step
                        </Button>

                        <Button type="button" onClick={() => saveTourForm(form)} disabled={isPending}>
                          <Save className="mr-2 h-4 w-4" />
                          Save
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 space-y-3">
                      {form.steps.map((s, idx) => {
                        const rect = s.rect ?? {};
                        const setStep = (patch: Partial<StepForm>) => {
                          const next = { ...form };
                          next.steps = [...next.steps];
                          next.steps[idx] = { ...next.steps[idx], ...patch };
                          setForm(next);
                        };

                        const setRect = (patch: Partial<NonNullable<StepForm["rect"]>>) => {
                          const nextRect = { ...(s.rect ?? {}), ...patch };
                          setStep({ rect: nextRect });
                        };

                        return (
                          <div
                            key={s.id ?? `${form.tourKey}-${idx}`}
                            className={cn("rounded-md border p-3", "bg-muted/20")}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium">
                                  {idx + 1}. {s.title || "Untitled"}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground font-mono">
                                  {s.selector || "(missing selector)"}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => moveStep(form, setForm, idx, -1)}
                                  disabled={isPending || idx === 0}
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => moveStep(form, setForm, idx, 1)}
                                  disabled={isPending || idx === form.steps.length - 1}
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => removeStep(form, setForm, idx)}
                                  disabled={isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Selector</Label>
                                <Input value={s.selector} onChange={(e) => setStep({ selector: e.target.value })} disabled={isPending} />
                              </div>

                              <div className="space-y-2">
                                <Label>Placement</Label>
                                <select
                                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                  value={s.placement ?? "right"}
                                  onChange={(e) => setStep({ placement: e.target.value })}
                                  disabled={isPending}
                                >
                                  <option value="top">top</option>
                                  <option value="right">right</option>
                                  <option value="bottom">bottom</option>
                                  <option value="left">left</option>
                                </select>
                              </div>

                              <div className="space-y-2">
                                <Label>Title</Label>
                                <Input value={s.title} onChange={(e) => setStep({ title: e.target.value })} disabled={isPending} />
                              </div>

                              <div className="space-y-2">
                                <Label>Padding (optional)</Label>
                                <Input
                                  type="number"
                                  value={typeof s.padding === "number" ? String(s.padding) : ""}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const val = raw === "" ? null : Number(raw);
                                    setStep({ padding: raw === "" || Number.isNaN(val) ? null : val });
                                  }}
                                  disabled={isPending}
                                />
                              </div>

                              {/* ✅ RECT INPUTS */}
                              <div className="space-y-2 md:col-span-2">
                                <Label>Rect override (optional)</Label>
                                <div className="grid gap-2 sm:grid-cols-4">
                                  <Input
                                    placeholder="x (left)"
                                    value={rect.x ?? ""}
                                    onChange={(e) => setRect({ x: parseMaybeNumber(e.target.value) })}
                                    disabled={isPending}
                                  />
                                  <Input
                                    placeholder="y (top)"
                                    value={rect.y ?? ""}
                                    onChange={(e) => setRect({ y: parseMaybeNumber(e.target.value) })}
                                    disabled={isPending}
                                  />
                                  <Input
                                    placeholder="width"
                                    value={rect.width ?? ""}
                                    onChange={(e) => setRect({ width: parseMaybeNumber(e.target.value) })}
                                    disabled={isPending}
                                  />
                                  <Input
                                    placeholder="height"
                                    value={rect.height ?? ""}
                                    onChange={(e) => setRect({ height: parseMaybeNumber(e.target.value) })}
                                    disabled={isPending}
                                  />
                                </div>

                                <div className="mt-2 flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setRect({ ...SIDEBAR_DEFAULT_RECT })}
                                    disabled={isPending}
                                  >
                                    Apply Sidebar Rect (3,1,254,744)
                                  </Button>

                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setStep({ rect: undefined })}
                                    disabled={isPending}
                                  >
                                    Clear Rect
                                  </Button>
                                </div>

                                <p className="text-[11px] text-muted-foreground">
                                  If rect is set, the tour can run even if selector is not found (overlay-only).
                                </p>
                              </div>

                              <div className="space-y-2 md:col-span-2">
                                <Label>Body</Label>
                                <textarea
                                  className="min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs leading-5 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                                  value={s.body}
                                  onChange={(e) => setStep({ body: e.target.value })}
                                  disabled={isPending}
                                />
                              </div>

                              <div className="space-y-2 md:col-span-2">
                                <Label>Only path prefix (optional)</Label>
                                <Input
                                  value={s.onlyPathPrefix ?? ""}
                                  onChange={(e) => setStep({ onlyPathPrefix: e.target.value || null })}
                                  placeholder="/dashboard"
                                  disabled={isPending}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
