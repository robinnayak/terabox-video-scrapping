import { useState, useRef, forwardRef, useImperativeHandle } from "react";
import ReactPlayer from "react-player";

export interface VideoPlayerProps {
  url: string;
  thumbnail?: string;
  className?: string;
  initialMuted?: boolean;
  onError?: (message: string) => void;
  onDuration?: (duration: number) => void;
}

export interface VideoPlayerRef {
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number | null;
  play: () => void;
  pause: () => void;
}

const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  (
    {
      url,
      thumbnail,
      className = "",
      initialMuted = false,
      onError,
      onDuration
    },
    ref
  ) => {
    const playerRef = useRef<ReactPlayer>(null);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Expose player methods via ref
    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        playerRef.current?.seekTo(seconds);
      },
      getCurrentTime: () => {
        return playerRef.current?.getCurrentTime() || null;
      },
      play: () => {
        const player = playerRef.current?.getInternalPlayer();
        if (player && typeof player.play === "function") {
          player.play();
        }
      },
      pause: () => {
        const player = playerRef.current?.getInternalPlayer();
        if (player && typeof player.pause === "function") {
          player.pause();
        }
      }
    }));

    const handleError = (error: string | { message: string }) => {
      const errorMessage = typeof error === "string" 
        ? error 
        : "Failed to play video";
      setError(errorMessage);
      onError?.(errorMessage);
    };

    return (
      <div className={`aspect-video bg-gray-900 rounded-2xl overflow-hidden shadow-lg ${className}`}>
        {error && (
          <div className="text-white p-4">
            ⚠️ {error}
          </div>
        )}
        <ReactPlayer
          ref={playerRef}
          url={url}
          controls
          width="100%"
          height="100%"
          playing={false}
          muted={initialMuted}
          light={thumbnail || false}
          onReady={() => setIsReady(true)}
          onError={handleError}
          onDuration={onDuration}
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
          progressInterval={1000}
          style={{
            backgroundColor: "#000",
            overflow: "hidden",
            opacity: isReady ? 1 : 0,
            transition: "opacity 0.3s ease-in-out"
          }}
          fallback={
            <div className="text-white p-4 flex items-center justify-center h-full">
              Loading video...
            </div>
          }
        />
      </div>
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";
export default VideoPlayer;