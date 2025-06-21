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
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();
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
          size={isMobile ? "sm" : "sm"}
          className={cn(
            "gap-2 bg-muted/30 hover:bg-muted/50 text-foreground/80 hover:text-foreground border-0",
            isMobile ? "h-9 px-3 text-sm" : "h-auto px-3 py-2"
          )}
        >
          <Search className={isMobile ? "h-3.5 w-3.5" : "h-4 w-4"} />
          <span className={cn(
            isMobile ? "text-xs" : "text-sm",
            !isMobile && "hidden sm:inline"
          )}>
            {isMobile ? "Tools" : "Herramientas"}
          </span>
          <Badge variant="secondary" className={cn(
            "px-1.5 py-0.5",
            isMobile ? "text-xs" : "text-xs"
          )}>
            {activeToolsCount}
          </Badge>
          <ChevronDown className={isMobile ? "h-2.5 w-2.5" : "h-3 w-3"} />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="end" 
        className={cn(
          "bg-card/95 backdrop-blur border-border/50",
          isMobile ? "w-72 max-h-[70vh] overflow-y-auto" : "w-80"
        )}
      >
        <DropdownMenuLabel className={cn(
          "font-semibold text-foreground/90",
          isMobile ? "text-sm px-3 py-2" : "text-base"
        )}>
          Herramientas disponibles
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {loading ? (
          <DropdownMenuItem disabled className={cn(
            "justify-center",
            isMobile ? "p-4" : "p-4"
          )}>
            <div className="flex items-center gap-2">
              <div className={cn(
                "border border-foreground/30 border-t-foreground/80 rounded-full animate-spin",
                isMobile ? "w-3 h-3" : "w-4 h-4"
              )} />
              <span className={cn(
                "text-foreground/60",
                isMobile ? "text-sm" : "text-base"
              )}>
                Cargando herramientas...
              </span>
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
                  "flex flex-col items-start gap-1 cursor-pointer transition-colors",
                  !tool.active && "opacity-50",
                  isMobile ? "p-3" : "p-3"
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
                      <span className={cn(
                        "font-medium text-foreground/90",
                        isMobile ? "text-sm" : "text-sm"
                      )}>
                        {tool.name}
                      </span>
                      {tool.active ? (
                        <CheckCircle className={cn(
                          "text-green-500 flex-shrink-0",
                          isMobile ? "h-2.5 w-2.5" : "h-3 w-3"
                        )} />
                      ) : (
                        <AlertCircle className={cn(
                          "text-foreground/40 flex-shrink-0",
                          isMobile ? "h-2.5 w-2.5" : "h-3 w-3"
                        )} />
                      )}
                    </div>
                    <p className={cn(
                      "text-foreground/60 mt-0.5",
                      isMobile ? "text-xs leading-relaxed" : "text-xs"
                    )}>
                      {tool.description}
                    </p>
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem className={cn(
              "cursor-pointer",
              isMobile ? "p-3" : "p-3"
            )}>
              <div className="flex items-center gap-3 w-full">
                <Settings className={cn(
                  "text-foreground/60",
                  isMobile ? "h-3.5 w-3.5" : "h-4 w-4"
                )} />
                <div className="flex-1">
                  <span className={cn(
                    "font-medium text-foreground/90",
                    isMobile ? "text-sm" : "text-sm"
                  )}>
                    Configuración avanzada
                  </span>
                  <p className={cn(
                    "text-foreground/60 mt-0.5",
                    isMobile ? "text-xs leading-relaxed" : "text-xs"
                  )}>
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