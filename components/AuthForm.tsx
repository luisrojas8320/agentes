'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export default function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const supabase = createClient();
  const isMobile = useIsMobile();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        setError('Revisa tu email para confirmar tu cuenta');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push('/');
        router.refresh();
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn(
      "space-y-4",
      isMobile && "space-y-5"
    )}>
      <div>
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
          className={cn(
            "w-full transition-colors",
            isMobile 
              ? "h-12 text-base px-4 mobile-input" 
              : "h-10 text-sm"
          )}
        />
      </div>
      
      <div>
        <Input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoading}
          className={cn(
            "w-full transition-colors",
            isMobile 
              ? "h-12 text-base px-4 mobile-input" 
              : "h-10 text-sm"
          )}
        />
      </div>

      {error && (
        <div className={cn(
          "text-destructive text-center",
          isMobile ? "text-sm p-3 bg-destructive/10 rounded-lg" : "text-sm"
        )}>
          {error}
        </div>
      )}

      <Button
        type="submit"
        className={cn(
          "w-full transition-all",
          isMobile 
            ? "h-12 text-base mobile-button font-medium" 
            : "h-10 text-sm"
        )}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className={cn(
            "animate-spin",
            isMobile ? "mr-3 h-5 w-5" : "mr-2 h-4 w-4"
          )} />
        ) : null}
        {isSignUp ? 'Registrarse' : 'Iniciar sesión'}
      </Button>

      <div className={cn(
        "text-center text-muted-foreground",
        isMobile ? "text-sm pt-2" : "text-sm"
      )}>
        {isSignUp ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className={cn(
            "text-primary hover:underline transition-colors font-medium",
            isMobile && "text-base py-1"
          )}
          disabled={isLoading}
        >
          {isSignUp ? 'Inicia sesión' : 'Regístrate'}
        </button>
      </div>
    </form>
  );
}