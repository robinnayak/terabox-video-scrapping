import React from "react";
import ReactPlayer from "react-player";
import { formatFileSize } from "@/utils/formatfiles";

interface VideoInfo {
  downloadUrl: string;
  fileName: string;
  fileSize: number;
}

interface VideoPlayerProps {
  videoInfo: VideoInfo;
  isLargeFile?: boolean | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  handleVideoError: (
    event: React.SyntheticEvent<HTMLVideoElement, Event>
  ) => void;
  isVideo: RegExpMatchArray | null | undefined;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoInfo,
  isLargeFile,
  videoRef,
  handleVideoError,
  isVideo,
}) => {
  // Create a ref specifically for ReactPlayer
  const reactPlayerRef = React.useRef<ReactPlayer>(null);
  
  // Log info for debugging
  console.log("videoInfo", videoInfo);
  console.log("isLargeFile", isLargeFile);
  console.log("isVideo", isVideo);

  // Function to handle ReactPlayer errors
  const handlePlayerError = (error: string ) => {
    console.error("ReactPlayer error:", error);
    // Call the original error handler if needed
    const syntheticEvent = {
      currentTarget: videoRef.current,
    } as React.SyntheticEvent<HTMLVideoElement, Event>;
    handleVideoError(syntheticEvent);
  };

  return (
    <>
      {videoInfo && (
        <>
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
                {isLargeFile && (
                  <span className="ml-2 text-amber-600 font-medium">
                    (Large File)
                  </span>
                )}
              </p>
            </div>
          </div>
          {videoInfo.downloadUrl && isVideo && (
            <div className="w-full aspect-video">
              <ReactPlayer
                ref={reactPlayerRef}
                url={videoInfo.downloadUrl}
                width="100%"
                height="100%"
                controls
                playing
                playsinline
                onError={handlePlayerError}
                config={{
                  file: {
                    attributes: {
                      controlsList: "nodownload",
                      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
                    },
                    forceVideo: true,
                    // Additional configuration for better playback
                    hlsOptions: {
                      enableWorker: true,
                      startLevel: -1, // Auto quality selection
                      autoStartLoad: true,
                    },
                  },
                }}
              />
            </div>
          )}
        </>
      )}
    </>
  );
};

export default VideoPlayer;