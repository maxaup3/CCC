import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface VideoControlsProps {
  video: HTMLVideoElement;
  width: number;
  position: { x: number; y: number };
  videoUrl?: string; // 视频 URL，用于全屏播放
}

const VideoControls: React.FC<VideoControlsProps> = ({ video, width, position, videoUrl }) => {
  const [isPlaying, setIsPlaying] = useState(!video.paused);
  const [currentTime, setCurrentTime] = useState(video.currentTime);
  const [duration, setDuration] = useState(video.duration || 0);
  const [isMuted, setIsMuted] = useState(video.muted);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const fullscreenVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration || 0);
    const handleVolumeChange = () => setIsMuted(video.muted);

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('volumechange', handleVolumeChange);

    // 初始化状态
    setIsPlaying(!video.paused);
    setCurrentTime(video.currentTime);
    setDuration(video.duration || 0);
    setIsMuted(video.muted);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('volumechange', handleVolumeChange);
    };
  }, [video]);

  const togglePlay = () => {
    if (video.paused) {
      video.play().catch(err => console.error('Video play error:', err));
    } else {
      video.pause();
    }
  };

  const toggleMute = () => {
    video.muted = !video.muted;
  };

  const toggleFullscreen = () => {
    setIsFullscreen(true);
    // 暂停画布上的视频
    video.pause();
  };

  const exitFullscreen = () => {
    setIsFullscreen(false);
    // 恢复画布上的视频播放
    if (isPlaying) {
      video.play().catch(err => console.error('Video play error:', err));
    }
  };

  // 同步全屏视频的时间和状态
  useEffect(() => {
    if (isFullscreen && fullscreenVideoRef.current) {
      const fullscreenVideo = fullscreenVideoRef.current;
      fullscreenVideo.currentTime = video.currentTime;
      fullscreenVideo.muted = video.muted;
      if (isPlaying) {
        fullscreenVideo.play().catch(err => console.error('Fullscreen video play error:', err));
      }
    }
  }, [isFullscreen, isPlaying, video.currentTime, video.muted]);

  // 全屏视频的播放/暂停控制
  const toggleFullscreenPlay = () => {
    if (fullscreenVideoRef.current) {
      if (fullscreenVideoRef.current.paused) {
        fullscreenVideoRef.current.play().catch(err => console.error('Video play error:', err));
        setIsPlaying(true);
      } else {
        fullscreenVideoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  // 全屏视频静音控制
  const toggleFullscreenMute = () => {
    if (fullscreenVideoRef.current) {
      fullscreenVideoRef.current.muted = !fullscreenVideoRef.current.muted;
      video.muted = fullscreenVideoRef.current.muted;
      setIsMuted(fullscreenVideoRef.current.muted);
    }
  };

  // 全屏视频进度控制
  const handleFullscreenProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    if (fullscreenVideoRef.current) {
      fullscreenVideoRef.current.currentTime = Math.max(0, Math.min(newTime, duration));
      video.currentTime = fullscreenVideoRef.current.currentTime;
    }
  };

  // 全屏时监听视频时间更新
  useEffect(() => {
    if (isFullscreen && fullscreenVideoRef.current) {
      const handleTimeUpdate = () => {
        if (fullscreenVideoRef.current) {
          setCurrentTime(fullscreenVideoRef.current.currentTime);
          video.currentTime = fullscreenVideoRef.current.currentTime;
        }
      };
      fullscreenVideoRef.current.addEventListener('timeupdate', handleTimeUpdate);
      return () => {
        fullscreenVideoRef.current?.removeEventListener('timeupdate', handleTimeUpdate);
      };
    }
  }, [isFullscreen, video]);

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (progressBarRef.current && duration > 0) {
      const rect = progressBarRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const newTime = (clickX / rect.width) * duration;
      video.currentTime = Math.max(0, Math.min(newTime, duration));
    }
  };

  const formatTime = (time: number) => {
    if (!isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        background: 'rgba(24, 24, 24, 0.95)',
        borderRadius: 8,
        minWidth: Math.max(200, width),
        width: Math.min(width, 400),
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(10px)',
        zIndex: 1000,
      }}
    >
      {/* 播放/暂停按钮 */}
      <button
        onClick={togglePlay}
        style={{
          width: 28,
          height: 28,
          background: 'rgba(255, 255, 255, 0.1)',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
      >
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="3" y="2" width="3" height="10" rx="1" fill="rgba(255, 255, 255, 0.85)" />
            <rect x="8" y="2" width="3" height="10" rx="1" fill="rgba(255, 255, 255, 0.85)" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M4 2.5v9l7-4.5-7-4.5z" fill="rgba(255, 255, 255, 0.85)" />
          </svg>
        )}
      </button>

      {/* 时间显示 */}
      <span style={{
        fontSize: 11,
        fontFamily: 'SF Mono, monospace',
        color: 'rgba(255, 255, 255, 0.65)',
        minWidth: 35,
        flexShrink: 0,
      }}>
        {formatTime(currentTime)}
      </span>

      {/* 进度条 */}
      <div
        ref={progressBarRef}
        onClick={handleProgressClick}
        style={{
          flex: 1,
          height: 4,
          background: 'rgba(255, 255, 255, 0.2)',
          borderRadius: 2,
          cursor: 'pointer',
          position: 'relative',
          minWidth: 60,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${progress}%`,
            background: 'rgba(255, 255, 255, 0.85)',
            borderRadius: 2,
            transition: 'width 0.1s linear',
          }}
        />
        {/* 进度条圆点 */}
        <div
          style={{
            position: 'absolute',
            left: `${progress}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 10,
            height: 10,
            background: '#fff',
            borderRadius: '50%',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
          }}
        />
      </div>

      {/* 时长显示 */}
      <span style={{
        fontSize: 11,
        fontFamily: 'SF Mono, monospace',
        color: 'rgba(255, 255, 255, 0.45)',
        minWidth: 35,
        flexShrink: 0,
      }}>
        {formatTime(duration)}
      </span>

      {/* 静音按钮 */}
      <button
        onClick={toggleMute}
        style={{
          width: 28,
          height: 28,
          background: 'rgba(255, 255, 255, 0.1)',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
      >
        {isMuted ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2L4 5H2v4h2l3 3V2z" fill="rgba(255, 255, 255, 0.85)" />
            <path d="M10 5l3 3m0-3l-3 3" stroke="rgba(255, 255, 255, 0.85)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2L4 5H2v4h2l3 3V2z" fill="rgba(255, 255, 255, 0.85)" />
            <path d="M10 4.5c.7.7 1 1.5 1 2.5s-.3 1.8-1 2.5M11.5 3c1.2 1.2 1.5 2.5 1.5 4s-.3 2.8-1.5 4" stroke="rgba(255, 255, 255, 0.85)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* 全屏按钮 */}
      {videoUrl && (
        <button
          onClick={toggleFullscreen}
          style={{
            width: 28,
            height: 28,
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
          title="全屏播放"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 5V3a1 1 0 011-1h2M9 2h2a1 1 0 011 1v2M12 9v2a1 1 0 01-1 1h-2M5 12H3a1 1 0 01-1-1V9" stroke="rgba(255, 255, 255, 0.85)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {/* 全屏弹窗 */}
      {isFullscreen && videoUrl && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.95)',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              exitFullscreen();
            }
          }}
        >
          {/* 关闭按钮 */}
          <button
            onClick={exitFullscreen}
            style={{
              position: 'absolute',
              top: 20,
              right: 20,
              width: 40,
              height: 40,
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5l10 10M15 5L5 15" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          {/* 视频容器 */}
          <div
            style={{
              maxWidth: '90vw',
              maxHeight: '80vh',
              position: 'relative',
            }}
          >
            <video
              ref={fullscreenVideoRef}
              src={videoUrl}
              style={{
                maxWidth: '90vw',
                maxHeight: '80vh',
                borderRadius: 8,
              }}
              loop
              playsInline
              onClick={toggleFullscreenPlay}
            />
          </div>

          {/* 全屏控制栏 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 20px',
              background: 'rgba(24, 24, 24, 0.95)',
              borderRadius: 10,
              marginTop: 20,
              minWidth: 400,
              backdropFilter: 'blur(10px)',
            }}
          >
            {/* 播放/暂停 */}
            <button
              onClick={toggleFullscreenPlay}
              style={{
                width: 36,
                height: 36,
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
            >
              {isPlaying ? (
                <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
                  <rect x="3" y="2" width="3" height="10" rx="1" fill="white" />
                  <rect x="8" y="2" width="3" height="10" rx="1" fill="white" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
                  <path d="M4 2.5v9l7-4.5-7-4.5z" fill="white" />
                </svg>
              )}
            </button>

            {/* 时间 */}
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontFamily: 'SF Mono, monospace' }}>
              {formatTime(currentTime)}
            </span>

            {/* 进度条 */}
            <div
              onClick={handleFullscreenProgressClick}
              style={{
                flex: 1,
                height: 6,
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: 3,
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  height: '100%',
                  width: `${progress}%`,
                  background: 'white',
                  borderRadius: 3,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: `${progress}%`,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 14,
                  height: 14,
                  background: '#fff',
                  borderRadius: '50%',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                }}
              />
            </div>

            {/* 时长 */}
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: 'SF Mono, monospace' }}>
              {formatTime(duration)}
            </span>

            {/* 静音 */}
            <button
              onClick={toggleFullscreenMute}
              style={{
                width: 36,
                height: 36,
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
            >
              {isMuted ? (
                <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2L4 5H2v4h2l3 3V2z" fill="white" />
                  <path d="M10 5l3 3m0-3l-3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2L4 5H2v4h2l3 3V2z" fill="white" />
                  <path d="M10 4.5c.7.7 1 1.5 1 2.5s-.3 1.8-1 2.5M11.5 3c1.2 1.2 1.5 2.5 1.5 4s-.3 2.8-1.5 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
            </button>

            {/* 退出全屏 */}
            <button
              onClick={exitFullscreen}
              style={{
                width: 36,
                height: 36,
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
              title="退出全屏"
            >
              <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
                <path d="M5 2v2a1 1 0 01-1 1H2M12 5h-2a1 1 0 01-1-1V2M9 12V10a1 1 0 011-1h2M2 9h2a1 1 0 011 1v2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default React.memo(VideoControls);
