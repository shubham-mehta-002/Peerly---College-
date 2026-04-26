'use client';

import { useState } from 'react';

interface ImageCarouselProps {
  urls: string[];
  maxHeight?: number;
}

export function ImageCarousel({ urls, maxHeight = 480 }: ImageCarouselProps) {
  const [index, setIndex] = useState(0);

  if (urls.length === 0) return null;
  if (urls.length === 1) {
    return (
      <img
        src={urls[0]}
        alt=""
        style={{ width: '100%', maxHeight, objectFit: 'cover', borderRadius: 8, display: 'block' }}
      />
    );
  }

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex(i => (i - 1 + urls.length) % urls.length);
  };
  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex(i => (i + 1) % urls.length);
  };

  return (
    <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', userSelect: 'none' }}>
      <img
        src={urls[index]}
        alt=""
        style={{ width: '100%', maxHeight, objectFit: 'cover', display: 'block' }}
      />

      <button
        onClick={prev}
        style={{
          position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
          width: 30, height: 30, borderRadius: '50%',
          background: 'rgba(0,0,0,0.45)', border: 'none', color: '#fff',
          fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}
      >‹</button>

      <button
        onClick={next}
        style={{
          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
          width: 30, height: 30, borderRadius: '50%',
          background: 'rgba(0,0,0,0.45)', border: 'none', color: '#fff',
          fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}
      >›</button>

      <div style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 5,
      }}>
        {urls.map((_, i) => (
          <button
            key={i}
            onClick={e => { e.stopPropagation(); setIndex(i); }}
            style={{
              width: i === index ? 16 : 6, height: 6, borderRadius: 3,
              background: i === index ? '#fff' : 'rgba(255,255,255,0.45)',
              border: 'none', cursor: 'pointer', padding: 0,
              transition: 'width .2s, background .2s',
            }}
          />
        ))}
      </div>

      <div style={{
        position: 'absolute', top: 8, right: 8,
        background: 'rgba(0,0,0,0.45)', borderRadius: 99,
        fontSize: 11, color: '#fff', padding: '2px 8px',
        backdropFilter: 'blur(4px)',
      }}>
        {index + 1}/{urls.length}
      </div>
    </div>
  );
}
