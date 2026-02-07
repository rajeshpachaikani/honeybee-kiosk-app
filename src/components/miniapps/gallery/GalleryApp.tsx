import { useState, useCallback, useEffect } from "react";
import {
  Image as ImageIcon,
  X,
  Trash2,
  AlertCircle,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface GalleryAppProps {
  onClose: () => void;
}

interface GalleryImage {
  filename: string;
  path: string;
  size: number;
  modified: number;
}

export function GalleryApp({ onClose }: GalleryAppProps) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Load image list
  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<GalleryImage[]>("list_gallery_images");
      setImages(result);
    } catch (err) {
      console.error("Failed to list images:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  // Open image viewer
  const openImage = useCallback(async (image: GalleryImage) => {
    setSelectedImage(image);
    setLoadingImage(true);
    setConfirmDelete(false);
    try {
      const data = await invoke<string>("read_gallery_image", {
        path: image.path,
      });
      setImageData(data);
    } catch (err) {
      console.error("Failed to read image:", err);
    } finally {
      setLoadingImage(false);
    }
  }, []);

  // Close viewer
  const closeViewer = useCallback(() => {
    setSelectedImage(null);
    setImageData(null);
    setConfirmDelete(false);
  }, []);

  // Delete image
  const deleteImage = useCallback(async () => {
    if (!selectedImage) return;
    setDeleting(true);
    try {
      await invoke("delete_gallery_image", { path: selectedImage.path });
      setImages((prev) => prev.filter((i) => i.path !== selectedImage.path));
      closeViewer();
    } catch (err) {
      console.error("Failed to delete image:", err);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }, [selectedImage, closeViewer]);

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format date
  const formatDate = (timestamp: number) => {
    if (!timestamp) return "";
    const d = new Date(timestamp * 1000);
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Image viewer overlay
  if (selectedImage) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/80">
          <button
            onClick={closeViewer}
            className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="text-sm">Back</span>
          </button>
          <p className="text-sm text-zinc-400 truncate max-w-[50%]">
            {selectedImage.filename}
          </p>
          <div className="w-16" />
        </div>

        {/* Image */}
        <div className="flex-1 flex items-center justify-center p-4">
          {loadingImage ? (
            <Loader2 className="h-10 w-10 text-amber-500 animate-spin" />
          ) : imageData ? (
            <img
              src={imageData}
              alt={selectedImage.filename}
              className="max-h-full max-w-full object-contain rounded-lg"
            />
          ) : (
            <p className="text-zinc-500">Failed to load image</p>
          )}
        </div>

        {/* Footer controls */}
        <div className="px-6 py-4 bg-zinc-900/80 flex items-center justify-center">
          {confirmDelete ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-zinc-400">Delete this photo?</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmDelete(false)}
                className="border-zinc-700"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={deleteImage}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Delete"
                )}
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors px-4 py-2 rounded-lg hover:bg-red-500/10"
            >
              <Trash2 className="h-5 w-5" />
              <span className="text-sm">Delete</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-6 w-6 text-violet-400" />
          <h1 className="text-lg font-semibold text-white">Gallery</h1>
          {images.length > 0 && (
            <span className="text-sm text-zinc-500">({images.length})</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 transition-all hover:bg-zinc-700 hover:text-white active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {loading ? (
          <div className="flex flex-1 items-center justify-center pt-20">
            <Loader2 className="h-10 w-10 text-amber-500 animate-spin" />
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-20 text-center">
            <AlertCircle className="h-16 w-16 text-zinc-600 mb-4" />
            <h2 className="text-lg font-medium text-zinc-400 mb-2">
              No photos yet
            </h2>
            <p className="text-sm text-zinc-600">
              Photos taken with the Camera app will appear here
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {images.map((image) => (
              <ImageThumbnail
                key={image.path}
                image={image}
                formatDate={formatDate}
                onClick={() => openImage(image)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Thumbnail component that lazy-loads the image
function ImageThumbnail({
  image,
  formatDate,
  onClick,
}: {
  image: GalleryImage;
  formatDate: (ts: number) => string;
  onClick: () => void;
}) {
  const [thumb, setThumb] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    invoke<string>("read_gallery_image", { path: image.path })
      .then((data) => {
        if (!cancelled) setThumb(data);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [image.path]);

  return (
    <button
      onClick={onClick}
      className="relative aspect-square overflow-hidden rounded-lg bg-zinc-800 group focus:outline-none focus:ring-2 focus:ring-amber-500"
    >
      {thumb ? (
        <img
          src={thumb}
          alt={image.filename}
          className={cn(
            "h-full w-full object-cover transition-all duration-300",
            loaded ? "opacity-100" : "opacity-0",
            "group-hover:scale-105"
          )}
          onLoad={() => setLoaded(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Loader2 className="h-5 w-5 text-zinc-600 animate-spin" />
        </div>
      )}
      {/* Date overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-[10px] text-zinc-300 truncate">
          {formatDate(image.modified)}
        </p>
      </div>
    </button>
  );
}

export default GalleryApp;
