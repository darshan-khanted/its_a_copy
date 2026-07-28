/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { CheckCircle, Sparkles, Calendar, MapPin, Eye, Home, Lightbulb } from 'lucide-react';
import { ActiveView, Gig } from '../types';
import { getCategoryGraphic, getFallbackSvg } from '../utils/graphic';
import { formatTimestampToDDMMYY } from '../utils/date';

interface PublishedViewProps {
  publishedGig: Gig | null;
  onNavigate: (view: ActiveView) => void;
  onNavigateToGig: (gig: Gig) => void;
}

export default function PublishedView({ publishedGig, onNavigate, onNavigateToGig }: PublishedViewProps) {
  const [confetti, setConfetti] = useState<{ id: number; left: number; delay: number; color: string }[]>([]);

  useEffect(() => {
    // Generate lovely falling confetti triggers
    const colors = ['#4f46e5', '#10b981', '#fbbf24', '#4f46e5', '#059669'];
    const generated = Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setConfetti(generated);
  }, [publishedGig]);

  return (
    <div className="w-full min-h-screen bg-brand-bg pt-20 pb-16 relative overflow-hidden text-center flex flex-col items-center">
      
      {/* Falling confetti canvas */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
        {confetti.map((c) => (
          <div
            key={c.id}
            className="absolute rounded-sm animate-[fall_4s_ease-out_infinite]"
            style={{
              left: `${c.left}%`,
              width: '8px',
              height: '8px',
              backgroundColor: c.color,
              animationDelay: `${c.delay}s`,
              top: '-10px',
              opacity: 0.8,
            }}
          />
        ))}
      </div>

      <div className="max-w-md mx-auto px-4 z-20 flex flex-col gap-6">
        
        {/* Success Icon */}
        <div className="flex justify-center pt-4">
          <div className="relative">
            <div className="w-24 h-24 bg-brand-mint rounded-full flex items-center justify-center shadow-lg shadow-brand-mint/30 animate-pulse">
              <CheckCircle className="w-12 h-12 text-brand-mint-dark" />
            </div>
            {/* Sparks */}
            <Sparkles className="absolute -top-3 -right-3 text-brand-accent w-6 h-6 animate-bounce" />
          </div>
        </div>

        {/* Header content */}
        <div>
          <h1 className="text-3xl font-extrabold text-brand-primary tracking-tight">Gig Published!</h1>
          <p className="text-xs text-brand-gray mt-2 leading-relaxed">
            Your service is now live and visible to thousands of seekers across the community.
          </p>
        </div>

        {/* Gig Summary Card */}
        {publishedGig && (
          <div className="bg-white rounded-2xl p-4 text-left border border-brand-light-gray shadow-md flex gap-3 relative">
            <img 
              src={
                (!publishedGig.imageUrl || publishedGig.imageUrl.trim() === "" || publishedGig.imageUrl === "null" || publishedGig.imageUrl === "undefined")
                  ? getCategoryGraphic(publishedGig.category, publishedGig.title)
                  : publishedGig.imageUrl
              } 
              alt={publishedGig.title} 
              className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-brand-light-gray"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = getFallbackSvg(publishedGig.category, publishedGig.title);
              }}
            />
            
            <div className="flex-grow">
              <div className="flex justify-between items-start gap-1">
                <div>
                  <h3 className="font-bold text-xs text-brand-dark line-clamp-1 leading-snug">{publishedGig.title}</h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="bg-brand-mint text-brand-mint-dark text-[8px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-full">
                      Verified
                    </span>
                    {publishedGig.category && publishedGig.category !== 'Specialized Task' && (
                      <span className="text-[10px] text-brand-gray font-semibold">{publishedGig.category}</span>
                    )}
                  </div>
                </div>
                <div className="bg-brand-primary/10 text-brand-primary font-extrabold text-[11px] px-2.5 py-1 rounded-lg shrink-0">
                  ₹{publishedGig.price.toLocaleString()}
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-brand-light-gray flex gap-4 text-[10px] text-brand-gray font-semibold">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-brand-primary" />
                  <span>Posted: {publishedGig.createdAt 
                    ? formatTimestampToDDMMYY(publishedGig.createdAt)
                    : formatTimestampToDDMMYY(Date.now())}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-brand-primary" />
                  <span>Locality: {publishedGig.suburb || "My Location"}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action button rows */}
        <div className="flex flex-col gap-3">
          {publishedGig && (
            <button
              onClick={() => onNavigateToGig(publishedGig)}
              className="w-full py-4 bg-brand-primary text-white font-extrabold text-sm rounded-xl shadow-lg shadow-brand-primary/20 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>View My Gig</span>
            </button>
          )}

          <button
            onClick={() => onNavigate(ActiveView.HOME)}
            className="w-full py-4 bg-white border border-brand-primary text-brand-primary font-bold text-sm rounded-xl hover:bg-brand-light-gray/20 transition-all flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span>Go to Home</span>
          </button>
        </div>

        {/* Pro Tip Card */}
        <div className="bg-yellow-50 border border-yellow-250 p-4 rounded-2xl flex items-start gap-3.5 text-left shadow-sm">
          <div className="p-2 bg-yellow-100 rounded-lg text-yellow-700">
            <Lightbulb className="w-5 h-5 fill-yellow-500 text-yellow-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-yellow-800 uppercase tracking-wider">Pro Tip</p>
            <p className="text-xs text-yellow-800/90 leading-relaxed mt-0.5">
              Gigs with high-quality images receive 4x more inquiries. Share your gig on social media to boost visibility!
            </p>
          </div>
        </div>

        {/* Minimal Footer */}
        <footer className="py-4 text-[9px] text-brand-gray/60 mt-4">
          <p>© 2026 Qwick Gig Marketplace. All rights reserved.</p>
        </footer>

      </div>

      <style>{`
        @keyframes fall {
          0% {
            transform: translateY(-20px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>

    </div>
  );
}
