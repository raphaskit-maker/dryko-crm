import { useState, useEffect } from "react";
import { Link, useLocation, useParams } from "wouter";
import { 
  useListContacts, 
  getListContactsQueryKey, 
  useListTags,
  useGetContactStats
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Upload, Filter, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CSVImportDialog } from "@/components/csv-import-dialog";
import { ContactSidePanel } from "@/components/contact-side-panel";
import type { ListContactsCanal } from "@workspace/api-client-react";

export default function Contacts() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const selectedContactId = params.id ? parseInt(params.id) : undefined;
  
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState<string | undefined>(undefined);
  const [canal, setCanal] = useState<ListContactsCanal | undefined>(undefined);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: contacts, isLoading } = useListContacts({
    search: debouncedSearch || undefined,
    tag: tag === "all" ? undefined : tag,
    canal: canal === "all" as any ? undefined : canal,
  });

  const { data: tags } = useListTags();

  const handleContactClick = (id: number) => {
    setLocation(`/contatos/${id}`);
  };

  const handleClosePanel = () => {
    setLocation("/contatos");
  };

  return (
    <div className="flex h-full w-full">
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between bg-card shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-primary">Contatos</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerencie sua carteira de clientes</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsImportOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Importar CSV
            </Button>
            <Button asChild className="bg-accent hover:bg-accent/90 text-white">
              <Link href="/contatos/novo">
                <Plus className="w-4 h-4 mr-2" />
                Novo Contato
              </Link>
            </Button>
          </div>
        </div>

        <div className="p-6 shrink-0 bg-background/50 border-b border-border">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar contatos por nome, email ou telefone..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={tag || "all"} onValueChange={(val) => setTag(val === "all" ? undefined : val)}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-4 h-4 mr-2 opacity-50" />
                  <SelectValue placeholder="Filtrar por tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as tags</SelectItem>
                  {tags?.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={canal || "all"} onValueChange={(val) => setCanal(val as any)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Canal preferido" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os canais</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="telefone">Telefone</SelectItem>
                </SelectContent>
              </Select>
              
              {(search || tag || canal) && (
                <Button variant="ghost" size="icon" onClick={() => {
                  setSearch("");
                  setTag(undefined);
                  setCanal(undefined);
                }}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="h-20 p-6 flex items-center">
                    <div className="w-10 h-10 rounded-full bg-muted mr-4" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-muted w-1/4 rounded" />
                      <div className="h-3 bg-muted w-1/3 rounded" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : contacts?.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <Search className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">Nenhum contato encontrado</h3>
              <p className="text-muted-foreground mt-1 mb-4">Tente ajustar seus filtros ou busca.</p>
              <Button onClick={() => {
                  setSearch("");
                  setTag(undefined);
                  setCanal(undefined);
              }} variant="outline">
                Limpar filtros
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {contacts?.map((contact) => (
                <Card 
                  key={contact.id} 
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${selectedContactId === contact.id ? 'border-primary ring-1 ring-primary/20' : ''}`}
                  onClick={() => handleContactClick(contact.id)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {contact.nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{contact.nome}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm text-muted-foreground">{contact.telefone}</span>
                          {contact.email && (
                            <>
                              <span className="text-muted-foreground text-xs">•</span>
                              <span className="text-sm text-muted-foreground">{contact.email}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        {contact.tags.slice(0, 3).map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                        {contact.tags.length > 3 && (
                          <Badge variant="secondary" className="text-xs">+{contact.tags.length - 3}</Badge>
                        )}
                      </div>
                      <Badge variant="outline" className="capitalize bg-background">
                        {contact.canal}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <ContactSidePanel 
        contactId={selectedContactId} 
        open={!!selectedContactId} 
        onClose={handleClosePanel} 
      />

      <CSVImportDialog 
        open={isImportOpen} 
        onOpenChange={setIsImportOpen} 
      />
    </div>
  );
}
