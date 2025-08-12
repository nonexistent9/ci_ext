export const metadata = {
  title: 'CI HQ',
  description: 'Competitive Intelligence Dashboard'
}

import Header from '../components/Header';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
        <Header />
        {children}
      </body>
    </html>
  )
}


