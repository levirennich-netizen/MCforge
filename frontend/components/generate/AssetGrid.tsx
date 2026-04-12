"use client";

import { useState } from "react";
import {
  getGeneratedAssetFileUrl,
  getGeneratedAssetThumbnailUrl,
  deleteGeneratedAsset,
} from "@/lib/api";
import { toast } from "@/lib/toast";
import { formatFileSize } from "@/lib/utils";
import type { GeneratedAsset } from "@/types/generate";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface Props {
  projectId: string;
  assets: GeneratedAsset[];
  onDeleted: () => void;
}

function AssetIcon({ type }: { type: string }) {
  if (type === "image") {
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
      </svg>
    );
  }
  if (type === "sfx") {
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  );
}

function AssetCard({ asset, projectId, onDeleted }: { asset: GeneratedAsset; projectId: string; onDeleted: () => void }) {
  const [playing, setPlaying] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fileUrl = getGeneratedAssetFileUrl(projectId, asset.id);
  const thumbUrl = getGeneratedAssetThumbnailUrl(projectId, asset.id);

  const handlePlay = () => {
    if (playing) return;
    setPlaying(true);
    const audio = new Audio(fileUrl);
    audio.onended = () => setPlaying(false);
    audio.onerror = () => { setPlaying(false); toast.error("Failed to play audio"); };
    audio.play();
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteGeneratedAsset(projectId, asset.id);
      toast.success("Asset deleted");
      onDeleted();
    } catch {
      toast.error("Failed to delete asset");
    }
    setDeleting(false);
  };

  return (
    <Card padding="none" className="overflow-hidden">
      {/* Thumbnail / Preview */}
      {asset.asset_type === "video" ? (
        <div className="relative aspect-video bg-black">
          <video
            controls
            className="w-full h-full"
            src={fileUrl}
            poster={thumbUrl}
          />
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/60 text-[10px] text-white/70">
            {asset.duration_seconds}s
          </span>
        </div>
      ) : asset.asset_type === "image" || asset.asset_type === "animated_intro" ? (
        <div className="relative aspect-video bg-black/30">
          <img
            src={thumbUrl}
            alt={asset.name}
            className="w-full h-full object-cover"
          />
          {asset.asset_type === "animated_intro" && (
            <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/60 text-[10px] text-white/70">
              {asset.duration_seconds}s
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center h-24 bg-gradient-to-br from-amber-500/10 to-amber-500/5">
          <div className="text-amber-400">
            <AssetIcon type={asset.asset_type} />
          </div>
        </div>
      )}

      {/* Info */}
      <div className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <span className="text-muted/60 mt-0.5"><AssetIcon type={asset.asset_type} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{asset.name}</p>
            <p className="text-xs text-muted truncate">{asset.prompt}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted">
          <span>{formatFileSize(asset.file_size_bytes)}</span>
          {asset.duration_seconds > 0 && <span>{asset.duration_seconds}s</span>}
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 pt-1">
          {asset.asset_type === "sfx" && (
            <Button size="sm" variant="secondary" onClick={handlePlay} disabled={playing} className="flex-1">
              {playing ? "Playing..." : "Play"}
            </Button>
          )}
          <a
            href={fileUrl}
            download
            className="flex-1 inline-flex items-center justify-center px-3 py-1.5 text-xs rounded-lg font-medium glass hover:border-border-bright text-foreground hover:bg-white/[0.04] transition-all duration-200"
          >
            Download
          </a>
          <Button size="sm" variant="destructive" onClick={handleDelete} loading={deleting} className="!px-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function AssetGrid({ projectId, assets, onDeleted }: Props) {
  if (assets.length === 0) {
    return (
      <div className="text-center py-12 text-muted">
        <p className="text-sm">No assets generated yet</p>
        <p className="text-xs mt-1">Use the form above to create something awesome</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {assets.map((asset, i) => (
        <div key={asset.id} className="animate-fade-in opacity-0" style={{ animationDelay: `${i * 60}ms` }}>
          <AssetCard asset={asset} projectId={projectId} onDeleted={onDeleted} />
        </div>
      ))}
    </div>
  );
}
