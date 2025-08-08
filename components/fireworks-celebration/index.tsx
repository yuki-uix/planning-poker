"use client";

import React from "react";
import { Sparkles, Star, Award } from "lucide-react";
import { useFireworksCelebration } from "./useFireworksCelebration";
import type { FireworksCelebrationProps } from "./types";

export function FireworksCelebration(props: FireworksCelebrationProps) {
  const { t, isActive } = useFireworksCelebration(props);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-[20000] pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20 animate-pulse" />
      
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 15 }, (_, i) => (
          <div
            key={i}
            className="absolute animate-bounce"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${1 + Math.random()}s`,
            }}
          >
            {i % 3 === 0 ? (
              <Sparkles 
                className="w-6 h-6 text-yellow-400 animate-spin" 
                style={{ animationDuration: '1s' }}
              />
            ) : i % 3 === 1 ? (
              <Star 
                className="w-5 h-5 text-blue-400 animate-pulse" 
              />
            ) : (
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-ping" />
            )}
          </div>
        ))}
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 max-w-md mx-4 text-center animate-in slide-in-from-bottom-4 duration-700">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
            <Award className="w-8 h-8 text-white" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t.celebration?.title || "Congratulations! 🎉"}
          </h2>
          
          <p className="text-gray-600 mb-4">
            {t.celebration?.message || "You've completed the guided tour! You're now ready to host your first planning poker session."}
          </p>
          
          <div className="flex justify-center space-x-1">
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes firework {
          0% { transform: scale(0) rotate(0deg); opacity: 1; }
          50% { transform: scale(1.2) rotate(180deg); opacity: 0.8; }
          100% { transform: scale(0) rotate(360deg); opacity: 0; }
        }
        .firework {
          animation: firework 2s ease-out infinite;
        }
      `}</style>
    </div>
  );
}