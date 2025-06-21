'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { 
  Search,
  Globe, 
  FileText, 
  Image,
  Zap,
  Database,
  Settings,
  ChevronDown,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { cn } from '@/lib/utils';

interface MCPStatus {
  initialized: boolean;
  available_tools?: number;
  available_resources?: number;
}

interface ToolsMenuProps {
  onToolSelect?: (tool: string) => void;
}

export default function ToolsMenu({ onToolSelect }: ToolsMenuProps) {
  const [mcpStatus, setMcpStatus] = useState<MCPStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchMCPStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        const response = await fetch(`${apiUrl}/api/mcp/status`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        
        if (response.ok) {
          const status = await response.json();
          setMcpStatus(status);
        }
      } catch (error) {
        console.error('Error obteniendo estado MCP:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMCPStatus();
  }, [supabase]);

  const tools = [
    {
      name: 'Búsqueda web',
      icon: <Globe className="h-4 w-4" />,
      description: 'Busca información actualizada en internet',
      active: true,
      action: () => onToolSelect?.('Busca información sobre ')
    },
    {
      name: 'Análisis de URLs',
      icon: <Image className="h-4 w-4" />,
      description: 'Extrae texto de imágenes y PDFs desde URLs',
      active: true,
      action: () => onToolSelect?.('Analiza el contenido de esta URL: ')
    },
    {
      name: 'Búsqueda en documentos',
      icon: <FileText className="h-4 w-4" />,
      description: 'Busca en tus documentos personales',
      active: true,
      action: () => onToolSelect?.('Busca en mis documentos información sobre ')
    },
    {
      name: 'Herramientas MCP',
      icon: <Zap className="h-4 w-4" />,
      description: `${mcpStatus?.available_tools || 0} herramientas disponibles`,
      active: mcpStatus?.initialized || false,
      action: () => onToolSelect?.('Obtén estadísticas del sistema MCP')
    },
    {
      name: 'Base de datos',
      icon: <Database className="h-4 w-4" />,
      description: 'Estadísticas y métricas del sistema',
      active: true,
      action: () => onToolSelect?.('Muéstrame las estadísticas de la plataforma')
    }
  ];

  const activeToolsCount = tools.filter(tool => tool.active).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-2 bg-muted/30 hover:bg-muted/50 text-foreground/80 hover:text-foreground border-0"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Herramientas</span>
          <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
            {activeToolsCount}
          </Badge>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80 bg-card/95 backdrop-blur border-border/50">
        <DropdownMenuLabel className="font-semibold text-foreground/90">
          Herramientas disponibles
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {loading ? (
          <DropdownMenuItem disabled className="p-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border border-foreground/30 border-t-foreground/80 rounded-full animate-spin" />
              <span className="text-foreground/60">Cargando herramientas...</span>
            </div>
          </DropdownMenuItem>
        ) : (
          <>
            {tools.map((tool, index) => (
              <DropdownMenuItem
                key={index}
                onClick={tool.action}
                disabled={!tool.active}
                className={cn(
                  "flex flex-col items-start gap-1 p-3 cursor-pointer",
                  !tool.active && "opacity-50"
                )}
              >
                <div className="flex items-center gap-3 w-full">
                  <div className={cn(
                    "flex-shrink-0",
                    tool.active ? "text-foreground/80" : "text-foreground/40"
                  )}>
                    {tool.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground/90">
                        {tool.name}
                      </span>
                      {tool.active ? (
                        <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-foreground/40 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-foreground/60 mt-0.5">
                      {tool.description}
                    </p>
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem className="p-3 cursor-pointer">
              <div className="flex items-center gap-3 w-full">
                <Settings className="h-4 w-4 text-foreground/60" />
                <div className="flex-1">
                  <span className="font-medium text-sm text-foreground/90">
                    Configuración avanzada
                  </span>
                  <p className="text-xs text-foreground/60 mt-0.5">
                    Gestionar todas las herramientas y conexiones
                  </p>
                </div>
              </div>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}