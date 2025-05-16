import React, { useState, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import styled from 'styled-components';

const Container = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const VideoContainer = styled.div`
  margin: 20px 0;
  video {
    width: 100%;
    max-height: 500px;
    border-radius: 8px;
    background-color: #000;
  }
`;

const PreviewContainer = styled.div`
  margin: 20px 0;
  text-align: center;
`;

const ThumbnailPreview = styled.div<{ zoom: number }>`
  width: 300px;
  height: 300px;
  margin: 0 auto;
  overflow: hidden;
  border: 2px solid #4CAF50;
  border-radius: 4px;
  position: relative;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scale(${props => props.zoom});
    transform-origin: center;
    position: relative;
    transition: transform 0.2s ease-out;
  }
`;

const ImageWrapper = styled.div<{ x: number; y: number }>`
  position: absolute;
  width: 100%;
  height: 100%;
  transform: translate(${props => props.x}px, ${props => props.y}px);
  transition: transform 0.1s ease-out;
`;

const ControlsContainer = styled.div`
  margin: 20px auto;
  max-width: 300px;
`;

const SliderContainer = styled.div`
  margin: 15px 0;
  text-align: left;
`;

const SliderLabel = styled.label`
  display: block;
  margin-bottom: 5px;
  color: #666;
  font-size: 14px;
`;

const Slider = styled.input`
  width: 100%;
  margin: 10px 0;
  -webkit-appearance: none;
  height: 4px;
  border-radius: 2px;
  background: #ddd;
  outline: none;
  opacity: 0.7;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #4CAF50;
    cursor: pointer;
  }

  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #4CAF50;
    cursor: pointer;
  }
`;

const PanControls = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
  margin: 15px 0;
  max-width: 150px;
  margin: 0 auto;
`;

const PanButton = styled.button`
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px;
  cursor: pointer;
  font-size: 14px;
  
  &:hover {
    background-color: #45a049;
  }
  
  &:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
`;

const Button = styled.button`
  background-color: #4CAF50;
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin: 10px 0;
  font-size: 16px;
  &:hover {
    background-color: #45a049;
  }
  &:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
`;

const UploadInput = styled.input`
  margin: 20px 0;
  padding: 10px;
  width: 100%;
  border: 2px dashed #4CAF50;
  border-radius: 4px;
  &:hover {
    border-color: #45a049;
  }
`;

const StatusText = styled.p`
  color: #666;
  text-align: center;
  margin: 10px 0;
`;

function App() {
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [ffmpeg] = useState(() => new FFmpeg());
  const [loaded, setLoaded] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [originalFileName, setOriginalFileName] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const loadFFmpeg = async () => {
      try {
        ffmpeg.on('log', ({ message }) => {
          console.log(message);
        });
        await ffmpeg.load();
        console.log('FFmpeg is ready!');
        setLoaded(true);
      } catch (error) {
        console.error('Failed to load FFmpeg:', error);
      }
    };

    loadFFmpeg();
  }, [ffmpeg]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setThumbnailUrl(''); // Reset thumbnail when new video is uploaded
      setPosition({ x: 0, y: 0 }); // Reset position
      setZoom(1); // Reset zoom
      
      // Store the original filename without extension
      const fileName = file.name.replace(/\.[^/.]+$/, '');
      setOriginalFileName(fileName);
    }
  };

  const generateThumbnail = async () => {
    if (!videoRef.current || !loaded) return;

    setProcessing(true);
    const currentTime = videoRef.current.currentTime;
    
    try {
      const videoFile = await fetch(videoSrc).then(r => r.blob());
      await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));

      await ffmpeg.exec([
        '-ss', currentTime.toString(),
        '-i', 'input.mp4',
        '-vframes', '1',
        '-vf', 'scale=1000:1000:force_original_aspect_ratio=increase,crop=1000:1000',
        'output.jpg'
      ]);

      const data = await ffmpeg.readFile('output.jpg');
      const blob = new Blob([data], { type: 'image/jpeg' });
      
      // Update the preview
      if (thumbnailUrl) {
        URL.revokeObjectURL(thumbnailUrl);
      }
      const url = URL.createObjectURL(blob);
      setThumbnailUrl(url);
      setPosition({ x: 0, y: 0 }); // Reset position
      setZoom(1); // Reset zoom
    } catch (error) {
      console.error('Error during thumbnail generation:', error);
    } finally {
      setProcessing(false);
    }
  };

  const exportThumbnail = () => {
    if (!thumbnailUrl || !originalFileName) return;

    const a = document.createElement('a');
    a.href = thumbnailUrl;
    a.download = `${originalFileName}_thumb.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePan = (direction: 'up' | 'down' | 'left' | 'right') => {
    const step = 10;
    setPosition(prev => {
      const maxOffset = (zoom - 1) * 150; // Half of container width/height
      const newPosition = { ...prev };

      switch (direction) {
        case 'up':
          newPosition.y = Math.max(prev.y - step, -maxOffset);
          break;
        case 'down':
          newPosition.y = Math.min(prev.y + step, maxOffset);
          break;
        case 'left':
          newPosition.x = Math.max(prev.x - step, -maxOffset);
          break;
        case 'right':
          newPosition.x = Math.min(prev.x + step, maxOffset);
          break;
      }

      return newPosition;
    });
  };

  return (
    <Container>
      <h1 style={{ textAlign: 'center' }}>Video Thumbnail Generator</h1>
      <p style={{ textAlign: 'center', color: '#666' }}>
        Upload a video, pause at any frame, and export it as a 1:1 thumbnail
      </p>

      <UploadInput
        type="file"
        accept="video/*"
        onChange={handleFileUpload}
      />

      <VideoContainer>
        {videoSrc && (
          <video
            ref={videoRef}
            src={videoSrc}
            controls
            playsInline
          />
        )}
      </VideoContainer>

      {!loaded && (
        <StatusText>Loading FFmpeg.wasm...</StatusText>
      )}

      <Button
        onClick={generateThumbnail}
        disabled={!videoSrc || !loaded || processing}
        style={{ display: 'block', margin: '20px auto' }}
      >
        {processing ? 'Processing...' : 'Generate Preview'}
      </Button>

      {thumbnailUrl && (
        <PreviewContainer>
          <h3>Thumbnail Preview</h3>
          <ThumbnailPreview zoom={zoom}>
            <ImageWrapper x={position.x} y={position.y}>
              <img src={thumbnailUrl} alt="Thumbnail preview" />
            </ImageWrapper>
          </ThumbnailPreview>
          
          <ControlsContainer>
            <SliderContainer>
              <SliderLabel>Zoom: {Math.round(zoom * 100)}%</SliderLabel>
              <Slider
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={zoom}
                onChange={(e) => {
                  const newZoom = parseFloat(e.target.value);
                  setZoom(newZoom);
                  // Adjust position to stay within bounds when zooming out
                  const maxOffset = (newZoom - 1) * 150;
                  setPosition(prev => ({
                    x: Math.max(Math.min(prev.x, maxOffset), -maxOffset),
                    y: Math.max(Math.min(prev.y, maxOffset), -maxOffset)
                  }));
                }}
              />
            </SliderContainer>

            <PanControls>
              <div /> {/* Empty cell for grid layout */}
              <PanButton
                onClick={() => handlePan('up')}
                disabled={zoom === 1}
              >
                ↑
              </PanButton>
              <div /> {/* Empty cell for grid layout */}
              
              <PanButton
                onClick={() => handlePan('left')}
                disabled={zoom === 1}
              >
                ←
              </PanButton>
              <div /> {/* Center cell */}
              <PanButton
                onClick={() => handlePan('right')}
                disabled={zoom === 1}
              >
                →
              </PanButton>
              
              <div /> {/* Empty cell for grid layout */}
              <PanButton
                onClick={() => handlePan('down')}
                disabled={zoom === 1}
              >
                ↓
              </PanButton>
              <div /> {/* Empty cell for grid layout */}
            </PanControls>
          </ControlsContainer>

          <Button
            onClick={exportThumbnail}
            style={{ marginTop: '20px' }}
          >
            Export Thumbnail
          </Button>
        </PreviewContainer>
      )}
    </Container>
  );
}

export default App;