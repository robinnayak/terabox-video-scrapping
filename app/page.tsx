"use client";
import { useState, FormEvent } from "react";
import axios from "axios";

declare global {
  interface Window {
    gtag?: (...args: (string | number | boolean | object)[]) => void;
  }
}

interface VideoInfo {
  downloadUrl: string;
  fileName: string;
  fileSize: number;
}

export default function Home() {
  const [inputUrl, setInputUrl] = useState<string>("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const extractSurlId = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      return (
        urlObj.searchParams.get("surl") ||
        url.split("/").pop()?.split("?")[0] ||
        null
      );
    } catch {
      return null;
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const surlId = extractSurlId(inputUrl);
      if (!surlId) throw new Error("Invalid Terabox URL format");

      // Append format=json to force JSON response from the backend
      const response = await axios.get<VideoInfo>(
        `/api/get-link?id=${surlId}&format=json`
      );
      console.log("API Response Starting:");
      console.log("API Response:", response.data);

      if (!response.data.downloadUrl) {
        throw new Error("Failed to retrieve download URL");
      }

      setVideoInfo({
        downloadUrl: response.data.downloadUrl,
        fileName: response.data.fileName,
        fileSize: response.data.fileSize,
      });
    } catch (err) {
      const errorObj = err as Error;
      setError(errorObj.message || "Failed to retrieve video info");
      console.error("API Error:", errorObj);
    } finally {
      setLoading(false);
    }
  };

  const triggerDownload = () => {
    if (!videoInfo) return;

    const link = document.createElement("a");
    link.href = videoInfo.downloadUrl;
    link.download = videoInfo.fileName;
    link.rel = "noopener noreferrer";
    link.target = "_blank";

    // Event listeners for better tracking
    link.addEventListener("click", () => {
      console.log("Download initiated:", videoInfo.fileName);
      window.gtag?.("event", "download_start", {
        file_name: videoInfo.fileName,
        file_size: videoInfo.fileSize,
      });
    });

    link.addEventListener("error", (e) => {
      console.error("Download error:", e);
      setError("Failed to start download. Please try again.");
    });

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number): string => {
    const units = ["B", "KB", "MB", "GB", "TB"];
    if (bytes === 0) return "0 B";

    const exponent = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = bytes / Math.pow(1024, exponent);
    return `${size.toFixed(2)} ${units[exponent]}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 p-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl p-8 transition-all duration-300 hover:shadow-2xl">
        <h1 className="text-4xl font-bold mb-8 text-center bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">
          Terabox Video Downloader
        </h1>

        <form onSubmit={handleSubmit} className="flex gap-4 mb-8">
          <input
            type="url"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Paste Terabox video link"
            className="flex-1 p-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
            required
            pattern="https?://.*terabox\.(app|com).*"
            title="Please enter a valid Terabox URL"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all transform hover:scale-105"
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Loading...
              </span>
            ) : (
              "Get Video"
            )}
          </button>
        </form>

        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg border border-red-200 animate-pulse">
            ⚠️ {error}
          </div>
        )}

        {videoInfo && (
          <div className="space-y-8 animate-fade-in">
            <div className="bg-gray-50 p-6 rounded-xl border-2 border-dashed border-gray-200">
              <h2 className="text-2xl font-semibold text-gray-800 truncate mb-2">
                📹 {videoInfo.fileName}
              </h2>
              <p className="text-lg text-gray-600">
                📦 Size:{" "}
                <span className="font-medium">
                  {formatFileSize(videoInfo.fileSize)}
                </span>
              </p>
            </div>

            <div className="space-y-6">
              <button
                onClick={triggerDownload}
                className="w-full py-4 px-8 bg-gradient-to-r from-green-500 to-blue-600 text-white text-lg font-semibold rounded-xl hover:from-green-600 hover:to-blue-700 transition-all"
              >
                💾 Download Original Video
              </button>

              <p className="text-sm text-gray-500 text-center">
                Note: Downloads are handled directly by your browser.
                If the download doesn&apos;t start automatically, check your pop-up
                settings.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
