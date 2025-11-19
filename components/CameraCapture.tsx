import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (base64: string) => void;
  onRetake: () => void;
  imageData: string | null;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onRetake, imageData }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string>('');

  const startCamera = () => {
    setError('');
    setIsStreaming(true);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        // Use JPEG for smaller size
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        onCapture(base64);
        setIsStreaming(false);
      }
    }
  };

  const handleRetake = () => {
    onRetake();
    startCamera();
  };

  // Effect to handle camera stream lifecycle
  useEffect(() => {
    let currentStream: MediaStream | null = null;
    let isMounted = true;

    const initCamera = async () => {
      // Only try to start camera if we are streaming and have no image
      if (isStreaming && !imageData) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
          });
          
          if (!isMounted) {
            // Component unmounted while we were waiting for camera
            stream.getTracks().forEach(t => t.stop());
            return;
          }

          currentStream = stream;
          
          // Attach to video element if it exists
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          if (isMounted) {
            console.error("Camera Error:", err);
            setError("Camera access denied. Please allow permissions.");
            setIsStreaming(false);
          }
        }
      }
    };

    initCamera();

    // Cleanup function
    return () => {
      isMounted = false;
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isStreaming, imageData]);

  return (
    <div className="w-full">
      {imageData ? (
        <div className="relative rounded-xl overflow-hidden border-2 border-emerald-500 shadow-lg bg-slate-900 group">
          <div className="absolute top-3 left-3 z-10">
             <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-sm flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> CAPTURED
             </span>
          </div>
          <img 
            src={imageData} 
            alt="Captured Evidence" 
            className="w-full h-64 object-cover"
          />
          
          {/* Overlay for Retake */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
            <div className="absolute bottom-3 right-3">
                <button 
                    type="button" 
                    onClick={handleRetake}
                    className="bg-white text-slate-800 px-4 py-2 rounded-lg shadow-lg text-sm font-bold hover:bg-slate-100 flex items-center gap-2 transition-transform hover:scale-105"
                >
                    <RefreshCw className="w-4 h-4" /> Retake Photo
                </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative bg-slate-900 rounded-xl overflow-hidden border border-slate-200 shadow-inner h-64 flex flex-col items-center justify-center text-slate-400">
          
          {isStreaming ? (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="text-center p-6">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
                <Camera className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-sm">Camera is offline</p>
              {error && (
                <p className="text-xs text-red-400 mt-2 flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {error}
                </p>
              )}
            </div>
          )}

          {isStreaming && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center z-20">
              <button
                type="button"
                onClick={capturePhoto}
                className="bg-white rounded-full p-1 shadow-xl hover:scale-110 transition-transform"
              >
                <div className="w-14 h-14 rounded-full border-4 border-emerald-500 flex items-center justify-center">
                    <div className="w-10 h-10 bg-emerald-500 rounded-full"></div>
                </div>
              </button>
            </div>
          )}

          {!isStreaming && (
             <button
                type="button"
                onClick={startCamera}
                className="mt-4 bg-emerald-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-emerald-700 transition shadow-lg shadow-emerald-900/20"
             >
               Open Camera
             </button>
          )}
        </div>
      )}
    </div>
  );
};