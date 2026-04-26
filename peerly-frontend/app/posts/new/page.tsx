'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { ContentShell } from '@/components/content-shell';
import { Avatar } from '@/components/ui/avatar';
import { AnonLabel } from '@/components/ui/anon-label';
import { Btn } from '@/components/ui/btn';
import { useCreatePost } from '@/lib/hooks/useFeed';
import { uploadImage } from '@/lib/cloudinary';

const CHAR_LIMIT = 500;
const CLOUDINARY_OK =
  !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
  !!process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export default function CreatePostPage() {
  const [content, setContent] = useState('');
  const [isAnon, setIsAnon] = useState(false);
  const [isGlobal, setIsGlobal] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const router = useRouter();
  const createPost = useCreatePost();

  useEffect(() => {
    return () => { imagePreviews.forEach(URL.revokeObjectURL); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const imageCompression = (await import('browser-image-compression')).default;
    const files: File[] = [];
    const previews: string[] = [];
    for (const file of acceptedFiles.slice(0, 4)) {
      const compressed = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920 });
      files.push(compressed as File);
      previews.push(URL.createObjectURL(compressed));
    }
    setImageFiles(prev => [...prev, ...files].slice(0, 4));
    setImagePreviews(prev => [...prev, ...previews].slice(0, 4));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': [] }, maxFiles: 4,
  });

  const handlePublish = async () => {
    if (!content.trim()) return;
    setUploadError('');
    setUploading(true);
    try {
      const image_urls = imageFiles.length > 0
        ? await Promise.all(imageFiles.map(uploadImage))
        : [];
      createPost.mutate(
        { content: content.trim(), image_urls, is_global: isGlobal, is_anonymous: isAnon },
        { onSuccess: () => router.push('/feed') }
      );
    } catch {
      setUploadError('Image upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  };

  const isPending = uploading || createPost.isPending;
  const errorMsg = uploadError || ((createPost.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '');

  return (
    <ContentShell maxWidth={600}>
      <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--muted)', padding: 0, marginBottom: 24 }}>
        ← Cancel
      </button>

      <h1 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.3px' }}>New post</h1>

      <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '24px', marginBottom: 0, background: 'var(--card)' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Avatar name={isAnon ? '?' : 'You'} size={38} anon={isAnon} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
            {isAnon ? <AnonLabel scope={isGlobal ? 'global' : 'campus'} /> : 'You'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{isGlobal ? 'Visible globally' : 'Your campus'}</div>
        </div>
      </div>

      <textarea
        value={content} onChange={e => setContent(e.target.value.slice(0, CHAR_LIMIT))}
        placeholder="What's on your mind?"
        style={{ width: '100%', boxSizing: 'border-box', padding: '14px 0', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', fontSize: 16, lineHeight: 1.65, color: 'var(--foreground)', fontFamily: 'inherit', outline: 'none', resize: 'none', minHeight: 140 }}
      />
      <div style={{ textAlign: 'right', fontSize: 12, color: content.length > CHAR_LIMIT * 0.85 ? '#C0392B' : 'var(--muted)', marginTop: 6, marginBottom: 20 }}>
        {CHAR_LIMIT - content.length}
      </div>

      {!CLOUDINARY_OK ? (
        <div style={{ padding: '12px 16px', background: 'rgba(192,57,43,.07)', border: '1px solid rgba(192,57,43,.25)', borderRadius: 8, fontSize: 13, color: '#C0392B', marginBottom: 24 }}>
          Image uploads unavailable — Cloudinary env vars not configured.
        </div>
      ) : (
        <div style={{ marginBottom: 24 }}>
          {imagePreviews.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: imagePreviews.length === 1 ? '1fr' : 'repeat(2, 1fr)', gap: 8, marginBottom: 10 }}>
              {imagePreviews.map((url, i) => (
                <div key={i} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: imagePreviews.length === 1 ? '16/9' : '1/1', background: 'var(--border)' }}>
                  <img src={url} alt="" onClick={e => { e.stopPropagation(); setLightboxSrc(url); }} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', cursor: 'zoom-in' }} />
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setImageFiles(f => f.filter((_, j) => j !== i));
                      setImagePreviews(p => p.filter((_, j) => j !== i));
                    }}
                    style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                  >×</button>
                </div>
              ))}
              {imagePreviews.length < 4 && (
                <div {...getRootProps()} style={{ borderRadius: 10, border: `1px dashed ${isDragActive ? 'var(--accent)' : 'var(--border)'}`, aspectRatio: '1/1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: isDragActive ? 'rgba(45,106,79,.04)' : 'transparent', transition: 'all .15s', gap: 4 }}>
                  <input {...getInputProps()} />
                  <span style={{ fontSize: 22, color: 'var(--muted)', lineHeight: 1 }}>+</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Add more</span>
                </div>
              )}
            </div>
          ) : (
            <div {...getRootProps()} style={{ border: `1px dashed ${isDragActive ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, padding: '32px 20px', textAlign: 'center', cursor: 'pointer', background: isDragActive ? 'rgba(45,106,79,.04)' : 'transparent', transition: 'all .15s' }}>
              <input {...getInputProps()} />
              <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.35, lineHeight: 1 }}>🖼</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', marginBottom: 4 }}>Drag & drop images here</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>or click to browse · up to 4 images · auto-compressed to 1 MB</div>
            </div>
          )}
        </div>
      )}

      {errorMsg && (
        <div style={{ padding: '10px 14px', background: 'rgba(192,57,43,.08)', border: '1px solid #C0392B', borderRadius: 8, fontSize: 13, color: '#C0392B', marginBottom: 16 }}>
          {errorMsg}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 28 }}>
        {[
          { label: 'Post anonymously', sub: "Your name won't be shown", val: isAnon, set: setIsAnon },
          { label: 'Share globally', sub: 'Visible to all whitelisted campuses', val: isGlobal, set: setIsGlobal },
        ].map((item, i) => (
          <div key={item.label} onClick={() => item.set(!item.val)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer', background: 'var(--background)', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>{item.label}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{item.sub}</div>
            </div>
            <div style={{ width: 40, height: 22, borderRadius: 999, background: item.val ? 'var(--accent)' : 'var(--border)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: item.val ? 21 : 3, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Btn disabled={!content.trim() || isPending} size="lg" onClick={handlePublish}>
          {isPending ? (uploading ? 'Uploading…' : 'Publishing…') : 'Publish post'}
        </Btn>
      </div>

      </div>{/* end card */}

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          onClick={() => setLightboxSrc(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24, cursor: 'zoom-out',
          }}
        >
          <button
            onClick={() => setLightboxSrc(null)}
            style={{
              position: 'absolute', top: 16, right: 20,
              background: 'rgba(255,255,255,0.12)', border: 'none',
              color: '#fff', fontSize: 20, width: 36, height: 36,
              borderRadius: '50%', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
            }}
          >×</button>
          <img
            src={lightboxSrc}
            alt=""
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '100%', maxHeight: '90vh',
              borderRadius: 10, objectFit: 'contain',
              boxShadow: '0 8px 48px rgba(0,0,0,0.6)',
              cursor: 'default',
            }}
          />
        </div>
      )}
    </ContentShell>
  );
}
