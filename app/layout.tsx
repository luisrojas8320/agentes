import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';

export const metadata: Metadata = {
  title: 'AI Playground',
  description: 'Plataforma de interacción con agentes IA con herramientas avanzadas',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false, // Evita zoom en iOS al hacer focus en inputs
  },
  themeColor: '#3b82f6',
  // Metadatos adicionales para PWA
  applicationName: 'AI Playground',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AI Playground',
  },
  formatDetection: {
    telephone: false, // Evita que los números se conviertan en enlaces
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Preload fonts para mejor performance */}
        <link 
          rel="preload" 
          href="https://fonts.googleapis.com/css2?family=Questrial:wght@400&display=swap" 
          as="style"
        />
        <link
          rel="preconnect" 
          href="https://fonts.googleapis.com" 
        />
        <link 
          rel="preconnect" 
          href="https://fonts.gstatic.com" 
          crossOrigin="anonymous" 
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Questrial:wght@400&display=swap"
          rel="stylesheet"
        />
        
        {/* Meta tags adicionales para mobile */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="AI Playground" />
        
        {/* Evitar zoom en inputs en iOS */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        
        {/* Evitar el bounce en iOS */}
        <meta name="format-detection" content="telephone=no" />
        
        {/* Favicon y íconos para dispositivos móviles */}
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        
        {/* Tema para navegadores móviles */}
        <meta name="theme-color" content="#1a1a1a" />
        <meta name="msapplication-navbutton-color" content="#1a1a1a" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="questrial-font antialiased overflow-x-hidden">
        <ThemeProvider 
          attribute="class" 
          defaultTheme="dark" 
          enableSystem={false}
          storageKey="ai-playground-theme"
        >
          {/* Wrapper principal con protección contra overflow horizontal */}
          <div className="min-h-screen bg-background text-foreground">
            {children}
          </div>
        </ThemeProvider>
        
        {/* Script para prevenir zoom en iOS */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              document.addEventListener('gesturestart', function (e) {
                e.preventDefault();
              });
              
              // Prevenir doble tap zoom
              let lastTouchEnd = 0;
              document.addEventListener('touchend', function (event) {
                const now = (new Date()).getTime();
                if (now - lastTouchEnd <= 300) {
                  event.preventDefault();
                }
                lastTouchEnd = now;
              }, false);
              
              // Mejorar el scroll en iOS
              document.addEventListener('touchmove', function(e) {
                if (e.scale !== 1) { 
                  e.preventDefault(); 
                }
              }, { passive: false });
            `,
          }}
        />
      </body>
    </html>
  );
}