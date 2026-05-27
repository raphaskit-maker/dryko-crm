import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  useGetContact, 
  getGetContactQueryKey,
  useUpdateContact,
  useDeleteContact,
  useListConversations,
  useCreateConversation,
  useDeleteConversation,
  getListContactsQueryKey,
  getListConversationsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Phone, Mail, MessageCircle, Instagram, Edit2, Check, X, Trash2, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import type { ContactUpdateCanal } from "@workspace/api-client-react";

interface ContactSidePanelProps {
  contactId?: number;
  open: boolean;
  onClose: () => void;
}

export function ContactSidePanel({ contactId, open, onClose }: ContactSidePanelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: contact, isLoading } = useGetContact(contactId as number, { 
    query: { enabled: !!contactId, queryKey: getGetContactQueryKey(contactId as number) } 
  });

  const { data: conversations } = useListConversations(contactId as number, {
    query: { enabled: !!contactId, queryKey: getListConversationsQueryKey(contactId as number) }
  });

  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  const createConversation = useCreateConversation();
  const deleteConversation = useDeleteConversation();

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  
  const [newConvConteudo, setNewConvConteudo] = useState("");
  const [newConvCanal, setNewConvCanal] = useState<"whatsapp" | "email" | "instagram" | "telefone">("whatsapp");
  const [newConvDirecao, setNewConvDirecao] = useState<"entrada" | "saida">("saida");

  // Sync editData when contact loads or edit starts
  const startEdit = () => {
    if (contact) {
      setEditData({
        nome: contact.nome,
        telefone: contact.telefone,
        email: contact.email || "",
        canal: contact.canal,
        tags: contact.tags.join(", "),
        notas: contact.notas || ""
      });
      setIsEditing(true);
    }
  };

  const handleSaveEdit = () => {
    if (!contactId) return;
    
    const tagsArray = editData.tags ? editData.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [];
    
    updateContact.mutate(
      {
        id: contactId,
        data: {
          nome: editData.nome,
          telefone: editData.telefone,
          email: editData.email || null,
          canal: editData.canal as ContactUpdateCanal,
          tags: tagsArray,
          notas: editData.notas || null
        }
      },
      {
        onSuccess: (updatedContact) => {
          queryClient.setQueryData(getGetContactQueryKey(contactId), updatedContact);
          queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
          setIsEditing(false);
          toast({ title: "Contato atualizado" });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Erro ao atualizar" });
        }
      }
    );
  };

  const handleDelete = () => {
    if (!contactId) return;
    deleteContact.mutate(
      { id: contactId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
          toast({ title: "Contato excluído" });
          onClose();
        },
        onError: () => {
          toast({ variant: "destructive", title: "Erro ao excluir" });
        }
      }
    );
  };

  const handleAddConversation = () => {
    if (!contactId || !newConvConteudo.trim()) return;
    
    createConversation.mutate(
      {
        id: contactId,
        data: {
          conteudo: newConvConteudo,
          canal: newConvCanal,
          direcao: newConvDirecao
        }
      } as any,
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey(contactId) });
          setNewConvConteudo("");
          toast({ title: "Interação adicionada" });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Erro ao adicionar" });
        }
      }
    );
  };

  const handleDeleteConversation = (convId: number) => {
    // According to prompt: useDeleteConversation() — mutate({ id })
    deleteConversation.mutate(
      { id: convId },
      {
        onSuccess: () => {
          if (contactId) queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey(contactId) });
          toast({ title: "Interação excluída" });
        }
      }
    );
  };

  const getCanalIcon = (canal: string) => {
    switch (canal?.toLowerCase()) {
      case "whatsapp": return <MessageCircle className="w-4 h-4 text-green-500" />;
      case "telefone": return <Phone className="w-4 h-4 text-blue-500" />;
      case "email": return <Mail className="w-4 h-4 text-gray-500" />;
      case "instagram": return <Instagram className="w-4 h-4 text-pink-500" />;
      default: return <MessageCircle className="w-4 h-4" />;
    }
  };

  return (
    <Sheet open={open} onOpenChange={(val) => !val && onClose()}>
      <SheetContent className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col h-full bg-background border-l border-border">
        {isLoading || !contact ? (
          <div className="p-6 flex items-center justify-center h-full">Carregando...</div>
        ) : (
          <>
            <SheetHeader className="p-6 border-b border-border bg-card/50 shrink-0">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">
                    {contact.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    {isEditing ? (
                      <Input 
                        value={editData.nome} 
                        onChange={e => setEditData({...editData, nome: e.target.value})} 
                        className="font-bold text-lg h-8 mb-1 w-full max-w-[200px]"
                      />
                    ) : (
                      <SheetTitle className="text-xl">{contact.nome}</SheetTitle>
                    )}
                    
                    <div className="flex items-center gap-2 mt-1">
                      {isEditing ? (
                        <Select value={editData.canal} onValueChange={v => setEditData({...editData, canal: v})}>
                          <SelectTrigger className="h-6 text-xs w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            <SelectItem value="email">E-mail</SelectItem>
                            <SelectItem value="instagram">Instagram</SelectItem>
                            <SelectItem value="telefone">Telefone</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary" className="capitalize flex items-center gap-1 font-normal bg-background">
                          {getCanalIcon(contact.canal)}
                          {contact.canal}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <Button size="icon" variant="ghost" onClick={() => setIsEditing(false)}>
                        <X className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="default" className="bg-primary" onClick={handleSaveEdit} disabled={updateContact.isPending}>
                        <Check className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="icon" variant="ghost" onClick={startEdit}>
                        <Edit2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir contato?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. Isso excluirá permanentemente o contato e todo o seu histórico de conversas.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </div>
            </SheetHeader>

            <Tabs defaultValue="detalhes" className="flex-1 flex flex-col min-h-0">
              <div className="px-6 pt-4 shrink-0 bg-card/30">
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                  <TabsTrigger value="historico">Histórico de conversas</TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="flex-1">
                <TabsContent value="detalhes" className="p-6 m-0 space-y-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Telefone</h4>
                      {isEditing ? (
                        <Input value={editData.telefone} onChange={e => setEditData({...editData, telefone: e.target.value})} />
                      ) : (
                        <p>{contact.telefone}</p>
                      )}
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">E-mail</h4>
                      {isEditing ? (
                        <Input type="email" value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} />
                      ) : (
                        <p>{contact.email || "—"}</p>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Tags</h4>
                      {isEditing ? (
                        <Input value={editData.tags} onChange={e => setEditData({...editData, tags: e.target.value})} placeholder="Separe as tags por vírgula" />
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {contact.tags.length > 0 ? (
                            contact.tags.map(tag => (
                              <Badge key={tag} variant="secondary" className="bg-primary/5 text-primary border-primary/20">{tag}</Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Notas</h4>
                      {isEditing ? (
                        <Textarea 
                          value={editData.notas} 
                          onChange={e => setEditData({...editData, notas: e.target.value})}
                          className="min-h-[100px]"
                        />
                      ) : (
                        <div className="bg-muted/30 rounded-md p-3 text-sm min-h-[60px] whitespace-pre-wrap border border-border">
                          {contact.notas || <span className="text-muted-foreground italic">Nenhuma nota adicionada.</span>}
                        </div>
                      )}
                    </div>

                    <Separator />
                    
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                      <p>Criado em: {format(new Date(contact.criadoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                      <p>Atualizado em: {format(new Date(contact.atualizadoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="historico" className="p-6 m-0 flex flex-col h-full space-y-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm">Adicionar interação</h3>
                    <div className="space-y-3 bg-card p-4 rounded-lg border border-border shadow-sm">
                      <Textarea 
                        placeholder="Resumo da conversa..."
                        value={newConvConteudo}
                        onChange={(e) => setNewConvConteudo(e.target.value)}
                        className="resize-none h-20"
                      />
                      <div className="flex items-center gap-2">
                        <Select value={newConvCanal} onValueChange={(v: any) => setNewConvCanal(v)}>
                          <SelectTrigger className="w-[130px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            <SelectItem value="email">E-mail</SelectItem>
                            <SelectItem value="instagram">Instagram</SelectItem>
                            <SelectItem value="telefone">Telefone</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        <Select value={newConvDirecao} onValueChange={(v: any) => setNewConvDirecao(v)}>
                          <SelectTrigger className="w-[120px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="entrada">Entrada</SelectItem>
                            <SelectItem value="saida">Saída</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        <Button 
                          onClick={handleAddConversation} 
                          disabled={!newConvConteudo.trim() || createConversation.isPending}
                          size="sm"
                          className="ml-auto h-8 bg-accent hover:bg-accent/90 text-white"
                        >
                          Salvar
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm">Histórico</h3>
                    {conversations?.length === 0 ? (
                      <p className="text-muted-foreground text-sm text-center py-8">Nenhuma interação registrada.</p>
                    ) : (
                      <div className="relative border-l-2 border-border ml-3 pl-5 space-y-6">
                        {conversations?.map(conv => (
                          <div key={conv.id} className="relative">
                            <div className="absolute -left-[29px] top-1 rounded-full p-1 bg-background border border-border">
                              {conv.direcao === "entrada" ? (
                                <ArrowDownLeft className="w-3 h-3 text-blue-500" />
                              ) : (
                                <ArrowUpRight className="w-3 h-3 text-green-500" />
                              )}
                            </div>
                            <div className="bg-card border border-border rounded-md p-3 shadow-sm group">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px] h-5 capitalize flex items-center gap-1">
                                    {getCanalIcon(conv.canal)}
                                    {conv.canal}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(conv.criadoEm), "dd/MM/yyyy HH:mm")}
                                  </span>
                                </div>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDeleteConversation(conv.id)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                              <p className="text-sm whitespace-pre-wrap">{conv.conteudo}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
