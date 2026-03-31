import React, { useState, useRef, useCallback, useEffect } from 'react';
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

const ThumbnailContainer = styled.div`
  position: relative;
  width: 500px;
  height: 500px;
  margin: 2rem auto;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  background: #f5f5f5;
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

const App: React.FC = () => {
  const [video, setVideo] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const ffmpeg = createFFmpeg({ 
    log: true,
    corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
    workerPath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.worker.js'
  });

  useEffect(() => {
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
    }
  };

  const captureFrame = useCallback(async () => {
    if (!video || !videoRef.current) return;

    setLoading(true);
    setError(null);
    
    try {
      console.log('Loading FFmpeg...');
      if (!ffmpeg.isLoaded()) {
        await ffmpeg.load();
      }
      console.log('FFmpeg loaded successfully');

      const currentTime = videoRef.current.currentTime;
      const inputFileName = 'input.mp4';
      const outputFileName = 'thumbnail.png';

      ffmpeg.FS('writeFile', inputFileName, await fetchFile(video));

      // Extract frame at current timestamp with improved quality
      await ffmpeg.run(
        '-ss',
        currentTime.toString(),
        '-i',
        inputFileName,
        '-vframes',
        '1',
        '-vf',
        'scale=1000:1000:force_original_aspect_ratio=increase,crop=1000:1000',
        '-q:v',
        '2',
        outputFileName
      );

      // Read the result
      const data = ffmpeg.FS('readFile', outputFileName);
      const thumbnailUrl = URL.createObjectURL(
        new Blob([new Uint8Array(data.buffer)], { type: 'image/png' })
      );
      setThumbnail(thumbnailUrl);

      // Cleanup
      ffmpeg.FS('unlink', inputFileName);
      ffmpeg.FS('unlink', outputFileName);
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while generating the thumbnail');
    } finally {
      setLoading(false);
    }
  }, [video]);

  const handleExport = useCallback(async () => {
    if (!thumbnail) return;

    // Create a hidden canvas
    const canvas = document.createElement('canvas');
    canvas.width = 500; // Match ThumbnailContainer size
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw the image with current scale and pan
    const img = new window.Image();
    img.onload = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Set transform to match preview
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(scale, scale);
      ctx.translate(position.x, position.y);
      ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
      ctx.restore();

      // Export canvas as PNG
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
  }, [thumbnail, video, scale, position]);

  const handlePan = (dx: number, dy: number) => {
    setPosition(prev => ({
      x: Math.max(Math.min(prev.x + dx, 100), -100),
      y: Math.max(Math.min(prev.y + dy, 100), -100),
    }));
  };

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
            src={URL.createObjectURL(video)}
            controls
          />
          <Controls>
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
          <ThumbnailContainer>
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