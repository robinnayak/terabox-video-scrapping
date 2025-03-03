import React, { useState } from "react";

interface VideoInfo {
  surlId?: string;
  fileName: string;
  fileSize: number;
  // Include any other properties you expect from videoInfo
}

interface VideoDownloadProps {
  videoInfo: VideoInfo;
}

const VideoDownload: React.FC<VideoDownloadProps> = ({ videoInfo }) => {
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const handleDownload = () => {
    if (!videoInfo?.surlId) return;
    setIsDownloading(true);

    try {
      const downloadUrl = `/api/get-link?id=${videoInfo.surlId}`;
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
      const errorObj = err as Error;
      setError(`Download failed: ${errorObj.message}`);
      setIsDownloading(false);
    }
  };

  return (
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
      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
};

export default VideoDownload;
