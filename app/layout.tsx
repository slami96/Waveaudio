import type { Metadata } from 'next';
import { Syne, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const syne = Syne({
  subsets: ['latin'],
  weight: ['400', '700', '800'],
  variable: '--font-syne',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'WAVEFORM — Audio-Reactive 3D Visualizer',
  description:
    'A real-time audio-reactive 3D visualizer built with React Three Fiber, custom GLSL shaders, and the Web Audio API. Portfolio piece by Adam Slamen.',
  openGraph: {
    title: 'WAVEFORM',
    description: 'Audio-reactive 3D visualizer by Adam Slamen.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${syne.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-black text-white antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}
