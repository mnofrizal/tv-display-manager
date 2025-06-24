import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Upload, Youtube, Eye, Trash2 } from "lucide-react";
import { TV, SocketEvents } from "@/types/tv";

const API_URL = "http://localhost:1286";

export default function Dashboard() {
  const [tvs, setTvs] = useState<TV[]>([]);
  const [isAddTvOpen, setIsAddTvOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isYoutubeOpen, setIsYoutubeOpen] = useState(false);
  const [currentUploadTvId, setCurrentUploadTvId] = useState<number | null>(
    null
  );
  const [currentYoutubeTvId, setCurrentYoutubeTvId] = useState<number | null>(
    null
  );
  const [newTvName, setNewTvName] = useState("");
  const [youtubeLink, setYoutubeLink] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const socketInstance = io(API_URL);

    // Load initial TV data
    loadTVs();

    // Socket event listeners
    socketInstance.on("tvAdded", (data: SocketEvents["tvAdded"]) => {
      setTvs((prev) => {
        const exists = prev.find((tv) => tv.id === data.tvData.id);
        if (!exists) {
          showNotification(
            `TV "${data.tvData.name}" ditambahkan oleh pengguna lain!`,
            "success"
          );
          return [...prev, data.tvData];
        }
        return prev;
      });
    });

    socketInstance.on("imageUpdated", (data: SocketEvents["imageUpdated"]) => {
      setTvs((prev) =>
        prev.map((tv) => (tv.id === data.tvId ? data.tvData : tv))
      );
      if (currentUploadTvId !== data.tvId) {
        showNotification(
          `Gambar TV "${data.tvData.name}" diperbarui oleh pengguna lain!`,
          "success"
        );
      }
    });

    socketInstance.on(
      "youtubeLinkUpdated",
      (data: SocketEvents["youtubeLinkUpdated"]) => {
        setTvs((prev) =>
          prev.map((tv) => (tv.id === data.tvId ? data.tvData : tv))
        );
        showNotification(
          `Tautan YouTube untuk TV "${data.tvData.name}" diperbarui.`,
          "success"
        );
      }
    );

    socketInstance.on("tvDeleted", (data: SocketEvents["tvDeleted"]) => {
      setTvs((prev) => {
        const deletedTv = prev.find((tv) => tv.id === data.tvId);
        if (deletedTv) {
          showNotification(
            `TV "${deletedTv.name}" dihapus oleh pengguna lain!`,
            "success"
          );
        }
        return prev.filter((tv) => tv.id !== data.tvId);
      });
    });

    socketInstance.on(
      "tvListUpdate",
      (tvList: SocketEvents["tvListUpdate"]) => {
        setTvs(tvList);
      }
    );

    return () => {
      socketInstance.disconnect();
    };
  }, [currentUploadTvId]);

  const loadTVs = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/api/tvs`);
      if (!response.ok) throw new Error("Failed to load TVs");
      const data = await response.json();

      // Load stored images from localStorage for each TV
      setTvs(data);
    } catch (error) {
      console.error("Error loading TVs:", error);
      showNotification("Gagal memuat daftar TV", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTvName.trim()) {
      showNotification("Nama TV wajib diisi", "error");
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/api/tvs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTvName }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Gagal menambahkan TV");
      }

      const newTv = await response.json();
      setTvs((prev) => {
        const exists = prev.find((tv) => tv.id === newTv.id);
        return exists ? prev : [...prev, newTv];
      });

      setIsAddTvOpen(false);
      setNewTvName("");
      showNotification(`TV "${newTvName}" berhasil ditambahkan!`, "success");
    } catch (error) {
      showNotification(
        error instanceof Error ? error.message : "Failed to upload image",
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0 || !currentUploadTvId) {
      showNotification("Silakan pilih file gambar", "error");
      return;
    }

    try {
      setIsLoading(true);
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append("image", file);
      });

      const response = await fetch(
        `${API_URL}/api/tvs/${currentUploadTvId}/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Gagal mengunggah gambar");
      }

      const updatedTv = await response.json();

      setTvs((prev) =>
        prev.map((tv) => (tv.id === currentUploadTvId ? updatedTv : tv))
      );

      setIsUploadOpen(false);
      setSelectedFiles([]);
      setCurrentUploadTvId(null);
      showNotification(
        `${selectedFiles.length} gambar berhasil diunggah!`,
        "success"
      );
    } catch (error) {
      showNotification(
        error instanceof Error ? error.message : "Failed to upload images",
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateYoutubeLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentYoutubeTvId) return;

    try {
      setIsLoading(true);
      const response = await fetch(
        `${API_URL}/api/tvs/${currentYoutubeTvId}/youtube`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ youtubeLink: youtubeLink.trim() }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Gagal memperbarui tautan YouTube");
      }

      const updatedTv = await response.json();
      setTvs((prev) =>
        prev.map((tv) => (tv.id === currentYoutubeTvId ? updatedTv : tv))
      );

      setIsYoutubeOpen(false);
      setYoutubeLink("");
      setCurrentYoutubeTvId(null);
      showNotification("Tautan YouTube berhasil diperbarui!", "success");
    } catch (error) {
      showNotification(
        error instanceof Error ? error.message : "Failed to set YouTube URL",
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTV = async (tvId: number) => {
    const tv = tvs.find((t) => t.id === tvId);
    if (!tv) return;

    if (
      !confirm(
        `Apakah Anda yakin ingin menghapus "${tv.name}"? Tindakan ini tidak dapat dibatalkan.`
      )
    ) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/api/tvs/${tvId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Gagal menghapus TV");
      }

      setTvs((prev) => prev.filter((t) => t.id !== tvId));
      showNotification(`TV "${tv.name}" berhasil dihapus!`, "success");
    } catch (error) {
      showNotification(
        error instanceof Error ? error.message : "Failed to delete TV",
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearImages = async (tvId: number) => {
    const tv = tvs.find((t) => t.id === tvId);
    if (!tv) return;

    if (
      !confirm(
        `Apakah Anda yakin ingin menghapus semua gambar dari "${tv.name}"?`
      )
    ) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/api/tvs/${tvId}/images`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Gagal menghapus gambar");
      }

      const updatedTv = await response.json();
      setTvs((prev) => prev.map((t) => (t.id === tvId ? updatedTv : t)));
      showNotification(
        `Semua gambar dari "${tv.name}" berhasil dihapus!`,
        "success"
      );
    } catch (error) {
      showNotification(
        error instanceof Error ? error.message : "Failed to clear images",
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const showNotification = (message: string, type: "success" | "error") => {
    // Simple notification - in a real app you'd use a toast library
    const notification = document.createElement("div");
    notification.className = `fixed top-4 right-4 p-4 rounded-md text-white z-50 ${
      type === "success" ? "bg-green-500" : "bg-red-500"
    }`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      document.body.removeChild(notification);
    }, 3000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("id-ID");
  };

  const openUploadModal = (tvId: number) => {
    setCurrentUploadTvId(tvId);
    setIsUploadOpen(true);
  };

  const openYoutubeModal = (tvId: number) => {
    const tv = tvs.find((t) => t.id === tvId);
    setCurrentYoutubeTvId(tvId);
    setYoutubeLink(tv?.youtubeLink || "");
    setIsYoutubeOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-200 to-blue-100">
      <div className="container mx-auto p-6">
        <div className="mb-8 text-center">
          <h1 className="mb-3 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-4xl font-bold text-transparent">
            DASHBOARD TV UBP SURALAYA
          </h1>
        </div>

        <div className="mb-8 flex justify-center">
          <Dialog open={isAddTvOpen} onOpenChange={setIsAddTvOpen}>
            <DialogTrigger asChild>
              <Button className="transform rounded-full bg-gradient-to-r from-blue-500 to-purple-600 px-8 py-3 text-white shadow-lg transition-all duration-300 hover:scale-105 hover:from-blue-600 hover:to-purple-700 hover:shadow-xl">
                <Plus className="mr-2 h-5 w-5" />
                Tambah TV Baru
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah TV Baru</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddTv} className="space-y-4">
                <div>
                  <Label htmlFor="tvName">Nama TV:</Label>
                  <Input
                    id="tvName"
                    value={newTvName}
                    onChange={(e) => setNewTvName(e.target.value)}
                    placeholder="contoh: TV Ruang Tamu"
                    required
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddTvOpen(false)}
                  >
                    Batal
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    Tambah TV
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {tvs.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mb-6 inline-flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-r from-gray-100 to-gray-200">
              <span className="text-4xl">📺</span>
            </div>
            <h3 className="mb-3 text-2xl font-semibold text-gray-700">
              Belum Ada TV yang Ditambahkan
            </h3>
            <p className="text-lg text-gray-500">
              Klik "Tambah TV Baru" untuk memulai mengelola TV Anda
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {tvs.map((tv) => (
              <Card
                key={tv.id}
                className="hover:shadow-3xl transform overflow-hidden rounded-2xl border-4 border-white bg-white shadow-2xl transition-all duration-300 hover:scale-105 hover:border-blue-400"
              >
                <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-blue-500/10 to-purple-500/10">
                  <CardTitle className="flex items-center gap-2 text-xl font-bold text-gray-800">
                    <div className="h-3 w-3 animate-pulse rounded-full bg-gradient-to-r from-green-400 to-green-500 uppercase"></div>
                    {tv.name}
                  </CardTitle>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-2 w-2 rounded-full bg-green-400"></div>
                      <span className="font-medium text-gray-600">Dibuat:</span>
                      <span className="text-gray-700">
                        {formatDate(tv.createdAt)}
                      </span>
                    </div>
                    {tv.updatedAt && (
                      <div className="flex items-center gap-2 text-sm">
                        <div className="h-2 w-2 rounded-full bg-orange-400"></div>
                        <span className="font-medium text-gray-600">
                          Terakhir Diperbarui:
                        </span>
                        <span className="text-gray-700">
                          {formatDate(tv.updatedAt)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 rounded-lg border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-3">
                    <div className="mb-1 text-sm font-medium text-blue-800">
                      URL Tampilan:
                    </div>
                    <a
                      href={`${window.location.origin}/tv/${tv.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-sm text-blue-600 transition-colors hover:text-blue-800 hover:underline"
                    >
                      {window.location.origin}/tv/{tv.id}
                    </a>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6 p-6">
                  <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border-2 border-gray-200 bg-gradient-to-br from-gray-100 to-gray-200 shadow-inner">
                    {tv.images && tv.images.length > 0 ? (
                      <>
                        <img
                          src={`${API_URL}${tv.images[0]}?v=${
                            tv.updatedAt ? new Date(tv.updatedAt).getTime() : ""
                          }`}
                          alt={`Gambar TV ${tv.id}`}
                          className="h-full w-full rounded-lg object-cover"
                        />
                        {tv.images.length > 1 && (
                          <div className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white">
                            +{tv.images.length - 1} lainnya
                          </div>
                        )}
                      </>
                    ) : tv.image ? (
                      <img
                        src={`${API_URL}${tv.image}?v=${
                          tv.updatedAt ? new Date(tv.updatedAt).getTime() : ""
                        }`}
                        alt={`Gambar TV ${tv.id}`}
                        className="h-full w-full rounded-lg object-cover"
                      />
                    ) : (
                      <div className="text-center text-gray-500">
                        <div className="mb-3 text-4xl opacity-50">📷</div>
                        <div className="font-medium">
                          Belum ada gambar yang diunggah
                        </div>
                        <div className="mt-1 text-sm opacity-75">
                          Klik "Unggah Gambar" untuk menambahkan
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      size="sm"
                      onClick={() => openUploadModal(tv.id)}
                      className="border-0 bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md transition-all duration-200 hover:from-green-600 hover:to-emerald-700 hover:shadow-lg"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Unggah Gambar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => openYoutubeModal(tv.id)}
                      className="border-0 bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-md transition-all duration-200 hover:from-red-600 hover:to-pink-700 hover:shadow-lg"
                    >
                      <Youtube className="mr-2 h-4 w-4" />
                      YouTube
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => window.open(`/tv/${tv.id}`, "_blank")}
                      className="border-0 bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-md transition-all duration-200 hover:from-blue-600 hover:to-cyan-700 hover:shadow-lg"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Lihat TV
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleDeleteTV(tv.id)}
                      className="border-0 bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md transition-all duration-200 hover:from-red-700 hover:to-red-800 hover:shadow-lg"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Hapus
                    </Button>
                  </div>
                  {tv.images && tv.images.length > 0 && (
                    <div className="mt-4">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="w-full"
                        onClick={() => handleClearImages(tv.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Hapus Semua Gambar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Upload Modal */}
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogContent className="rounded-2xl border-0 bg-white/95 shadow-2xl backdrop-blur-sm">
            <DialogHeader className="pb-4 text-center">
              <DialogTitle className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-2xl font-bold text-transparent">
                Unggah Gambar
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUploadImage} className="space-y-6">
              <div className="space-y-3">
                <Label
                  htmlFor="imageFile"
                  className="text-lg font-semibold text-gray-700"
                >
                  Pilih Gambar:
                </Label>
                <Input
                  id="imageFile"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setSelectedFiles(files);
                  }}
                  required
                  className="rounded-xl border-2 border-dashed border-gray-300 p-4 transition-colors hover:border-green-400"
                />
                <div className="rounded-lg border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-3">
                  <p className="text-sm font-medium text-green-800">
                    Format yang didukung: JPG, PNG, GIF, WebP (Maks: 10MB per
                    file)
                  </p>
                  <p className="mt-1 text-xs text-green-700">
                    Pilih beberapa gambar untuk slideshow otomatis
                  </p>
                </div>
              </div>
              {selectedFiles.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-lg font-semibold text-gray-700">
                    Preview ({selectedFiles.length} gambar):
                  </Label>
                  <div className="grid max-h-60 grid-cols-2 gap-3 overflow-y-auto">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="aspect-video overflow-hidden rounded-lg border-2 border-gray-200 bg-gradient-to-br from-gray-100 to-gray-200 shadow-inner"
                      >
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Preview ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsUploadOpen(false)}
                  className="border-gray-300 px-6 py-2 transition-colors hover:bg-gray-50"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-2 text-white shadow-lg transition-all duration-200 hover:from-green-600 hover:to-emerald-700 hover:shadow-xl"
                >
                  {isLoading
                    ? "Mengunggah..."
                    : selectedFiles.length > 1
                    ? `Unggah ${selectedFiles.length} Gambar`
                    : "Unggah Gambar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* YouTube Modal */}
        <Dialog open={isYoutubeOpen} onOpenChange={setIsYoutubeOpen}>
          <DialogContent className="rounded-2xl border-0 bg-white/95 shadow-2xl backdrop-blur-sm">
            <DialogHeader className="pb-4 text-center">
              <DialogTitle className="bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-2xl font-bold text-transparent">
                Tambah/Ubah Tautan YouTube
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdateYoutubeLink} className="space-y-6">
              <div className="space-y-3">
                <Label
                  htmlFor="youtubeLink"
                  className="text-lg font-semibold text-gray-700"
                >
                  Tautan YouTube:
                </Label>
                <Input
                  id="youtubeLink"
                  type="url"
                  value={youtubeLink}
                  onChange={(e) => setYoutubeLink(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="rounded-xl border-2 border-gray-300 p-4 transition-colors hover:border-red-400 focus:border-red-500"
                />
                <div className="rounded-lg border border-red-200 bg-gradient-to-r from-red-50 to-pink-50 p-3">
                  <p className="text-sm font-medium text-red-800">
                    Kosongkan untuk menghapus video.
                  </p>
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsYoutubeOpen(false)}
                  className="border-gray-300 px-6 py-2 transition-colors hover:bg-gray-50"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-gradient-to-r from-red-500 to-pink-600 px-6 py-2 text-white shadow-lg transition-all duration-200 hover:from-red-600 hover:to-pink-700 hover:shadow-xl"
                >
                  {isLoading ? "Menyimpan..." : "Simpan"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
