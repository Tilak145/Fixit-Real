"use client";

import { useEffect, useMemo, useState, type ImgHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ImageFit = "cover" | "contain" | "fill" | "none" | "scale-down";

export interface ImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string;
  fallbackSrc?: string;
  fit?: ImageFit;
  priority?: boolean;
  proxyUrl?: string;
  quality?: number;
}

function optimizedSource(
  source: string,
  proxyUrl: string | undefined,
  width: number | undefined,
  quality: number,
): string {
  if (!proxyUrl || !/^https?:\/\//iu.test(source)) return source;
  try {
    // Keep relative proxies relative so SSR and hydration produce the same src.
    const target = new URL(proxyUrl, "https://spk-image.invalid");
    if (target.protocol !== "https:" && target.protocol !== "http:") return source;
    target.searchParams.set("url", source);
    if (width) target.searchParams.set("width", String(width));
    target.searchParams.set("quality", String(quality));
    if (/^https?:\/\//iu.test(proxyUrl)) return target.href;
    const relative = `${target.pathname}${target.search}${target.hash}`;
    return proxyUrl.startsWith("//") ? `//${target.host}${relative}` : relative;
  } catch {
    return source;
  }
}

export function Image({
  src,
  fallbackSrc,
  fit = "cover",
  priority = false,
  proxyUrl,
  quality = 82,
  width,
  className,
  onError,
  ...props
}: ImageProps) {
  const [fallback, setFallback] = useState(false);
  const numericWidth = typeof width === "number" ? width : undefined;
  const safeQuality = Math.min(100, Math.max(1, Math.round(quality)));
  const resolved = useMemo(
    () => optimizedSource(src, proxyUrl, numericWidth, safeQuality),
    [numericWidth, proxyUrl, safeQuality, src],
  );
  const source = fallback && fallbackSrc ? fallbackSrc : resolved;

  useEffect(() => setFallback(false), [src]);

  return (
    <img
      {...props}
      src={source}
      width={width}
      className={cn("block", className)}
      style={{ objectFit: fit, ...props.style }}
      loading={priority ? "eager" : (props.loading ?? "lazy")}
      decoding={props.decoding ?? "async"}
      fetchPriority={priority ? "high" : props.fetchPriority}
      onError={(event) => {
        if (!fallback && fallbackSrc) setFallback(true);
        onError?.(event);
      }}
    />
  );
}
