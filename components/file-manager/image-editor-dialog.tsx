// components/file-manager/image-editor-dialog.tsx
"use client";

import * as React from "react";

import Cropper, { Area } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

type ImageEditorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  onSave: (file: File | null) => void;
};

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.crossOrigin = "anonymous";
    image.src = url;
  });
}

// Apply crop + rotation + color adjustments and return a File
async function getCroppedFile(
  file: File,
  imageUrl: string,
  croppedAreaPixels: Area,
  rotation: number,
  brightness: number,
  contrast: number,
  saturation: number
): Promise<File> {
  const image = await createImage(imageUrl);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas 2D context not available");
  }

  const safeArea = Math.max(image.width, image.height) * 2;
  canvas.width = safeArea;
  canvas.height = safeArea;

  ctx.save();
  ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
  ctx.translate(safeArea / 2, safeArea / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-safeArea / 2, -safeArea / 2);

  const offsetX = (safeArea - image.width) / 2;
  const offsetY = (safeArea - image.height) / 2;
  ctx.drawImage(image, offsetX, offsetY);
  ctx.restore();

  const data = ctx.getImageData(
    offsetX + croppedAreaPixels.x,
    offsetY + croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height
  );

  canvas.width = croppedAreaPixels.width;
  canvas.height = croppedAreaPixels.height;
  ctx.putImageData(data, 0, 0);

  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob(
      (b) => resolve(b as Blob),
      file.type || "image/png",
      0.95
    )
  );

  return new File([blob], file.name, {
    type: blob.type,
    lastModified: Date.now(),
  });
}

