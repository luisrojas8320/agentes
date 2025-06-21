import AuthForm from '@/components/AuthForm';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      {/* Contenedor responsive */}
      <div className={cn(
        "w-full space-y-8 rounded-lg border border-border bg-card",
        // Mobile: casi full width con padding lateral
        "mx-4 max-w-md p-6",
        // Desktop: tamaño fijo con más padding
        "sm:mx-auto sm:max-w-md sm:p-8"
      )}>
        {/* Header responsive */}
        <div className="text-center space-y-2">
          <h1 className={cn(
            "font-bold",
            // Mobile: texto más pequeño
            "text-3xl",
            // Desktop: texto más grande
            "sm:text-4xl"
          )}>
            AI Playground
          </h1>
          <p className={cn(
            "text-muted-foreground",
            // Mobile: texto más pequeño y mejor espaciado
            "mt-3 text-sm leading-relaxed",
            // Desktop: texto normal
            "sm:mt-2 sm:text-base"
          )}>
            Inicia sesión para continuar
          </p>
        </div>
        
        {/* Form con espaciado responsive */}
        <div className={cn(
          // Mobile: menos padding vertical
          "pt-2",
          // Desktop: padding normal
          "sm:pt-0"
        )}>
          <AuthForm />
        </div>
      </div>
      
      {/* Footer opcional para mobile */}
      <div className={cn(
        "text-center mt-8 px-4",
        "sm:hidden" // Solo visible en mobile
      )}>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Plataforma de interacción con agentes IA
        </p>
      </div>
    </div>
  );
}