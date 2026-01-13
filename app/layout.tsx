import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Expert Agent Platform',
  description: 'AI-powered domain expertise at your fingertips',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
