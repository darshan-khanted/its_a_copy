import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, Check } from 'lucide-react';
import { motion } from 'motion/react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageSrc: string) => void;
}

export default function CameraCaptureModal({ isOpen, onClose, onCapture }: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' }, 
        audio: false 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError('');
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      setError('Could not access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const takeSnapshot = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        onCapture(dataUrl);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-brand-dark rounded-[24px] overflow-hidden shadow-2xl max-w-sm w-full relative flex flex-col"
      >
        <div className="flex justify-between items-center p-4 bg-brand-dark z-10 border-b border-brand-light-gray/20">
          <h3 className="text-white font-bold">Take Profile Photo</h3>
          <button onClick={onClose} className="text-brand-gray hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="relative bg-black aspect-[3/4] w-full flex items-center justify-center">
          {error ? (
            <p className="text-red-400 text-sm p-4 text-center">{error}</p>
          ) : (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover scale-x-[-1]"
            />
          )}
        </div>

        <div className="p-6 bg-brand-dark flex justify-center border-t border-brand-light-gray/20">
          <button 
            onClick={takeSnapshot}
            disabled={!!error}
            className="w-16 h-16 rounded-full bg-white flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
          >
            <div className="w-14 h-14 rounded-full border-4 border-brand-dark bg-white" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
