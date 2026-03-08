import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Video Call App',
  description: 'Simple peer-to-peer video calling',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}
