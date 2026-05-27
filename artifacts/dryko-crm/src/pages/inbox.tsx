import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListInbox,
  useListMensagens,
  useSendMensagem,
  useUpdateInboxConversation,
  useCreateInboxConversation,
  useListRespostasRapidas,
  useListContacts,
  getListInboxQueryKey,
  getGetInboxStatsQueryKey,
  getListMensagensQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare,
  Mail,
  Phone,
  Camera,
  Plus,
  Send,
  Zap,
  ChevronDown,
  User,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CANAL_ICON: Record<string, React.ReactNode> = {
  whatsapp: <MessageSquare className="w-3.5 h-3.5" />,
  email: <Mail className="w-3.5 h-3.5" />,
  instagram: <Camera className="w-3.5 h-3.5" />,
  telefone: <Phone className="w-3.5 h-3.5" />,
};

const CANAL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  instagram: "Instagram",
  telefone: "Telefone",
};

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  resolvida: "Resolvida",
};

const STATUS_COLOR: Record<string, string> = {
  aberta: "bg-orange-100 text-orange-700 border-orange-200",
  em_andamento: "bg-blue-100 text-blue-700 border-blue-200",
  resolvida: "bg-green-100 text-green-700 border-green-200",
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

const CLASSIFICATIONS = ["Ótimo", "Bom", "Regular", "Ruim"] as const;

export default function Inbox() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [canalFilter, setCanalFilter] = useState<string>("");
  const [messageText, setMessageText] = useState("");

  const [showClassModal, setShowClassModal] = useState(false);
  const [pendingClassStatus, setPendingClassStatus] = useState<string | null>(null);

  const [showNewConvDialog, setShowNewConvDialog] = useState(false);
  const [newConvContatoId, setNewConvContatoId] = useState<string>("");
  const [newConvCanal, setNewConvCanal] = useState<string>("");
  const [newConvAtendente, setNewConvAtendente] = useState<string>("");

  const inboxParams = {
    ...(statusFilter ? { status: statusFilter as "aberta" | "em_andamento" | "resolvida" } : {}),
    ...(canalFilter && canalFilter !== "all" ? { canal: canalFilter as "whatsapp" | "email" | "instagram" | "telefone" } : {}),
  };

  const { data: conversations = [], isLoading } = useListInbox(inboxParams);
  const { data: mensagens = [] } = useListMensagens(selectedId!, {
    query: { enabled: !!selectedId, queryKey: getListMensagensQueryKey(selectedId!) },
  });
  const { data: respostas = [] } = useListRespostasRapidas();
  const { data: contatos = [] } = useListContacts();

  const selectedConv = conversations.find((c) => c.id === selectedId) ?? null;

  const sendMsg = useSendMensagem();
  const updateConv = useUpdateInboxConversation();
  const createConv = useCreateInboxConversation();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  const invalidateInbox = () => {
    queryClient.invalidateQueries({ queryKey: getListInboxQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetInboxStatsQueryKey() });
  };

  const handleSend = () => {
    if (!selectedId || !messageText.trim()) return;
    sendMsg.mutate(
      { id: selectedId, data: { texto: messageText.trim(), autor: "Atendente" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMensagensQueryKey(selectedId) });
          invalidateInbox();
          setMessageText("");
        },
        onError: () => toast({ variant: "destructive", title: "Erro ao enviar mensagem" }),
      }
    );
  };

  const handleStatusChange = (newStatus: string) => {
    if (!selectedId) return;
    if (newStatus === "resolvida") {
      setPendingClassStatus(newStatus);
      setShowClassModal(true);
      return;
    }
    updateConv.mutate(
      { id: selectedId, data: { status: newStatus as "aberta" | "em_andamento" | "resolvida" } },
      {
        onSuccess: () => {
          invalidateInbox();
          toast({ title: `Status alterado para: ${STATUS_LABEL[newStatus]}` });
        },
        onError: () => toast({ variant: "destructive", title: "Erro ao alterar status" }),
      }
    );
  };

  const handleClassificationSubmit = (classificacao: string) => {
    if (!selectedId || !pendingClassStatus) return;
    updateConv.mutate(
      {
        id: selectedId,
        data: {
          status: pendingClassStatus as "aberta" | "em_andamento" | "resolvida",
          classificacao,
        },
      },
      {
        onSuccess: () => {
          invalidateInbox();
          setShowClassModal(false);
          setPendingClassStatus(null);
          toast({ title: `Atendimento classificado como: ${classificacao}` });
        },
        onError: () => toast({ variant: "destructive", title: "Erro ao classificar" }),
      }
    );
  };

  const handleNewConversation = () => {
    if (!newConvContatoId || !newConvCanal) {
      toast({ variant: "destructive", title: "Selecione o contato e o canal" });
      return;
    }
    createConv.mutate(
      {
        data: {
          contatoId: parseInt(newConvContatoId),
          canal: newConvCanal as "whatsapp" | "email" | "instagram" | "telefone",
          atendente: newConvAtendente || null,
        },
      },
      {
        onSuccess: (data) => {
          invalidateInbox();
          setSelectedId(data.id);
          setShowNewConvDialog(false);
          setNewConvContatoId("");
          setNewConvCanal("");
          setNewConvAtendente("");
          toast({ title: "Conversa criada com sucesso" });
        },
        onError: () => toast({ variant: "destructive", title: "Erro ao criar conversa" }),
      }
    );
  };

  const STATUS_TABS = [
    { value: "", label: "Todas" },
    { value: "aberta", label: "Abertas" },
    { value: "em_andamento", label: "Em andamento" },
    { value: "resolvida", label: "Resolvidas" },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-80 min-w-[280px] border-r flex flex-col overflow-hidden bg-white">
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="font-bold text-lg text-[#1A3568]">Caixa de Entrada</h1>
            <Button
              size="sm"
              className="bg-[#F4831F] hover:bg-[#e07318] text-white"
              onClick={() => setShowNewConvDialog(true)}
            >
              <Plus className="w-4 h-4 mr-1" /> Nova
            </Button>
          </div>

          {/* Status filter tabs */}
          <div className="flex gap-1 flex-wrap">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  "px-2 py-1 rounded text-xs font-medium transition-colors",
                  statusFilter === tab.value
                    ? "bg-[#1A3568] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Canal filter */}
          <Select value={canalFilter} onValueChange={setCanalFilter}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Todos os canais" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os canais</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="email">E-mail</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="telefone">Telefone</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground text-center">Carregando...</div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma conversa encontrada
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className={cn(
                  "w-full text-left p-3 border-b hover:bg-gray-50 transition-colors",
                  selectedId === conv.id && "bg-blue-50 border-l-4 border-l-[#1A3568]"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#1A3568] text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {conv.contatoNome.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-gray-900 truncate">
                        {conv.contatoNome}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {conv.ultimaMensagem ?? "Sem mensagens"}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs text-muted-foreground">{formatTime(conv.criadoEm)}</span>
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded border font-medium",
                        STATUS_COLOR[conv.status]
                      )}
                    >
                      {STATUS_LABEL[conv.status]}
                    </span>
                  </div>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {CANAL_ICON[conv.canal]}
                  <span>{CANAL_LABEL[conv.canal]}</span>
                  {conv.atendente && (
                    <>
                      <span>·</span>
                      <User className="w-3 h-3" />
                      <span className="truncate">{conv.atendente}</span>
                    </>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Chat Panel */}
      {!selectedConv ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-gray-50 gap-3">
          <MessageSquare className="w-12 h-12 opacity-20" />
          <p className="text-sm">Selecione uma conversa para começar</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chat Header */}
          <div className="p-4 border-b bg-white flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[#1A3568] text-white flex items-center justify-center font-bold">
                {selectedConv.contatoNome.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-gray-900 truncate">{selectedConv.contatoNome}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    {CANAL_ICON[selectedConv.canal]}
                    {CANAL_LABEL[selectedConv.canal]}
                  </span>
                  {selectedConv.atendente && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />{selectedConv.atendente}
                      </span>
                    </>
                  )}
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(selectedConv.criadoEm).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className={cn("text-xs px-2 py-1 rounded border font-medium", STATUS_COLOR[selectedConv.status])}>
                {STATUS_LABEL[selectedConv.status]}
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    Alterar status <ChevronDown className="w-3 h-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="end">
                  {["aberta", "em_andamento", "resolvida"].map((s) => (
                    <button
                      key={s}
                      disabled={s === selectedConv.status}
                      onClick={() => handleStatusChange(s)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded text-sm hover:bg-gray-100 transition-colors",
                        s === selectedConv.status && "opacity-40 cursor-default"
                      )}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {mensagens.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                Nenhuma mensagem ainda
              </div>
            ) : (
              mensagens.map((msg) => {
                const isAtendente = msg.autor === "Atendente";
                return (
                  <div key={msg.id} className={cn("flex", isAtendente ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                        isAtendente
                          ? "bg-[#1A3568] text-white rounded-br-sm"
                          : "bg-white text-gray-900 rounded-bl-sm border"
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.texto}</p>
                      <p className={cn("text-[10px] mt-1", isAtendente ? "text-blue-200" : "text-muted-foreground")}>
                        {msg.autor} · {new Date(msg.criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t bg-white p-3 space-y-2">
            {selectedConv.status === "resolvida" ? (
              <div className="text-center text-sm text-muted-foreground py-2">
                Esta conversa foi resolvida.{" "}
                <button
                  className="text-[#F4831F] hover:underline font-medium"
                  onClick={() => handleStatusChange("aberta")}
                >
                  Reabrir
                </button>
              </div>
            ) : (
              <>
                <Textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  className="resize-none min-h-[64px] text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <div className="flex items-center justify-between gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-[#F4831F]" />
                        Respostas rápidas
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-1" align="start">
                      {respostas.length === 0 ? (
                        <p className="text-sm text-muted-foreground px-3 py-2">Nenhuma resposta cadastrada</p>
                      ) : (
                        respostas.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => setMessageText(r.texto)}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm transition-colors"
                          >
                            <div className="font-medium text-[#1A3568]">{r.titulo}</div>
                            <div className="text-xs text-muted-foreground truncate">{r.texto}</div>
                          </button>
                        ))
                      )}
                    </PopoverContent>
                  </Popover>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground hidden sm:block">Ctrl+Enter para enviar</span>
                    <Button
                      size="sm"
                      className="bg-[#1A3568] hover:bg-[#152d5a] text-white gap-1.5"
                      onClick={handleSend}
                      disabled={!messageText.trim() || sendMsg.isPending}
                    >
                      <Send className="w-3.5 h-3.5" />
                      Enviar
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Classification Modal */}
      <Dialog open={showClassModal} onOpenChange={setShowClassModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Classificar atendimento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Como você avalia este atendimento?
          </p>
          <div className="grid grid-cols-2 gap-2 py-2">
            {CLASSIFICATIONS.map((c) => {
              const colors: Record<string, string> = {
                Ótimo: "border-green-500 hover:bg-green-50 text-green-700",
                Bom: "border-blue-500 hover:bg-blue-50 text-blue-700",
                Regular: "border-yellow-500 hover:bg-yellow-50 text-yellow-700",
                Ruim: "border-red-500 hover:bg-red-50 text-red-700",
              };
              return (
                <button
                  key={c}
                  onClick={() => handleClassificationSubmit(c)}
                  className={cn(
                    "border-2 rounded-lg py-3 font-semibold text-sm transition-colors",
                    colors[c]
                  )}
                >
                  {c}
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowClassModal(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Conversation Dialog */}
      <Dialog open={showNewConvDialog} onOpenChange={setShowNewConvDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova conversa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <label className="text-sm font-medium">Contato</label>
              <Select value={newConvContatoId} onValueChange={setNewConvContatoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o contato" />
                </SelectTrigger>
                <SelectContent>
                  {contatos.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.nome} — {c.telefone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Canal</label>
              <Select value={newConvCanal} onValueChange={setNewConvCanal}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o canal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="telefone">Telefone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Atendente responsável</label>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3568]"
                placeholder="Nome do atendente (opcional)"
                value={newConvAtendente}
                onChange={(e) => setNewConvAtendente(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowNewConvDialog(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-[#F4831F] hover:bg-[#e07318] text-white"
              onClick={handleNewConversation}
              disabled={createConv.isPending}
            >
              Criar conversa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
