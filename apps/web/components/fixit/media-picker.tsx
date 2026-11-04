"use client";

import { useRef, useState } from "react";
import { Camera, Film, X } from "lucide-react";

import {
  mediaSlotError,
  formatBytes,
  remainingMediaSlots,
  type PendingMedia as BasePendingMedia,
} from "@/lib/fixit-media";
import { MEDIA_ACCEPT, mediaKindFor } from "@/lib/fixit";

/**
 * Photos and a short video, added to a job before it is sent.
 *
 * A professional quotes far better from a picture than from a sentence: they can
 * see the leak, the age of the fitting, and whether the job is what the customer
 * thinks it is. Each file can be reviewed and taken back before the request goes
 * out, and nothing is uploaded until the customer sends it.
 */
/** A pending file as it exists in the browser: the chosen File itself. */
export type PendingMedia = BasePendingMedia<File>;

export function MediaPicker({
  media,
  onChange,
  disabled,
  disabledNote,
}: {
  media: PendingMedia[];
  onChange: (next: PendingMedia[]) => void;
  disabled?: boolean;
  disabledNote?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const accepted: PendingMedia[] = [];
    let lastError: string | null = null;
    let working = media;
    for (const file of Array.from(files)) {
      const problem = mediaSlotError(working, file);
      if (problem) {
        lastError = problem;
        continue;
      }
      const kind = mediaKindFor(file)!;
      const item: PendingMedia = {
        id: kind + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
        kind,
        file,
        previewUrl: kind === "photo" ? URL.createObjectURL(file) : "",
      };
      accepted.push(item);
      working = [...working, item];
    }
    if (accepted.length > 0) onChange(working);
    if (lastError) setError(lastError);
    if (inputRef.current) inputRef.current.value = "";
  }

  function remove(item: PendingMedia) {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    onChange(media.filter((m) => m.id !== item.id));
  }

  const photos = media.filter((m) => m.kind === "photo").length;
  const videos = media.filter((m) => m.kind === "video").length;
  const slots = remainingMediaSlots(media);

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs font-bold text-foreground/70">
          Photos or a short video <span className="font-normal text-muted-foreground">(recommended)</span>
        </span>
        <span className="text-[11.5px] tabular-nums text-muted-foreground">
          {photos}/8 photos{videos > 0 ? " · 1 video" : ""}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={MEDIA_ACCEPT}
        multiple
        className="hidden"
        data-testid="media-input"
        onChange={(event) => addFiles(event.target.files)}
      />

      {disabled ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-[12.5px] text-muted-foreground">
          {disabledNote ?? "Photos need a signed-in account."}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={slots.photos === 0 && slots.videos === 0}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-4 text-[13px] font-bold text-foreground/70 hover:border-primary hover:text-primary disabled:opacity-60"
        >
          <Camera className="h-4 w-4" aria-hidden="true" />
          {media.length === 0 ? "Add photos or a video" : "Add another"}
        </button>
      )}

      {media.length > 0 ? (
        <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {media.map((item) => (
            <li key={item.id} className="relative overflow-hidden rounded-lg border border-border bg-muted">
              {item.kind === "photo" && item.previewUrl ? (
                // A local preview of the file just chosen, not a stored copy.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.previewUrl}
                  alt={item.file.name}
                  width={240}
                  height={180}
                  className="h-24 w-full object-cover"
                />
              ) : (
                <span className="flex h-24 w-full items-center justify-center">
                  <Film className="h-6 w-6 text-foreground/40" aria-hidden="true" />
                </span>
              )}
              <span className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-1 bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white">
                <span className="truncate">{item.file.name}</span>
                <span className="flex-none tabular-nums">{formatBytes(item.file.size)}</span>
              </span>
              <button
                type="button"
                aria-label={"Remove " + item.file.name}
                onClick={() => remove(item)}
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-destructive"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-[12.5px] text-destructive">
          {error}
        </p>
      ) : null}
      <p className="mt-1.5 text-[11.5px] text-muted-foreground">
        A photo of the problem leads to a more accurate quote and saves a wasted visit. Only the
        professionals who can see your job can open what you send.
      </p>
    </div>
  );
}
