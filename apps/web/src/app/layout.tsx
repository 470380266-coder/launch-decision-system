import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '上架决策系统 V1',
  description: '分批到料驱动的单品上架决策系统',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

