import React from 'react';

export default function StudentProfileBackground() {
  return (
    <div className="absolute top-0 left-0 w-full h-[220px] overflow-hidden pointer-events-none rounded-t-[20px] z-0">
      <svg
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="wave-grad-1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#C7D2FE" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#BAE6FD" stopOpacity="0.4" />
          </linearGradient>
          
          <linearGradient id="wave-grad-2" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#818CF8" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.2" />
          </linearGradient>

          <linearGradient id="wave-grad-3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#F8FAFC" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Base light tint */}
        <rect width="1440" height="320" fill="#FCFAFF" />

        {/* Layer 1: Lilac */}
        <path
          fill="url(#wave-grad-1)"
          d="M0,64L48,96C96,128,192,192,288,197.3C384,203,480,149,576,133.3C672,117,768,139,864,154.7C960,171,1056,181,1152,176C1248,171,1344,149,1392,138.7L1440,128L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"
        />

        {/* Layer 2: Soft Purple */}
        <path
          fill="url(#wave-grad-2)"
          d="M0,192L48,176C96,160,192,128,288,112C384,96,480,96,576,122.7C672,149,768,203,864,213.3C960,224,1056,192,1152,165.3C1248,139,1344,117,1392,106.7L1440,96L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"
        />

        {/* Layer 3: Pastel Pink */}
        <path
          fill="url(#wave-grad-3)"
          d="M0,224L60,208C120,192,240,160,360,165.3C480,171,600,213,720,202.7C840,192,960,128,1080,122.7C1200,117,1320,171,1380,197.3L1440,224L1440,0L1380,0C1320,0,1200,0,1080,0C960,0,840,0,720,0C600,0,480,0,360,0C240,0,120,0,60,0L0,0Z"
        />

        {/* Thin white decorative lines */}
        <path
          fill="none"
          stroke="rgba(255, 255, 255, 0.6)"
          strokeWidth="2"
          d="M0,64L48,96C96,128,192,192,288,197.3C384,203,480,149,576,133.3C672,117,768,139,864,154.7C960,171,1056,181,1152,176C1248,171,1344,149,1392,138.7L1440,128"
          transform="translate(0, 15)"
        />
        <path
          fill="none"
          stroke="rgba(255, 255, 255, 0.4)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          d="M0,192L48,176C96,160,192,128,288,112C384,96,480,96,576,122.7C672,149,768,203,864,213.3C960,224,1056,192,1152,165.3C1248,139,1344,117,1392,106.7L1440,96"
          transform="translate(0, 10)"
        />

        {/* Luminous dots */}
        <circle cx="150" cy="80" r="3" fill="#FFF" opacity="0.8" />
        <circle cx="350" cy="120" r="4" fill="#FFF" opacity="0.6" />
        <circle cx="500" cy="50" r="2" fill="#FFF" opacity="0.9" />
        <circle cx="780" cy="160" r="5" fill="#FFF" opacity="0.5" />
        <circle cx="950" cy="90" r="3" fill="#FFF" opacity="0.7" />
        <circle cx="1200" cy="140" r="4" fill="#FFF" opacity="0.6" />
        <circle cx="1350" cy="60" r="2.5" fill="#FFF" opacity="0.8" />
      </svg>
    </div>
  );
}
