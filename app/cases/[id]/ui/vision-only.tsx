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

  // ----------------------
  // STATE
  // ----------------------
  const [media, setMedia] = useState<MediaItem[]>(caseData.media || []);
  const [visionContext, setVisionContext] = useState(
    caseData.description
      ? `Job description: ${caseData.description}\n\nDescribe all visible maintenance issues objectively.`
      : "Describe visible maintenance issues in detail."
  );

  const [visionRecon, setVisionRecon] = useState<VisionRecon | null>(
    caseData.vision || null
  );

  const [visionRaw, setVisionRaw] = useState(
    caseData.vision ? JSON.stringify(caseData.vision, null, 2) : "{}"
  );

  const [visionLoading, setVisionLoading] = useState(false);
  const [visionError, setVisionError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // ----------------------
  // UPLOAD HANDLER
  // ----------------------
  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const uploaded: MediaItem[] = [];

      for (const file of Array.from(files)) {
        const res = await fetch(
          `/api/upload?filename=${encodeURIComponent(file.name)}`,
          { method: "POST", body: file }
        );

        const data = await res.json();
        if (!res.ok) continue;

        uploaded.push({
          url: data.url,
          contentType: data.contentType,
        });
      }

      if (uploaded.length > 0) {
        const newMedia = [...media, ...uploaded];
        setMedia(newMedia);

        await supabase
          .from("cases")
          .update({ media: newMedia })
          .eq("id", caseData.id);
      }
    } finally {
      setUploading(false);
    }
  };

  // ----------------------
  // RUN VISION
  // ----------------------
  const runVision = async () => {
    if (media.length === 0) {
      alert("Upload at least one image.");
      return;
    }

    setVisionLoading(true);
    setVisionError(null);

    try {
      const res = await fetch("/api/vision/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: visionContext, media }),
      });

      const data = await res.json();

      if (!res.ok) {
        setVisionError(data.error || "Vision analysis failed.");
        return;
      }

      setVisionRecon(data);
      setVisionRaw(JSON.stringify(data, null, 2));

      await supabase
        .from("cases")
        .update({ vision: data, status: "visioned" })
        .eq("id", caseData.id);
    } catch (err: any) {
      setVisionError(err?.message || "Unknown error occurred.");
    } finally {
      setVisionLoading(false);
    }
  };

  // ----------------------
  // SAFE ARRAY UTIL
  // ----------------------
  const safeArray = (value: any): string[] =>
    Array.isArray(value) ? value : [];

  // ----------------------
  // UI
  // ----------------------
  return (
    <section className="mt-6 border rounded-xl p-6 bg-white space-y-6">
      <h2 className="text-xl font-semibold">Vision Analysis</h2>
      <p className="text-sm text-gray-600">
        Upload images and generate a visual maintenance report.
      </p>

      {/* UPLOAD */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Upload Images</h3>

        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition cursor-pointer ${
            isDragging
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 bg-gray-50"
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
          <p className="text-xs text-gray-500">Images only</p>

          <input
            type="file"
            multiple
            accept="image/*"
            ref={fileInputRef}
            className="hidden"
            onChange={(e) => uploadFiles(e.target.files)}
          />
        </div>

        {uploading && <p className="text-xs mt-1">Uploading...</p>}

        {media.length > 0 && (
          <ul className="mt-2 text-xs space-y-1">
            {media.map((m, i) => (
              <li key={i}>
                <a
                  href={m.url}
                  target="_blank"
                  className="text-blue-600 underline"
                >
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
          rows={4}
          className="w-full border rounded p-3 text-sm"
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
        <p className="text-sm text-red-600">{visionError}</p>
      )}

      {/* ------------------------
          OUTPUT
      ------------------------ */}
      {visionRecon && (
        <div className="mt-6 space-y-6 border-t pt-4">
          {/* SUMMARY */}
          <div>
            <h3 className="text-sm font-semibold mb-1">Vision Summary</h3>
            <p className="text-sm text-gray-800">
              {visionRecon.vision_summary || "No summary provided."}
            </p>
          </div>

          {/* HAZARDS */}
          {safeArray(visionRecon.hazards).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold">Hazards</h3>
              <div className="flex flex-wrap gap-2 mt-2">
                {safeArray(visionRecon.hazards).map((h, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800"
                  >
                    ⚠ {h}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* RAW JSON */}
          <div>
            <h3 className="text-sm font-semibold mb-1">
              Raw Vision JSON (editable)
            </h3>
            <textarea
              value={visionRaw}
              onChange={(e) => setVisionRaw(e.target.value)}
              rows={10}
              className="w-full border rounded p-3 font-mono text-xs bg-gray-50"
            />
          </div>
        </div>
      )}
    </section>
  );
}
