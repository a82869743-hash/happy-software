import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import { showToast } from './shared/Toast';

interface MediaItem {
  id: number;
  job_card_id: number;
  media_type: 'image' | 'video';
  stage: 'before' | 'after' | 'other';
  file_name: string;
  file_path: string;
  mime_type: string | null;
  file_size: number | null;
  caption: string | null;
  created_at: string;
}

interface Props {
  jobCardId: number | string;
}

const STAGE_CONFIG = [
  { key: 'before', label: 'Before', icon: 'photo_camera_front', color: 'text-amber-600 bg-amber-100 border-amber-200' },
  { key: 'after',  label: 'After',  icon: 'photo_camera_back',  color: 'text-emerald-600 bg-emerald-100 border-emerald-200' },
  { key: 'other',  label: 'Other',  icon: 'attach_file',        color: 'text-amber-700 bg-amber-100 border-amber-200' },
] as const;

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function JobCardMediaSection({ jobCardId }: Props) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeStage, setActiveStage] = useState<string>('all');
  const [lightboxItem, setLightboxItem] = useState<MediaItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStage, setUploadStage] = useState<'before' | 'after' | 'other'>('before');

  const fetchMedia = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/job-cards/${jobCardId}/media`);
      setMedia(res.data.data || []);
    } catch {
      // Table may not exist yet — not a critical error
      setMedia([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMedia(); }, [jobCardId]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('media', file);
      formData.append('stage', uploadStage);

      try {
        await api.post(`/job-cards/${jobCardId}/media`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        successCount++;
      } catch (err) {
        console.error('Upload failed:', file.name, err);
      }
    }

    if (successCount > 0) {
      showToast(`${successCount} file${successCount > 1 ? 's' : ''} uploaded`, 'success');
      fetchMedia();
    } else {
      showToast('Upload failed', 'error');
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const deleteMedia = async (mediaId: number) => {
    if (!confirm('Delete this media?')) return;
    try {
      await api.delete(`/job-cards/${jobCardId}/media/${mediaId}`);
      setMedia(prev => prev.filter(m => m.id !== mediaId));
      showToast('Media deleted', 'info');
    } catch {
      showToast('Failed to delete', 'error');
    }
  };

  const filteredMedia = activeStage === 'all'
    ? media
    : media.filter(m => m.stage === activeStage);

  const getThumbUrl = (item: MediaItem) => {
    if (item.file_path.startsWith('http')) return item.file_path;
    return `${BASE_URL}/${item.file_path.replace(/\\/g, '/')}`;
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-lg">photo_library</span>
          </div>
          <div>
            <h3 className="font-headline font-extrabold text-on-surface text-sm">Media & Photos</h3>
            <p className="text-[10px] text-on-surface-muted">{media.length} file{media.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Upload trigger */}
        <div className="flex items-center gap-2">
          <select
            value={uploadStage}
            onChange={e => setUploadStage(e.target.value as any)}
            className="px-2 py-1.5 text-xs font-bold border border-gray-200 rounded-lg bg-white text-on-surface-variant focus:ring-2 focus:ring-primary/20"
          >
            <option value="before">Before</option>
            <option value="after">After</option>
            <option value="other">Other</option>
          </select>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-sm">upload</span>
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={e => handleUpload(e.target.files)}
          />
        </div>
      </div>

      {/* Stage Tabs */}
      <div className="px-5 pt-3 pb-1 flex gap-2">
        {[{ key: 'all', label: 'All', count: media.length }, ...STAGE_CONFIG.map(s => ({
          key: s.key,
          label: s.label,
          count: media.filter(m => m.stage === s.key).length,
        }))].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveStage(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeStage === tab.key
                ? 'bg-primary text-white shadow-sm'
                : 'bg-gray-50 text-on-surface-variant hover:bg-gray-100'
            }`}
          >
            {tab.label} <span className="opacity-70 ml-0.5">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Media Grid */}
      <div className="p-5">
        {loading ? (
          <div className="text-center py-8">
            <div className="w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filteredMedia.length === 0 ? (
          <div className="text-center py-10 bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-200">
            <span className="material-symbols-outlined text-4xl text-gray-200 block mb-2">cloud_upload</span>
            <p className="text-sm font-bold text-on-surface-muted">No media files yet</p>
            <p className="text-xs text-on-surface-muted/60 mt-0.5">Upload before/after photos of the vehicle</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            <AnimatePresence>
              {filteredMedia.map((item, idx) => {
                const stageCfg = STAGE_CONFIG.find(s => s.key === item.stage);
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.03 }}
                    className="group relative rounded-xl overflow-hidden bg-gray-100 aspect-square cursor-pointer shadow-sm hover:shadow-md transition-all"
                    onClick={() => setLightboxItem(item)}
                  >
                    {item.media_type === 'image' ? (
                      <img
                        src={getThumbUrl(item)}
                        alt={item.caption || item.file_name}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-900">
                        <span className="material-symbols-outlined text-white text-4xl">play_circle</span>
                      </div>
                    )}

                    {/* Stage badge */}
                    <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${stageCfg?.color || 'bg-gray-100 text-gray-500'}`}>
                      {item.stage}
                    </span>

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2.5">
                      <p className="text-white text-[11px] font-medium truncate">{item.caption || item.file_name}</p>
                      {item.file_size && (
                        <p className="text-white/60 text-[10px] font-mono">{formatSize(item.file_size)}</p>
                      )}
                    </div>

                    {/* Delete btn */}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteMedia(item.id); }}
                      className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-lg flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                    >
                      <span className="material-symbols-outlined text-xs">close</span>
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightboxItem(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-w-4xl max-h-[85vh]"
              onClick={e => e.stopPropagation()}
            >
              {lightboxItem.media_type === 'image' ? (
                <img
                  src={getThumbUrl(lightboxItem)}
                  alt={lightboxItem.caption || lightboxItem.file_name}
                  className="max-w-full max-h-[85vh] object-contain rounded-xl"
                />
              ) : (
                <video
                  src={getThumbUrl(lightboxItem)}
                  controls
                  autoPlay
                  className="max-w-full max-h-[85vh] rounded-xl"
                />
              )}

              {/* Close */}
              <button
                onClick={() => setLightboxItem(null)}
                className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-50 transition-colors"
              >
                <span className="material-symbols-outlined text-on-surface text-lg">close</span>
              </button>

              {/* Info bar */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm rounded-b-xl px-4 py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-medium">{lightboxItem.caption || lightboxItem.file_name}</p>
                  <p className="text-white/50 text-[11px] font-mono">
                    {lightboxItem.stage.toUpperCase()} · {formatSize(lightboxItem.file_size)}
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

