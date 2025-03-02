"use client";

import { useState, FormEvent } from "react";
import ReactPlayer from "react-player";
import axios from "axios";

interface VideoInfo {
  url: string;
  fileName: string;
  fileSize: number;
}

export default function Home() {
  const [inputUrl, setInputUrl] = useState<string>("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [downloadLoading, setDownloadLoading] = useState<boolean>(false);

  const extractSurlId = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      const surlParam = urlObj.searchParams.get("surl");
      if (surlParam) return surlParam;

      const pathParts = urlObj.pathname.split("/");
      if (pathParts[1] === "s" && pathParts[2]) {
        return pathParts[2].startsWith("1") ? pathParts[2].slice(1) : pathParts[2];
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

      // Get file metadata via HEAD request
      const headResponse = await axios.head(apiUrl);
      const contentDisposition = headResponse.headers["content-disposition"];
      const filenameMatch = contentDisposition?.match(/filename\*?=UTF-8''(.+?)(;|$)/i);
      const fileName = filenameMatch ? decodeURIComponent(filenameMatch[1]) : "file";
      const fileSize = parseInt(headResponse.headers["content-length"] || "0", 10);

      setVideoInfo({
        url: apiUrl,
        fileName,
        fileSize,
      });
    } catch (err) {
      const error = err as Error;
      console.error(error);
      setError(error.message || "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  };
  const handleDownload = async () => {
    if (!videoInfo) return;
    
    setDownloadLoading(true);
    try {
      const response = await fetch(`/api/get-link?id=${videoInfo.id}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = videoInfo.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (err) {
      const error = err as Error;
      setError(`Download failed: ${error.message}`);
    } finally {
      setDownloadLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return "0 B";
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
    <div className="container">
      <h1>Terabox Video Player</h1>

      <form onSubmit={handleSubmit}>
        <input
          type="url"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          placeholder="Paste Terabox shared link"
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Processing..." : "Load Video"}
        </button>
      </form>

      {error && <div className="error">{error}</div>}

      {videoInfo && (
        <div className="player-container">
          <div className="file-info">
            <h3>{videoInfo.fileName}</h3>
            <p>Size: {formatFileSize(videoInfo.fileSize)}</p>
          </div>

          <ReactPlayer
            url={videoInfo.url}
            controls
            width="100%"
            height="auto"
            config={{
              file: {
                attributes: {
                  controlsList: "nodownload",
                  crossOrigin: "anonymous",
                },
              },
            }}
          />

          <div className="download-section">
            <a
              href={videoInfo.url}
              download={videoInfo.fileName}
              className="download-button"
              target="_blank"
              rel="noopener noreferrer"
            >
              Download Video
            </a>
          </div>
        </div>
      )}

      <style jsx>{`
        .container {
          max-width: 800px;
          margin: 2rem auto;
          padding: 1rem;
        }

        form {
          display: flex;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        input {
          flex: 1;
          padding: 0.5rem;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        button {
          padding: 0.5rem 1.5rem;
          background: #0070f3;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .error {
          color: #dc3545;
          margin: 1rem 0;
          padding: 0.5rem;
          background: #ffe6e6;
          border-radius: 4px;
        }

        .player-container {
          margin-top: 2rem;
        }

        .file-info {
          margin-bottom: 1rem;
          padding: 1rem;
          background: #f5f5f5;
          border-radius: 4px;
        }

        .file-info h3 {
          margin: 0 0 0.5rem;
          font-size: 1.1rem;
        }

        .file-info p {
          margin: 0;
          color: #666;
        }

        .download-section {
          margin-top: 1rem;
          text-align: center;
        }

        .download-button {
          display: inline-block;
          padding: 0.5rem 1.5rem;
          background: #28a745;
          color: white;
          text-decoration: none;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .download-button:hover {
          background: #218838;
        }

        @media (max-width: 600px) {
          form {
            flex-direction: column;
          }

          button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}