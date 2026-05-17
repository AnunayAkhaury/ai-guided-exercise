import React, { useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

function clampPlaybackBox(
  viewportWidth: number,
  viewportHeight: number,
  aspectRatio: number
) {
  const safeRatio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 16 / 9;
  const isPortrait = safeRatio < 1;
  const maxWidth = Math.min(viewportWidth - 96, isPortrait ? 520 : 1280);
  const maxHeight = Math.min(viewportHeight - 200, isPortrait ? 900 : 760);

  let width = maxWidth;
  let height = width / safeRatio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * safeRatio;
  }

  return {
    width: Math.max(320, Math.round(width)),
    height: Math.max(240, Math.round(height))
  };
}

export default function RecordingDisplayWeb() {
  const { link } = useLocalSearchParams();
  const videoLink = Array.isArray(link) ? link[0] : link;
  const [aspectRatio, setAspectRatio] = useState(9 / 16);
  const [isReady, setIsReady] = useState(false);

  const viewportWidth = typeof window === 'undefined' ? 1440 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 900 : window.innerHeight;

  const box = useMemo(
    () => clampPlaybackBox(viewportWidth, viewportHeight, aspectRatio),
    [aspectRatio, viewportHeight, viewportWidth]
  );

  if (!videoLink) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 16,
          background: '#F4F3FF',
          padding: 24
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            border: 'none',
            borderRadius: 10,
            background: '#C3F5FF',
            color: '#000',
            fontWeight: 700,
            padding: '10px 14px',
            cursor: 'pointer'
          }}
        >
          ← Back
        </button>
        <div>Unable to load recording.</div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #F4F3FF 0%, #FFFFFF 100%)',
        padding: '24px 32px'
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 24
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            alignSelf: 'flex-start',
            border: 'none',
            borderRadius: 12,
            background: '#C3F5FF',
            color: '#000',
            fontWeight: 700,
            padding: '12px 16px',
            cursor: 'pointer'
          }}
        >
          ← Back
        </button>

        <div
          style={{
            flex: 1,
            minHeight: 'calc(100vh - 140px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            style={{
              width: box.width,
              maxWidth: '100%',
              borderRadius: 28,
              background: '#0A0A0A',
              padding: 16,
              boxShadow: '0 18px 40px rgba(0, 0, 0, 0.16)'
            }}
          >
            <div
              style={{
                width: '100%',
                height: box.height,
                borderRadius: 20,
                overflow: 'hidden',
                background: '#000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <video
                src={videoLink}
                controls
                autoPlay
                playsInline
                onLoadedMetadata={(event) => {
                  const element = event.currentTarget;
                  if (element.videoWidth > 0 && element.videoHeight > 0) {
                    setAspectRatio(element.videoWidth / element.videoHeight);
                  }
                  setIsReady(true);
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  background: '#000000'
                }}
              />
            </div>

            <div
              style={{
                marginTop: 12,
                fontSize: 14,
                color: '#D8D8E8',
                textAlign: 'center',
                opacity: isReady ? 0.85 : 0.6
              }}
            >
              {isReady ? 'Playback ready' : 'Loading recording...'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
