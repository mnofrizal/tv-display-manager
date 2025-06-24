import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { Button } from "@/components/ui/button";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize,
  Minimize,
  RefreshCw,
  Settings,
} from "lucide-react";
import { TV, SocketEvents, ZoomCommand } from "@/types/tv";

export default function TVDisplay() {
  const { id } = useParams<{ id: string }>();
  const tvId = id ? parseInt(id) : null;

  const [tvData, setTvData] = useState<TV | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [showPlayButton, setShowPlayButton] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  const imageRef = useRef<HTMLImageElement>(null);
  const cursorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const youtubeRef = useRef<HTMLIFrameElement>(null);
  const playButtonTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!tvId) {
      setError("ID TV tidak valid");
      setIsLoading(false);
      return;
    }

    const socketInstance = io();

    // Join TV room for real-time updates
    socketInstance.emit("joinTvDisplay", tvId);

    // Socket event listeners
    socketInstance.on("imageUpdated", (data: SocketEvents["imageUpdated"]) => {
      if (data.tvId === tvId) {
        setTvData(data.tvData);
        console.log("Gambar diperbarui secara real-time");
      }
    });

    socketInstance.on(
      "youtubeLinkUpdated",
      (data: SocketEvents["youtubeLinkUpdated"]) => {
        if (data.tvId === tvId) {
          setTvData(data.tvData);
          console.log("Tautan YouTube diperbarui secara real-time");
        }
      }
    );

    socketInstance.on("tvDeleted", (data: SocketEvents["tvDeleted"]) => {
      if (data.tvId === tvId) {
        setError("TV ini telah dihapus");
      }
    });

    socketInstance.on("zoomCommand", (data: SocketEvents["zoomCommand"]) => {
      const { command } = data;
      console.log(`Menerima perintah zoom: ${command}`);
      executeZoomCommand(command as ZoomCommand);
    });

    socketInstance.on("joinedTvRoom", (data: SocketEvents["joinedTvRoom"]) => {
      console.log(`Berhasil bergabung dengan room: ${data.roomName}`);
    });

    // Load TV data
    loadTVData();

    // Setup cursor hiding
    setupCursorHiding();

    // Cleanup
    return () => {
      socketInstance.emit("leaveTvDisplay", tvId);
      socketInstance.disconnect();
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
      if (playButtonTimeoutRef.current) {
        clearTimeout(playButtonTimeoutRef.current);
      }
    };
  }, [tvId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "F5":
        case "r":
        case "R":
          e.preventDefault();
          loadTVData();
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "d":
        case "D":
          window.open("/", "_blank");
          break;
        case "Escape":
          if (document.fullscreenElement) {
            document.exitFullscreen();
          }
          break;
        case "+":
        case "=":
          e.preventDefault();
          zoomIn();
          break;
        case "-":
        case "_":
          e.preventDefault();
          zoomOut();
          break;
        case "0":
          e.preventDefault();
          resetZoom();
          break;
        case "c":
        case "C":
          setShowControls((prev) => !prev);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const loadTVData = async () => {
    if (!tvId) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/tvs/${tvId}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError("TV tidak ditemukan");
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
        return;
      }

      const data = await response.json();
      setTvData(data);
    } catch (err) {
      console.error("Error loading TV data:", err);
      setError(
        `Gagal memuat data TV: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const setupCursorHiding = () => {
    const handleMouseMove = () => {
      setCursorVisible(true);
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
      cursorTimeoutRef.current = setTimeout(() => {
        setCursorVisible(false);
      }, 3000);
    };

    const handleTouchStart = () => {
      setCursorVisible(true);
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
      cursorTimeoutRef.current = setTimeout(() => {
        setCursorVisible(false);
      }, 3000);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("touchstart", handleTouchStart);

    // Initial hide cursor after 3 seconds
    cursorTimeoutRef.current = setTimeout(() => {
      setCursorVisible(false);
    }, 3000);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("touchstart", handleTouchStart);
    };
  };

  const executeZoomCommand = (command: ZoomCommand) => {
    switch (command) {
      case "zoomIn":
        zoomIn();
        break;
      case "zoomOut":
        zoomOut();
        break;
      case "resetZoom":
        resetZoom();
        break;
      case "fitToScreen":
        fitToScreen();
        break;
      case "stretchToScreen":
        stretchToScreen();
        break;
    }
  };

  const zoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 3));
    showZoomNotification();
  };

  const zoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
    showZoomNotification();
  };

  const resetZoom = () => {
    setZoomLevel(1);
    if (imageRef.current) {
      imageRef.current.style.objectFit = "contain";
      imageRef.current.style.width = "100%";
      imageRef.current.style.height = "100%";
    }
    showZoomNotification();
  };

  const fitToScreen = () => {
    if (imageRef.current && tvData?.image) {
      const container = imageRef.current.parentElement;
      if (container) {
        const img = new Image();
        img.onload = () => {
          const containerRect = container.getBoundingClientRect();
          const scaleX = containerRect.width / img.naturalWidth;
          const scaleY = containerRect.height / img.naturalHeight;
          setZoomLevel(Math.min(scaleX, scaleY));

          if (imageRef.current) {
            imageRef.current.style.objectFit = "contain";
          }
          showFitNotification("Fit to Screen");
        };
        img.src = imageRef.current.src;
      }
    }
  };

  const stretchToScreen = () => {
    setZoomLevel(1);
    if (imageRef.current) {
      imageRef.current.style.objectFit = "fill";
      imageRef.current.style.width = "100%";
      imageRef.current.style.height = "100%";
    }
    showFitNotification("Stretch to Screen");
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error("Error attempting to enable fullscreen:", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const showZoomNotification = () => {
    showNotification(`Zoom: ${Math.round(zoomLevel * 100)}%`);
  };

  const showFitNotification = (mode: string) => {
    showNotification(mode);
  };

  const showNotification = (message: string) => {
    // Remove existing notification
    const existing = document.querySelector(".zoom-notification");
    if (existing) {
      existing.remove();
    }

    // Create new notification
    const notification = document.createElement("div");
    notification.className =
      "zoom-notification fixed left-4 top-4 z-50 rounded-md bg-black/80 px-4 py-2 text-white";
    notification.textContent = message;
    document.body.appendChild(notification);

    // Auto remove after 2 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 2000);
  };

  const formatDateTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) {
      return "Baru saja";
    } else if (diffMins < 60) {
      return `${diffMins} menit yang lalu`;
    } else if (diffHours < 24) {
      return `${diffHours} jam yang lalu`;
    } else if (diffDays < 7) {
      return `${diffDays} hari yang lalu`;
    } else {
      return (
        date.toLocaleDateString("id-ID") +
        " " +
        date.toLocaleTimeString("id-ID")
      );
    }
  };

  const extractYoutubeVideoId = (url: string) => {
    if (!url) return null;
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-white"></div>
          <p>Memuat Tampilan TV...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="mb-4 text-6xl">⚠️</div>
          <h2 className="mb-2 text-2xl font-bold">
            {error === "TV tidak ditemukan" ? "TV Tidak Ditemukan" : "Error"}
          </h2>
          <p className="mb-4">
            {error === "TV tidak ditemukan"
              ? "Tampilan TV ini tidak ada atau telah dihapus."
              : error}
          </p>
          <Button onClick={() => window.open("/", "_blank")} variant="outline">
            Ke Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!tvData) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="mb-4 text-6xl">📺</div>
          <h2 className="mb-2 text-2xl font-bold">Tidak Ada Data</h2>
          <p>Data TV tidak tersedia</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`h-screen bg-black text-white relative overflow-hidden ${
        !cursorVisible ? "cursor-none" : ""
      }`}
    >
      {/* Main Content */}
      <div className="relative flex h-full items-center justify-center">
        {tvData.image ? (
          <div className="flex h-full w-full items-center justify-center">
            <img
              ref={imageRef}
              src={`${tvData.image}?v=${
                tvData.updatedAt ? new Date(tvData.updatedAt).getTime() : ""
              }`}
              alt={`${tvData.name} Display`}
              className="h-full w-full object-fill"
              style={{
                width: "100vw",
                height: "100vh",
                objectFit: "fill",
              }}
              onError={() => setError("Gagal memuat gambar")}
            />
          </div>
        ) : (
          <div className="text-center">
            <div className="mb-4 text-8xl">📺</div>
            <h2 className="mb-2 text-3xl font-bold">Tidak Ada Gambar</h2>
            <p className="mb-4 text-xl">Silakan unggah gambar dari dashboard</p>
            <div className="space-y-1 text-lg">
              <div>{tvData.name}</div>
              <div className="text-gray-400">ID TV: {tvData.id}</div>
            </div>
          </div>
        )}
      </div>

      {/* YouTube Player - Hidden for audio only */}
      {tvData.youtubeLink && (
        <div className="pointer-events-auto absolute -bottom-40 right-0 z-40 h-20 w-40">
          {(() => {
            const videoId = extractYoutubeVideoId(tvData.youtubeLink);
            return videoId ? (
              <iframe
                ref={youtubeRef}
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&loop=1&playlist=${videoId}&controls=0&showinfo=0&autohide=1&modestbranding=1&rel=0&enablejsapi=1`}
                className="h-full w-full rounded-lg shadow-lg"
                frameBorder="0"
                allow="autoplay; encrypted-media"
                allowFullScreen
                onLoad={() => {
                  // Only show play button if user hasn't interacted yet
                  if (!hasUserInteracted) {
                    playButtonTimeoutRef.current = setTimeout(() => {
                      if (!hasUserInteracted) {
                        setShowPlayButton(true);
                      }
                    }, 3000);
                  }
                }}
              />
            ) : null;
          })()}
        </div>
      )}

      {/* Play Button Overlay - Shows when autoplay is blocked */}
      {tvData.youtubeLink && showPlayButton && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
          <button
            onClick={() => {
              // Mark that user has interacted
              setHasUserInteracted(true);
              setShowPlayButton(false);

              // Clear any pending timeout
              if (playButtonTimeoutRef.current) {
                clearTimeout(playButtonTimeoutRef.current);
              }

              // Create a new iframe with autoplay to trigger playback
              if (youtubeRef.current && tvData.youtubeLink) {
                const videoId = extractYoutubeVideoId(tvData.youtubeLink);
                if (videoId) {
                  youtubeRef.current.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&loop=1&playlist=${videoId}&controls=0&showinfo=0&autohide=1&modestbranding=1&rel=0&enablejsapi=1`;
                }
              }
            }}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-red-600 text-2xl text-white shadow-2xl transition-colors hover:bg-red-700"
          >
            ▶️
          </button>
        </div>
      )}

      {/* Controls */}
      {showControls && (
        <div className="absolute bottom-4 left-4 right-4 rounded-lg bg-transparent p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div>
                <span className="text-gray-400">TV:</span> {tvData.name}
              </div>
              <div>
                <span className="text-gray-400">Terakhir Diperbarui:</span>{" "}
                {tvData.updatedAt
                  ? formatDateTime(new Date(tvData.updatedAt))
                  : "Tidak pernah"}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="bg-black/10" onClick={zoomIn}>
                <ZoomIn className="h-3 w-3" />
              </Button>
              <Button className="bg-black/10" size="sm" onClick={zoomOut}>
                <ZoomOut className="h-3 w-3" />
              </Button>
              <Button className="bg-black/10" size="sm" onClick={resetZoom}>
                <RotateCcw className="h-3 w-3" />
              </Button>
              <Button className="bg-black/10" size="sm" onClick={fitToScreen}>
                <Maximize className="h-3 w-3" />
              </Button>
              <Button
                className="bg-black/10"
                size="sm"
                onClick={stretchToScreen}
              >
                <Minimize className="h-3 w-3" />
              </Button>
              <Button className="bg-black/10" size="sm" onClick={loadTVData}>
                <RefreshCw className="h-3 w-3" />
              </Button>
              <Button
                className="bg-black/10"
                size="sm"
                onClick={() => window.open("/", "_blank")}
              >
                <Settings className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      {/* <div className="absolute right-4 top-4 rounded bg-black/10 p-2 text-xs text-gray-400">
        <div>F - Fullscreen | R - Refresh | D - Dashboard</div>
        <div>+/- - Zoom | 0 - Reset | C - Toggle Controls</div>
      </div> */}
    </div>
  );
}