export const ImageEditorDialog: React.FC<ImageEditorDialogProps> = ({
  open,
  onOpenChange,
  file,
  onSave,
}) => {
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);

  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] =
    React.useState<Area | null>(null);

  const [brightness, setBrightness] = React.useState(100);
  const [contrast, setContrast] = React.useState(100);
  const [saturation, setSaturation] = React.useState(100);

  type AspectId = "free" | "square" | "portrait" | "landscape";
  const [aspectId, setAspectId] = React.useState<AspectId>("portrait");

  const aspectValue = React.useMemo(() => {
    switch (aspectId) {
      case "square":
        return 1;
      case "portrait":
        return 4 / 5;
      case "landscape":
        return 16 / 9;
      case "free":
      default:
        return undefined;
    }
  }, [aspectId]);

  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!file) {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
        setImageUrl(null);
      }
      return;
    }

    const url = URL.createObjectURL(file);
    setImageUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const handleCropComplete = React.useCallback(
    (_: Area, croppedPixels: Area) => {
      setCroppedAreaPixels(croppedPixels);
    },
    []
  );

  const resetAll = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setAspectId("portrait");
  };

  const handleAspectChange = (id: AspectId) => {
    setAspectId(id);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleClose = () => {
    if (!saving) {
      onOpenChange(false);
    }
  };

  const handleSaveClick = async () => {
    if (!file || !imageUrl || !croppedAreaPixels) {
      onSave(null);
      onOpenChange(false);
      return;
    }

    try {
      setSaving(true);
      const editedFile = await getCroppedFile(
        file,
        imageUrl,
        croppedAreaPixels,
        rotation,
        brightness,
        contrast,
        saturation
      );
      onSave(editedFile);
      onOpenChange(false);
    } catch (error) {
      console.error("[ImageEditorDialog] save error", error);
      onSave(null);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const liveFilter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-border/60 bg-background/95 p-0 shadow-2xl backdrop-blur-xl">
        <DialogHeader className="border-b border-border/60 px-6 py-4">
          <DialogTitle className="text-base font-semibold">
            Edit Image
          </DialogTitle>
          <DialogDescription className="text-xs">
            Crop, rotate and adjust colours before saving.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-4 pt-3">
          {imageUrl ? (
            <div className="space-y-4">
              <p className="text-[11px] text-muted-foreground">
                Drag to move the image, scroll to zoom, and drag the crop frame
                to select any area you want. Only the highlighted region will be
                saved.
              </p>

              <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                {/* LEFT – image & crop */}
                <div className="flex flex-col gap-3">
                  <div className="relative h-[320px] rounded-2xl bg-black/90 md:h-[380px]">
                    <div
                      className="relative h-full w-full overflow-hidden rounded-2xl"
                      style={{ filter: liveFilter }}
                    >
                      <Cropper
                        image={imageUrl}
                        crop={crop}
                        zoom={zoom}
                        rotation={rotation}
                        aspect={aspectValue}
                        cropShape="rect"
                        showGrid={true}
                        restrictPosition={false}
                        zoomWithScroll={true}
                        minZoom={1}
                        maxZoom={4}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onRotationChange={setRotation}
                        onCropComplete={handleCropComplete}
                        objectFit="contain"
                      />
                    </div>
                  </div>

                  {/* aspect presets */}
                  <div className="flex flex-wrap gap-2 rounded-xl bg-muted/60 px-3 py-2 text-[11px]">
                    <span className="mr-2 self-center text-[11px] font-medium text-muted-foreground">
                      Aspect:
                    </span>
                    {(
                      [
                        { id: "free", label: "Free" },
                        { id: "square", label: "1 : 1" },
                        { id: "portrait", label: "4 : 5" },
                        { id: "landscape", label: "16 : 9" },
                      ] as { id: AspectId; label: string }[]
                    ).map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleAspectChange(preset.id)}
                        className={`rounded-full px-3 py-1 text-[11px] transition ${
                          aspectId === preset.id
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-background/70 text-foreground/80 hover:bg-muted"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* RIGHT – sliders */}
                <div className="space-y-4 rounded-2xl bg-muted/50 p-4 text-xs">
                  {/* Zoom */}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-medium text-muted-foreground">
                        Zoom ({zoom.toFixed(2)}x)
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={4}
                      step={0.01}
                      value={zoom}
                      onChange={(e) =>
                        setZoom(parseFloat(e.target.value) || 1)
                      }
                      className="w-full"
                    />
                  </div>

                  {/* Rotation */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-muted-foreground">
                        Rotation ({rotation.toFixed(0)}°)
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="px-2 py-1 text-[11px]"
                          onClick={() => setRotation((r) => r - 90)}
                        >
                          -90°
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="px-2 py-1 text-[11px]"
                          onClick={() => setRotation((r) => r + 90)}
                        >
                          +90°
                        </Button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      step={1}
                      value={rotation}
                      onChange={(e) =>
                        setRotation(parseInt(e.target.value, 10) || 0)
                      }
                      className="w-full"
                    />
                  </div>

                  {/* Brightness */}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-medium text-muted-foreground">
                        Brightness ({brightness}%)
                      </span>
                    </div>
                    <input
                      type="range"
                      min={50}
                      max={150}
                      step={1}
                      value={brightness}
                      onChange={(e) =>
                        setBrightness(parseInt(e.target.value, 10) || 100)
                      }
                      className="w-full"
                    />
                  </div>

                  {/* Contrast */}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-medium text-muted-foreground">
                        Contrast ({contrast}%)
                      </span>
                    </div>
                    <input
                      type="range"
                      min={50}
                      max={150}
                      step={1}
                      value={contrast}
                      onChange={(e) =>
                        setContrast(parseInt(e.target.value, 10) || 100)
                      }
                      className="w-full"
                    />
                  </div>

                  {/* Saturation */}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-medium text-muted-foreground">
                        Saturation ({saturation}%)
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={200}
                      step={1}
                      value={saturation}
                      onChange={(e) =>
                        setSaturation(parseInt(e.target.value, 10) || 100)
                      }
                      className="w-full"
                    />
                  </div>

                  {/* Reset */}
                  <div className="pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="px-2 py-1 text-[11px]"
                      onClick={resetAll}
                    >
                      Reset all
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground">
              No image selected.
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border/60 px-6 py-3">
          <Button variant="outline" type="button" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSaveClick}
            disabled={!file || saving}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
