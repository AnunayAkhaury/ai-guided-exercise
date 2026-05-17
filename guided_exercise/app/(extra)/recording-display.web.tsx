import React, { useMemo, useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { getFeedbackFromRef, Feedback } from '@/src/api/Firebase/firebase-feedback';
import { EXERCISE_TITLE_MAP } from '@/src/constants/exerciseMap';

function clampPlaybackBox(viewportWidth: number, viewportHeight: number, aspectRatio: number) {
  const safeRatio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 16 / 9;
  const isPortrait = safeRatio < 1;
  const maxWidth = Math.min(viewportWidth - 96, isPortrait ? 520 : 1280);
  const maxHeight = Math.min(viewportHeight - 340, isPortrait ? 750 : 580);

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
  const { link, title, feedbackRef } = useLocalSearchParams();
  const videoLink = Array.isArray(link) ? link[0] : link;
  const titleStr = Array.isArray(title) ? title[0] : title;
  const refId = Array.isArray(feedbackRef) ? feedbackRef[0] : feedbackRef;

  const [feedbackDocument, setFeedbackDocument] = useState<Feedback | null>(null);
  const [aspectRatio, setAspectRatio] = useState(9 / 16);
  const [isReady, setIsReady] = useState(false);

  const [currentTimeMs, setCurrentTimeMs] = useState(0);

  const viewportWidth = typeof window === 'undefined' ? 1440 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 900 : window.innerHeight;

  const box = useMemo(
    () => clampPlaybackBox(viewportWidth, viewportHeight, aspectRatio),
    [aspectRatio, viewportHeight, viewportWidth]
  );

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        const data = await getFeedbackFromRef(refId || '');
        if (data) setFeedbackDocument(data);
      } catch (err) {
        console.error('Failed to fetch feedback:', err);
      }
    };
    if (refId) fetchFeedback();
  }, [refId]);

  const activeFeedback = useMemo(() => {
    if (!feedbackDocument?.data) return null;

    return feedbackDocument.data.find((item) => {
      const start = Number(item.timestampStart);
      const end = Number(item.timestampEnd) <= start ? start + 2500 : Number(item.timestampEnd);
      return currentTimeMs >= start && currentTimeMs <= end;
    });
  }, [feedbackDocument, currentTimeMs]);

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
          padding: 24,
          fontFamily: 'sans-serif'
        }}>
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
          }}>
          ← Back
        </button>
        <div style={{ color: '#2F2A5A', fontWeight: 600 }}>Unable to load media clip.</div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #F4F3FF 0%, #FFFFFF 100%)',
        padding: '24px 32px',
        fontFamily: 'sans-serif',
        overflowY: 'auto'
      }}>
      <div
        style={{
          maxWidth: 1400,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 24
        }}>
        <button
          onClick={() => router.back()}
          style={{
            alignSelf: 'flex-start',
            border: 'none',
            borderRadius: 12,
            background: '#6155F5',
            color: '#FFF',
            fontWeight: 700,
            padding: '12px 16px',
            cursor: 'pointer',
            transition: 'opacity 0.2s'
          }}>
          ← Back
        </button>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            paddingBottom: 48
          }}>
          <div
            style={{
              width: box.width,
              maxWidth: '100%',
              borderRadius: 28,
              background: '#141226',
              padding: 20,
              boxShadow: '0 18px 40px rgba(0, 0, 0, 0.16)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14
            }}>
            {titleStr && (
              <div
                style={{
                  color: '#FFFFFF',
                  fontSize: 18,
                  fontWeight: 600,
                  padding: '0 4px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                {EXERCISE_TITLE_MAP[titleStr] || titleStr}
              </div>
            )}

            <div
              style={{
                width: '100%',
                height: box.height,
                borderRadius: 20,
                overflow: 'hidden',
                background: '#000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}>
              <video
                src={videoLink}
                controls
                autoPlay
                playsInline
                // Converts seconds timestamp down into milliseconds to evaluate schema conditions
                onTimeUpdate={(e) => setCurrentTimeMs(e.currentTarget.currentTime * 1000)}
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
                minHeight: '15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
              <div
                style={{
                  fontSize: 13,
                  color: activeFeedback ? '#FFFFFF' : '#A5A1D4',
                  textAlign: 'center',
                  fontWeight: 500,
                  lineHeight: '1.4'
                }}>
                {activeFeedback ? activeFeedback.feedback : '—'}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 4px' }}>
              {feedbackDocument ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '16px',
                    borderRadius: 16,
                    border: '1px solid rgba(255, 255, 255, 0.08)'
                  }}>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#FFFFFF',
                      borderRadius: 20,
                      fontWeight: 700,
                      marginBottom: 4
                    }}>
                    Score: {feedbackDocument.score}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: '#D8D8E8',
                      lineHeight: '1.5',
                      fontWeight: 400,
                      maxHeight: '120px',
                      overflowY: 'auto',
                      paddingRight: '4px'
                    }}>
                    {feedbackDocument.summary}
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      paddingTop: 10,
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                      fontSize: 11,
                      color: '#A3EFFF',
                      fontWeight: 600
                    }}>
                    {feedbackDocument.data.length} Reps Detected
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    fontSize: 13,
                    color: '#A5A1D4',
                    textAlign: 'center',
                    background: 'rgba(255, 255, 255, 0.03)',
                    padding: '12px',
                    borderRadius: 12
                  }}>
                  {isReady ? 'No analysis summary available.' : 'Processing summary text...'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
