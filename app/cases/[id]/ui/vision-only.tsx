"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

type MediaItem = {
  url: string;
  contentType?: string;
};

type VisionRecon = {
  vision_summary?: string;
  objects?: string[];
  hazards?: string[];
  visible_damage?: Record<string, any>;
  materials?: Record<string, any>;
  labels_or_text?: string[];
  measurements?: Record<string, any>;
  location_hint?: string;
};

export default function VisionOnlyWorkspace({
  caseData,
}: {
  caseData: any;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [media, setMedia] = useState<MediaItem[]>(caseData.media || []);
  const [visionContext, setVisionContext] = useState(
    caseData.description
      ? `Job description: ${caseData.description}\n\nDescribe all visible maintenance issues objectively.`
      : "Describe visible maintenance issues."
  );
  const [visionRecon, setVisionRecon] = useState<VisionRecon | null>(
    caseData.vision || null
  );
  const [visionRaw, setVisionRaw] = useState(
    caseData.vision ? JSON.stringify(caseData.vision, null, 2) : ""
  );

  const [visionLoading, setVisionLoading] = useState(false);
  const [visionError, setVisionError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // --------------------------
  // UPLOAD MEDIA (SAME AS FULL)
  // --------------------------
  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);

    try {
      const newItems: MediaItem[] = [];

      for (const file of Array.from(files)) {
        const res = await fetch(
          `/api/upload?filename=${encodeURIComponent(file.name)}`,
          {
            method: "POST",
            body: file,
          }
        );

        const data = await res.json();
        if (!res.ok) continue;

        newItems.push({
          url: data.url,
          contentType: data.contentType,
        });
      }

      if (newItems.length > 0) {
        const merged = [...media, ...newItems];
        setMedia(merged);

        await supabase
          .from("cases")
          .update({ media: merged })
          .eq("id", caseData.id);
      }
    } finally {
      setUploading(false);
    }
  };

  // --------------------------
  // RUN VISION RECON
  // --------------------------
  const runVision = async () => {
    if (media.length === 0) {
      alert("Upload at least one image.");
      return;
    }

    setVisionLoading(true);
    setVisionError(null);
    setVisionRecon(null);

    try {
      const res = await fetch("/api/vision/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: visionContext,
          media,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setVisionError(data.error || "Vision failed.");
        return;
      }

      setVisionRecon(data);
      setVisionRaw(JSON.stringify(data, null, 2));

      // save
      await supabase
        .from("cases")
        .update({ vision: data, status: "visioned" })
        .eq("id", caseData.id);
    } catch (err: any) {
      setVisionError(err?.message || "Unknown error");
    } finally {
      setVisionLoading(false);
    }
  };

  // --------------------------
  // UI
  // --------------------------
  return (
    <section className="mt-6 border rounded-xl p-6 bg-white space-y-6">
      <h2 className="text-xl font-semibold">Vision Analysis Only</h2>
      <p className="text-sm text-gray-600">
        Upload images and generate a visual maintenance report.
      </p>

      {/* UPLOAD AREA */}
      <div>
        <h3 className="text-sm font-semibold">Upload Images</h3>

        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer text-sm ${
            isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300"
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            uploadFiles(e.dataTransfer.files);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
        >
          <p className="font-medium">Click or drag files here</p>
          <p className="text-xs text-gray-500">Images recommended</p>

          <input
            type="file"
            multiple
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={(e) => uploadFiles(e.target.files)}
          />
        </div>

        {uploading && (
          <p className="text-xs text-gray-500 mt-1">Uploading...</p>
        )}

        {media.length > 0 && (
          <ul className="mt-2 text-xs text-blue-700 space-y-1">
            {media.map((m, i) => (
              <li key={i}>
                <a href={m.url} target="_blank" className="underline">
                  Image {i + 1}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* CONTEXT */}
      <div>
        <h3 className="text-sm font-semibold mb-1">Vision Context</h3>
        <textarea
          value={visionContext}
          onChange={(e) => setVisionContext(e.target.value)}
          className="w-full border p-3 rounded text-sm"
          rows={4}
        />
      </div>

      <button
        onClick={runVision}
        disabled={visionLoading}
        className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm hover:bg-purple-700 disabled:bg-gray-400"
      >
        {visionLoading ? "Analyzing..." : "Run Vision Analysis"}
      </button>

      {visionError && (
        <p className="text-red-600 text-sm">{visionError}</p>
      )}

      {/* OUTPUT */}
      {visionRecon && (
        <div className="mt-4 space-y-4 border-t pt-4">
          <h3 className="text-sm font-semibold">Vision Summary</h3>
          <p className="text-sm text-gray-800">
            {visionRecon.vision_summary}
          </p>

          {visionRecon.hazards?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold">Hazards</h4>
              <div className="flex flex-wrap gap-2 mt-1">
                {visionRecon.hazards.map((h, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 rounded-full bg-red-100 text-red-800 text-xs"
                  >
                    ⚠ {h}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold mb-1">
              Raw Recon JSON (editable)
            </h4>
            <textarea
              value={visionRaw}
              onChange={(e) => setVisionRaw(e.target.value)}
              className="w-full border rounded p-3 bg-gray-50 font-mono text-xs"
              rows={10}
            />
          </div>
        </div>
      )}
    </section>
  );
}
