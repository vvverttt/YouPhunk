'use client';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { useEffect, useRef } from 'react';

const inter = Inter({ subsets: ['latin'] });

function MatrixBackground() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = window.innerWidth;
    let height = window.innerHeight;
    const fontSize = 32;
    let columns = Math.floor(width / fontSize);
    let drops = Array(columns).fill(1).map(() => Math.random() * (height / fontSize));

    function handleResize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      columns = Math.floor(width / fontSize);
      drops = Array(columns).fill(1).map(() => Math.random() * (height / fontSize));
    }
    window.addEventListener('resize', handleResize);
    handleResize();

    function draw() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#0f0';
      ctx.font = fontSize + 'px monospace';
      for (let i = 0; i < drops.length; i++) {
        const text = String.fromCharCode(0x30A0 + Math.random() * 96);
        const drift = Math.sin(Date.now() / 1000 + i) * 2;
        ctx.fillText(text, i * fontSize + drift, drops[i] * fontSize);
        if (drops[i] * fontSize > height && Math.random() > 0.995) {
          drops[i] = 0;
        }
        drops[i] += 0.5;
      }
    }
    let intervalId;
    function animate() {
      if (!(window as any).__PAUSE_MATRIX__) {
        draw();
      }
      intervalId = setTimeout(animate, 33); // ~30fps
    }
    animate();
    return () => {
      clearTimeout(intervalId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        display: 'block',
      }}
    />
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <MatrixBackground />
        {children}
      </body>
    </html>
  );
} 