"use client";

import { useState, FormEvent } from "react";
import ReactPlayer from "react-player";
import axios from "axios";

interface VideoInfo {
  url: string;
  fileName: string;
  fileSize: number;
  surlId?: string;
}

export default function Home() {
  const [inputUrl, setInputUrl] = useState<string>("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const extractSurlId = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      const surlParam = urlObj.searchParams.get("surl");
      if (surlParam) return surlParam;

      const pathParts = urlObj.pathname.split("/");
      if (pathParts[1] === "s" && pathParts[2]) {
        return pathParts[2].startsWith("1")
          ? pathParts[2].slice(1)
          : pathParts[2];
      }
      return url.split("/").pop() || null;
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

      const apiUrl = `/api/get-link?id=${surlId}`;
      const headResponse = await axios.head(apiUrl);

      console.log("headResponse", headResponse);
      // Get metadata from custom headers
      const fileName = headResponse.headers["x-file-name"] || "video.mp4";
      const fileSize = parseInt(headResponse.headers["x-file-size"] || "0", 10);

      setVideoInfo({
        url: apiUrl,
        fileName,
        fileSize,
        surlId,
      });
    } catch (err) {
      const error = err as Error;
      console.error(error);
      setError(error.message || "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!videoInfo?.surlId) return;
    setIsDownloading(true);

    try {
      const downloadUrl = `/api/get-link?id=${videoInfo.surlId}`;

      console.log("Download URL", downloadUrl);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = videoInfo.fileName;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();

      // Remove the anchor element after a short delay
      setTimeout(() => {
        document.body.removeChild(a);
        setIsDownloading(false);
      }, 5000); // Adjust delay as needed
    } catch (err) {
      const error = err as Error;
      setError(`Download failed: ${error.message}`);
      setIsDownloading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
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

            <div className="aspect-video bg-gray-900 rounded-2xl overflow-hidden shadow-lg">
              <ReactPlayer
                url={videoInfo.url}
                controls
                width="100%"
                height="100%"
                playing={false}
                config={{
                  file: {
                    attributes: {
                      controlsList: "nodownload",
                      crossOrigin: "anonymous",
                      preload: "metadata",
                      playsInline: true,
                    },
                    forceVideo: true,
                  },
                }}
                onReady={() => console.log("Player ready")}
                onError={(e) => setError(`Video playback failed: ${e}`)}
                progressInterval={1000}
                style={{
                  backgroundColor: "#000",
                  overflow: "hidden",
                }}
                fallback={
                  <div className="text-white p-4">Loading player...</div>
                }
              />
            </div>

            <div className="space-y-6">
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="w-full py-4 px-8 bg-gradient-to-r from-green-500 to-blue-600 text-white text-lg font-semibold rounded-xl hover:from-green-600 hover:to-blue-700 transition-all"
              >
                {isDownloading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
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
                    Starting Download...
                  </span>
                ) : (
                  "💾 Download Original Video"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
