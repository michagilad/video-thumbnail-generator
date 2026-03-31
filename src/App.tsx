import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';
import styled from 'styled-components';

const AppContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  font-family: 'Arial', sans-serif;
`;

const Title = styled.h1`
  color: #333;
  text-align: center;
  margin-bottom: 2rem;
`;

const VideoContainer = styled.div`
  margin-bottom: 2rem;
`;

const Video = styled.video`
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  display: block;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const ThumbnailContainer = styled.div<{ width: number; height: number }>`
  position: relative;
  width: ${props => props.width}px;
  height: ${props => props.height}px;
  margin: 2rem auto;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  background: #f5f5f5;
  transition: width 0.3s ease, height 0.3s ease;
`;

const ThumbnailImage = styled.img<{ scale: number; x: number; y: number }>`
  position: absolute;
  left: 50%;
  top: 50%;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform-origin: center;
  transform: translate(-50%, -50%) scale(${props => props.scale}) translate(${props => props.x}px, ${props => props.y}px);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
`;

const Controls = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 500px;
  margin: 0 auto;
`;

const Button = styled.button`
  background-color: #4a90e2;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.2s;

  &:hover {
    background-color: #357abd;
  }

  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`;

const Slider = styled.input`
  width: 100%;
  margin: 1rem 0;
`;

const PanControls = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  max-width: 200px;
  margin: 0 auto;
`;

const ToggleContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin: 1rem 0;
`;

const ToggleLabel = styled.span<{ active: boolean }>`
  font-size: 0.9rem;
  font-weight: ${props => props.active ? '600' : '400'};
  color: ${props => props.active ? '#4a90e2' : '#888'};
  transition: color 0.2s, font-weight 0.2s;
  cursor: pointer;
`;

const ToggleTrack = styled.button<{ isRight: boolean }>`
  position: relative;
  width: 48px;
  height: 26px;
  background: ${props => props.isRight ? '#4a90e2' : '#4a90e2'};
  border-radius: 13px;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: background 0.2s;

  &::after {
    content: '';
    position: absolute;
    top: 3px;
    left: ${props => props.isRight ? '25px' : '3px'};
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    transition: left 0.2s ease;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  }
`;

const App: React.FC = () => {
  const [video, setVideo] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [aspectMode, setAspectMode] = useState<'square' | 'original'>('original');
  const [videoDims, setVideoDims] = useState<{ w: number; h: number }>({ w: 1, h: 1 });
  
  const videoUrl = useMemo(() => {
    if (!video) return null;
    return URL.createObjectURL(video);
  }, [video]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const ffmpegRef = useRef(
    createFFmpeg({
      log: false,
      corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
      workerPath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.worker.js',
    })
  );

  useEffect(() => {
    const ffmpeg = ffmpegRef.current;
    const loadFFmpeg = async () => {
      try {
        await ffmpeg.load();
        console.log('FFmpeg loaded successfully');
      } catch (error) {
        console.error('Error loading FFmpeg:', error);
        setError('Failed to load FFmpeg. Please check console for details.');
      }
    };
    loadFFmpeg();
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setVideo(file);
      setThumbnail(null);
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  };

  const handleVideoLoaded = () => {
    if (videoRef.current) {
      setVideoDims({
        w: videoRef.current.videoWidth,
        h: videoRef.current.videoHeight,
      });
    }
  };

  const captureFrame = useCallback(async () => {
    if (!video || !videoRef.current) return;

    const ffmpeg = ffmpegRef.current;
    setLoading(true);
    setError(null);
    
    try {
      if (!ffmpeg.isLoaded()) {
        await ffmpeg.load();
      }

      const currentTime = videoRef.current.currentTime;
      const inputFileName = 'input.mp4';
      const outputFileName = 'thumbnail.png';

      ffmpeg.FS('writeFile', inputFileName, await fetchFile(video));

      const vf = aspectMode === 'square'
        ? 'scale=1000:1000:force_original_aspect_ratio=increase,crop=1000:1000'
        : 'scale=1000:-2';

      await ffmpeg.run(
        '-ss',
        currentTime.toString(),
        '-i',
        inputFileName,
        '-vframes',
        '1',
        '-vf',
        vf,
        '-q:v',
        '2',
        outputFileName
      );

      const data = ffmpeg.FS('readFile', outputFileName);
      const thumbnailUrl = URL.createObjectURL(
        new Blob([new Uint8Array(data.buffer)], { type: 'image/png' })
      );
      setThumbnail(thumbnailUrl);

      ffmpeg.FS('unlink', inputFileName);
      ffmpeg.FS('unlink', outputFileName);
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while generating the thumbnail');
    } finally {
      setLoading(false);
    }
  }, [video, aspectMode]);

  const handleExport = useCallback(async () => {
    if (!thumbnail) return;

    const { w: cw, h: ch } = getThumbSize();
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new window.Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(scale, scale);
      ctx.translate(position.x, position.y);
      ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
      ctx.restore();

      canvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const originalFileName = video?.name || 'video';
        const baseName = originalFileName.substring(0, originalFileName.lastIndexOf('.'));
        link.download = `${baseName}_thumb.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'image/png');
    };
    img.src = thumbnail;
  }, [thumbnail, video, scale, position, aspectMode, videoDims]);

  const handlePan = (dx: number, dy: number) => {
    setPosition(prev => ({
      x: Math.max(Math.min(prev.x + dx, 100), -100),
      y: Math.max(Math.min(prev.y + dy, 100), -100),
    }));
  };

  const getThumbSize = () => {
    if (aspectMode === 'square') return { w: 500, h: 500 };
    const maxDim = 500;
    const ratio = videoDims.w / videoDims.h;
    if (ratio >= 1) return { w: maxDim, h: Math.round(maxDim / ratio) };
    return { w: Math.round(maxDim * ratio), h: maxDim };
  };

  const thumbSize = getThumbSize();

  return (
    <AppContainer>
      <Title>Video Thumbnail Generator</Title>
      
      <Controls>
        <input
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          style={{ marginBottom: '1rem' }}
        />
      </Controls>

      {video && (
        <VideoContainer>
          <Video
            ref={videoRef}
            src={videoUrl!}
            controls
            onLoadedMetadata={handleVideoLoaded}
          />
          <Controls>
            <ToggleContainer>
              <ToggleLabel
                active={aspectMode === 'square'}
                onClick={() => setAspectMode('square')}
              >
                1:1
              </ToggleLabel>
              <ToggleTrack
                isRight={aspectMode === 'original'}
                onClick={() => setAspectMode(aspectMode === 'square' ? 'original' : 'square')}
                aria-label="Toggle aspect ratio"
              />
              <ToggleLabel
                active={aspectMode === 'original'}
                onClick={() => setAspectMode('original')}
              >
                Original
              </ToggleLabel>
            </ToggleContainer>
            <Button
              onClick={captureFrame}
              disabled={loading}
            >
              {loading ? 'Generating...' : 'Capture Thumbnail'}
            </Button>
          </Controls>
        </VideoContainer>
      )}

      {thumbnail && (
        <>
          <ThumbnailContainer width={thumbSize.w} height={thumbSize.h}>
            <ThumbnailImage
              src={thumbnail}
              scale={scale}
              x={position.x}
              y={position.y}
              alt="Thumbnail"
            />
          </ThumbnailContainer>

          <Controls>
            <div>
              <label>Zoom: {scale.toFixed(1)}x</label>
              <Slider
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
              />
            </div>

            <PanControls>
              <Button onClick={() => handlePan(-10, 0)}>←</Button>
              <Button onClick={() => handlePan(0, -10)}>↑</Button>
              <Button onClick={() => handlePan(10, 0)}>→</Button>
              <div></div>
              <Button onClick={() => handlePan(0, 10)}>↓</Button>
              <div></div>
            </PanControls>

            <Button onClick={handleExport}>
              Export Thumbnail
            </Button>
          </Controls>
        </>
      )}

      {error && (
        <div style={{ color: 'red', textAlign: 'center', margin: '1rem 0' }}>
          Error: {error}
        </div>
      )}
    </AppContainer>
  );
};

export default App;