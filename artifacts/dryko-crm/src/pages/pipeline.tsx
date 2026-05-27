import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetPipelineStats,
  useListNegocios,
  useCreateNegocio,
  useUpdateNegocio,
  useDeleteNegocio,
  useGetHistoricoNegocio,
  useListEtapas,
  useCreateEtapa,
  useUpdateEtapa,
  useDeleteEtapa,
  useListContacts,
  getGetPipelineStatsQueryKey,
  getListNegociosQueryKey,
  getListEtapasQueryKey,
  getGetHistoricoNegocioQueryKey,
  type Negocio,
  type EtapaPipeline,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  X,
  Trophy,
  XCircle,
  Plus,
  Settings,
  Calendar,
  User,
  DollarSign,
  Clock,
  Pencil,
  Trash2,
  GripVertical,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR");
}

function isOverdue(dateStr: string | null | undefined, status: string) {
  if (!dateStr || status !== "ativo") return false;
  const prazo = new Date(dateStr + "T23:59:59");
  return prazo < new Date();
}

// ─── DealCard ────────────────────────────────────────────────────────────────

interface DealCardProps {
  negocio: Negocio;
  etapaCor: string;
  onDragStart: (e: React.DragEvent, id: number) => void;
  onDragEnd: () => void;
  onClick: () => void;
  onMarkWon: () => void;
  onMarkLost: () => void;
  isDragging: boolean;
}

function DealCard({
  negocio,
  etapaCor,
  onDragStart,
  onDragEnd,
  onClick,
  onMarkWon,
  onMarkLost,
  isDragging,
}: DealCardProps) {
  const overdue = isOverdue(negocio.prazo, negocio.status);
  const isGanho = negocio.status === "ganho";
  const isPerdido = negocio.status === "perdido";
  const isInativo = isGanho || isPerdido;

  let borderColor = etapaCor;
  if (isGanho) borderColor = "#10B981";
  if (isPerdido) borderColor = "#EF4444";
  if (overdue) borderColor = "#EF4444";

  return (
    <div
      draggable={!isInativo}
      onDragStart={(e) => onDragStart(e, negocio.id)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={[
        "bg-white rounded-lg p-3 shadow-sm border cursor-pointer transition-all select-none",
        isDragging ? "opacity-40 rotate-1" : "hover:shadow-md",
        overdue ? "border-l-4 ring-1 ring-red-200" : "border-l-4",
        isGanho ? "bg-green-50 border-l-4" : "",
        isPerdido ? "bg-red-50 border-l-4 opacity-75" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ borderLeftColor: borderColor }}
    >
      <div className="flex items-start justify-between gap-1 mb-2">
        <span className="font-semibold text-sm text-gray-800 leading-tight flex-1">
          {negocio.nome}
        </span>
        {overdue && (
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
        )}
        {isGanho && <Trophy className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />}
        {isPerdido && <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />}
      </div>

      <div className="text-[#F4831F] font-bold text-base mb-2">
        {formatBRL(negocio.valor)}
      </div>

      <div className="space-y-1 text-xs text-gray-500">
        {negocio.contatoNome && (
          <div className="flex items-center gap-1">
            <User className="w-3 h-3" />
            <span className="truncate">{negocio.contatoNome}</span>
          </div>
        )}
        {negocio.responsavel && (
          <div className="flex items-center gap-1">
            <span className="text-gray-400">👤</span>
            <span className="truncate">{negocio.responsavel}</span>
          </div>
        )}
        {negocio.prazo && (
          <div
            className={`flex items-center gap-1 ${overdue ? "text-red-500 font-medium" : ""}`}
          >
            <Calendar className="w-3 h-3" />
            <span>{formatDate(negocio.prazo)}</span>
            {overdue && <span className="font-bold">— Vencido</span>}
          </div>
        )}
      </div>

      {!isInativo && (
        <div
          className="flex gap-1 mt-2 pt-2 border-t"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onMarkWon}
            className="flex-1 flex items-center justify-center gap-1 text-[10px] text-green-600 hover:bg-green-50 rounded px-1 py-0.5 transition-colors"
          >
            <Trophy className="w-3 h-3" />
            Ganho
          </button>
          <button
            onClick={onMarkLost}
            className="flex-1 flex items-center justify-center gap-1 text-[10px] text-red-500 hover:bg-red-50 rounded px-1 py-0.5 transition-colors"
          >
            <XCircle className="w-3 h-3" />
            Perdido
          </button>
        </div>
      )}
    </div>
  );
}

// ─── KanbanColumn ─────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  etapa: EtapaPipeline;
  negocios: Negocio[];
  draggingId: number | null;
  dragOverEtapa: number | null;
  onDragStart: (e: React.DragEvent, id: number) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, etapaId: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, etapaId: number) => void;
  onCardClick: (id: number) => void;
  onMarkWon: (id: number) => void;
  onMarkLost: (id: number) => void;
}

function KanbanColumn({
  etapa,
  negocios,
  draggingId,
  dragOverEtapa,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onCardClick,
  onMarkWon,
  onMarkLost,
}: KanbanColumnProps) {
  const isOver = dragOverEtapa === etapa.id;

  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      {/* Column header */}
      <div
        className="rounded-t-xl p-3 mb-0.5"
        style={{ backgroundColor: etapa.cor + "18", borderTop: `3px solid ${etapa.cor}` }}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold text-sm text-gray-800">{etapa.nome}</span>
          <span
            className="text-xs font-bold rounded-full px-2 py-0.5 text-white"
            style={{ backgroundColor: etapa.cor }}
          >
            {etapa.totalNegocios}
          </span>
        </div>
        <div className="text-xs text-gray-500 font-medium">
          {formatBRL(etapa.totalValor)}
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={[
          "flex-1 rounded-b-xl p-2 space-y-2 min-h-[200px] transition-colors",
          isOver ? "bg-blue-50 ring-2 ring-blue-300 ring-inset" : "bg-gray-50",
        ].join(" ")}
        onDragOver={(e) => onDragOver(e, etapa.id)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, etapa.id)}
      >
        {negocios.map((n) => (
          <DealCard
            key={n.id}
            negocio={n}
            etapaCor={etapa.cor}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={() => onCardClick(n.id)}
            onMarkWon={() => onMarkWon(n.id)}
            onMarkLost={() => onMarkLost(n.id)}
            isDragging={draggingId === n.id}
          />
        ))}
        {negocios.length === 0 && !isOver && (
          <div className="text-center text-xs text-gray-400 mt-4 py-4">
            Arraste negócios para cá
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DealSidePanel ────────────────────────────────────────────────────────────

function DealSidePanel({
  negocioId,
  onClose,
  onDeleted,
}: {
  negocioId: number;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: negocios } = useListNegocios();
  const negocio = negocios?.find((n) => n.id === negocioId);
  const { data: historico } = useGetHistoricoNegocio(negocioId);
  const deleteMutation = useDeleteNegocio({
    mutation: {
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: getListNegociosQueryKey() });
        void qc.invalidateQueries({ queryKey: getGetPipelineStatsQueryKey() });
        toast({ title: "Negócio excluído" });
        onDeleted();
      },
    },
  });

  if (!negocio) return null;

  const overdue = isOverdue(negocio.prazo, negocio.status);
  const statusLabel: Record<string, string> = {
    ativo: "Ativo",
    ganho: "Ganho",
    perdido: "Perdido",
  };
  const statusColor: Record<string, string> = {
    ativo: "bg-blue-100 text-blue-700",
    ganho: "bg-green-100 text-green-700",
    perdido: "bg-red-100 text-red-600",
  };

  return (
    <div className="w-80 border-l bg-white flex flex-col h-full shadow-xl">
      <div
        className="flex items-center justify-between p-4 border-b"
        style={{ borderTop: `3px solid ${negocio.etapaCor}` }}
      >
        <h2 className="font-bold text-gray-800 text-sm leading-tight pr-2">
          {negocio.nome}
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor[negocio.status]}`}
          >
            {statusLabel[negocio.status]}
          </span>
          <span
            className="text-xs px-2 py-1 rounded-full text-white font-medium"
            style={{ backgroundColor: negocio.etapaCor }}
          >
            {negocio.etapaNome}
          </span>
        </div>

        {/* Value */}
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-[#F4831F]" />
          <span className="text-lg font-bold text-[#F4831F]">
            {formatBRL(negocio.valor)}
          </span>
        </div>

        {/* Info grid */}
        <div className="space-y-2 text-sm">
          {negocio.contatoNome && (
            <div className="flex items-start gap-2">
              <User className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <div className="text-xs text-gray-400">Contato</div>
                <div className="text-gray-700">{negocio.contatoNome}</div>
              </div>
            </div>
          )}
          {negocio.responsavel && (
            <div className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">👤</span>
              <div>
                <div className="text-xs text-gray-400">Responsável</div>
                <div className="text-gray-700">{negocio.responsavel}</div>
              </div>
            </div>
          )}
          {negocio.prazo && (
            <div className="flex items-start gap-2">
              <Calendar
                className={`w-4 h-4 mt-0.5 ${overdue ? "text-red-500" : "text-gray-400"}`}
              />
              <div>
                <div className="text-xs text-gray-400">Prazo</div>
                <div className={overdue ? "text-red-500 font-semibold" : "text-gray-700"}>
                  {formatDate(negocio.prazo)}
                  {overdue && " — Vencido"}
                </div>
              </div>
            </div>
          )}
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-gray-400 mt-0.5" />
            <div>
              <div className="text-xs text-gray-400">Criado em</div>
              <div className="text-gray-700">
                {new Date(negocio.criadoEm).toLocaleDateString("pt-BR")}
              </div>
            </div>
          </div>
        </div>

        {/* History */}
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
            Histórico de Movimentações
          </h3>
          {!historico || historico.length === 0 ? (
            <p className="text-xs text-gray-400">Sem movimentações registradas.</p>
          ) : (
            <div className="space-y-2">
              {historico.map((h) => (
                <div key={h.id} className="text-xs border-l-2 border-gray-200 pl-2">
                  <div className="text-gray-600">
                    {h.etapaAnterior ? (
                      <>
                        <span className="text-gray-400">{h.etapaAnterior}</span>
                        {" → "}
                        <span className="font-medium text-gray-700">{h.etapaNova}</span>
                      </>
                    ) : (
                      <>
                        Negócio criado em{" "}
                        <span className="font-medium">{h.etapaNova}</span>
                      </>
                    )}
                  </div>
                  <div className="text-gray-400 mt-0.5">
                    {new Date(h.criadoEm).toLocaleDateString("pt-BR")}{" "}
                    {new Date(h.criadoEm).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete action */}
      <div className="p-4 border-t">
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => {
            if (confirm("Excluir este negócio?")) {
              deleteMutation.mutate({ id: negocioId });
            }
          }}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Excluir Negócio
        </Button>
      </div>
    </div>
  );
}

// ─── NewDealDialog ─────────────────────────────────────────────────────────────

function NewDealDialog({
  open,
  onClose,
  etapas,
}: {
  open: boolean;
  onClose: () => void;
  etapas: EtapaPipeline[];
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: contatos } = useListContacts();

  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [contatoId, setContatoId] = useState<string>("none");
  const [responsavel, setResponsavel] = useState("");
  const [prazo, setPrazo] = useState("");
  const [etapaId, setEtapaId] = useState<string>(
    etapas[0] ? String(etapas[0].id) : ""
  );

  const createMutation = useCreateNegocio({
    mutation: {
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: getListNegociosQueryKey() });
        void qc.invalidateQueries({ queryKey: getGetPipelineStatsQueryKey() });
        toast({ title: "Negócio criado com sucesso!" });
        handleClose();
      },
      onError: () => {
        toast({ title: "Erro ao criar negócio", variant: "destructive" });
      },
    },
  });

  function handleClose() {
    setNome("");
    setValor("");
    setContatoId("none");
    setResponsavel("");
    setPrazo("");
    setEtapaId(etapas[0] ? String(etapas[0].id) : "");
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !etapaId) return;
    createMutation.mutate({
      data: {
        nome: nome.trim(),
        valor: valor ? parseFloat(valor.replace(",", ".")) : 0,
        contatoId: contatoId !== "none" ? parseInt(contatoId) : null,
        responsavel: responsavel.trim() || null,
        prazo: prazo || null,
        etapaId: parseInt(etapaId),
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Negócio</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Nome do negócio *</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Impermeabilização Residência Souza"
              required
            />
          </div>

          <div className="space-y-1">
            <Label>Valor estimado (R$)</Label>
            <Input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0"
              type="number"
              min={0}
              step={0.01}
            />
          </div>

          <div className="space-y-1">
            <Label>Etapa *</Label>
            <Select value={etapaId} onValueChange={setEtapaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar etapa" />
              </SelectTrigger>
              <SelectContent>
                {etapas.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Contato vinculado</Label>
            <Select value={contatoId} onValueChange={setContatoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar contato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {(contatos ?? []).map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Responsável</Label>
            <Input
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              placeholder="Ex: João Silva"
            />
          </div>

          <div className="space-y-1">
            <Label>Prazo</Label>
            <Input
              type="date"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-[#1A3568] hover:bg-[#142b55]"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Criando..." : "Criar Negócio"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── StagesConfigDialog ───────────────────────────────────────────────────────

function StagesConfigDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: etapas } = useListEtapas();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editCor, setEditCor] = useState("");
  const [newNome, setNewNome] = useState("");
  const [newCor, setNewCor] = useState("#6B7280");

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: getListEtapasQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetPipelineStatsQueryKey() });
    void qc.invalidateQueries({ queryKey: getListNegociosQueryKey() });
  };

  const createMutation = useCreateEtapa({
    mutation: {
      onSuccess: () => { invalidate(); setNewNome(""); setNewCor("#6B7280"); toast({ title: "Etapa criada" }); },
    },
  });

  const updateMutation = useUpdateEtapa({
    mutation: {
      onSuccess: () => { invalidate(); setEditingId(null); toast({ title: "Etapa atualizada" }); },
    },
  });

  const deleteMutation = useDeleteEtapa({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Etapa excluída" }); },
      onError: (err: unknown) => {
        const msg =
          err && typeof err === "object" && "response" in err
            ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
            : null;
        toast({ title: msg ?? "Não é possível excluir esta etapa", variant: "destructive" });
      },
    },
  });

  function startEdit(e: EtapaPipeline) {
    setEditingId(e.id);
    setEditNome(e.nome);
    setEditCor(e.cor);
  }

  function saveEdit(id: number) {
    updateMutation.mutate({ id, data: { nome: editNome, cor: editCor } });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Etapas do Pipeline</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-72 overflow-y-auto">
          {(etapas ?? []).map((etapa) => (
            <div
              key={etapa.id}
              className="flex items-center gap-2 p-2 border rounded-lg"
              style={{ borderLeft: `3px solid ${etapa.cor}` }}
            >
              <GripVertical className="w-4 h-4 text-gray-300" />
              {editingId === etapa.id ? (
                <>
                  <Input
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                    className="flex-1 h-7 text-sm"
                  />
                  <input
                    type="color"
                    value={editCor}
                    onChange={(e) => setEditCor(e.target.value)}
                    className="w-7 h-7 rounded cursor-pointer border"
                  />
                  <Button
                    size="sm"
                    className="h-7 px-2 text-xs bg-[#1A3568]"
                    onClick={() => saveEdit(etapa.id)}
                    disabled={updateMutation.isPending}
                  >
                    Salvar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => setEditingId(null)}
                  >
                    ✕
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium">{etapa.nome}</span>
                  <span className="text-xs text-gray-400">{etapa.totalNegocios} neg.</span>
                  <button
                    onClick={() => startEdit(etapa)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Excluir etapa "${etapa.nome}"?`)) {
                        deleteMutation.mutate({ id: etapa.id });
                      }
                    }}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add new */}
        <div className="border-t pt-3">
          <p className="text-xs font-semibold text-gray-500 mb-2">Nova etapa</p>
          <div className="flex gap-2">
            <Input
              value={newNome}
              onChange={(e) => setNewNome(e.target.value)}
              placeholder="Nome da etapa"
              className="flex-1 h-8 text-sm"
            />
            <input
              type="color"
              value={newCor}
              onChange={(e) => setNewCor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border"
            />
            <Button
              size="sm"
              className="h-8 bg-[#1A3568] hover:bg-[#142b55]"
              onClick={() => {
                if (newNome.trim()) {
                  createMutation.mutate({ data: { nome: newNome.trim(), cor: newCor } });
                }
              }}
              disabled={createMutation.isPending || !newNome.trim()}
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Pipeline Page ────────────────────────────────────────────────────────────

export default function Pipeline() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: stats, isLoading } = useGetPipelineStats();
  const { data: negocios } = useListNegocios();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [showStagesConfig, setShowStagesConfig] = useState(false);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverEtapa, setDragOverEtapa] = useState<number | null>(null);

  const updateNegocio = useUpdateNegocio({
    mutation: {
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: getListNegociosQueryKey() });
        void qc.invalidateQueries({ queryKey: getGetPipelineStatsQueryKey() });
        if (selectedId) {
          void qc.invalidateQueries({ queryKey: getGetHistoricoNegocioQueryKey(selectedId) });
        }
      },
      onError: () => {
        toast({ title: "Erro ao mover negócio", variant: "destructive" });
      },
    },
  });

  const etapas = stats?.etapas ?? [];

  function negociosByEtapa(etapaId: number) {
    return (negocios ?? []).filter((n) => n.etapaId === etapaId);
  }

  function handleDragStart(e: React.DragEvent, id: number) {
    e.dataTransfer.setData("negocioId", String(id));
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(id);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverEtapa(null);
  }

  function handleDragOver(e: React.DragEvent, etapaId: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverEtapa(etapaId);
  }

  function handleDragLeave() {
    setDragOverEtapa(null);
  }

  function handleDrop(e: React.DragEvent, etapaId: number) {
    e.preventDefault();
    const raw = e.dataTransfer.getData("negocioId");
    const negocioId = parseInt(raw);
    if (isNaN(negocioId)) return;
    const current = negocios?.find((n) => n.id === negocioId);
    if (!current || current.etapaId === etapaId || current.status !== "ativo") return;
    updateNegocio.mutate({ id: negocioId, data: { etapaId } });
    setDraggingId(null);
    setDragOverEtapa(null);
  }

  function handleMarkWon(id: number) {
    updateNegocio.mutate({ id, data: { status: "ganho" } });
    toast({ title: "Negócio marcado como Ganho!" });
  }

  function handleMarkLost(id: number) {
    updateNegocio.mutate({ id, data: { status: "perdido" } });
    toast({ title: "Negócio marcado como Perdido." });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        Carregando pipeline...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b shadow-sm flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-[#1A3568]">Pipeline de Vendas</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {etapas.reduce((a, e) => a + e.totalNegocios, 0)} negócios ativos ·{" "}
            {formatBRL(etapas.reduce((a, e) => a + e.totalValor, 0))} em potencial
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowStagesConfig(true)}
            className="gap-1"
          >
            <Settings className="w-4 h-4" />
            Etapas
          </Button>
          <Button
            size="sm"
            className="bg-[#F4831F] hover:bg-[#e07519] gap-1"
            onClick={() => setShowNewDeal(true)}
          >
            <Plus className="w-4 h-4" />
            Novo Negócio
          </Button>
        </div>
      </div>

      {/* Board + Side panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Kanban board */}
        <div className="flex-1 overflow-x-auto overflow-y-auto p-4">
          <div className="flex gap-4 h-full items-start">
            {etapas.length === 0 ? (
              <div className="flex items-center justify-center w-full text-gray-400 text-sm mt-20">
                Nenhuma etapa configurada.{" "}
                <button
                  className="ml-1 text-[#1A3568] underline"
                  onClick={() => setShowStagesConfig(true)}
                >
                  Configurar etapas
                </button>
              </div>
            ) : (
              etapas.map((etapa) => (
                <KanbanColumn
                  key={etapa.id}
                  etapa={etapa}
                  negocios={negociosByEtapa(etapa.id)}
                  draggingId={draggingId}
                  dragOverEtapa={dragOverEtapa}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onCardClick={setSelectedId}
                  onMarkWon={handleMarkWon}
                  onMarkLost={handleMarkLost}
                />
              ))
            )}
          </div>
        </div>

        {/* Side panel */}
        {selectedId && (
          <DealSidePanel
            negocioId={selectedId}
            onClose={() => setSelectedId(null)}
            onDeleted={() => setSelectedId(null)}
          />
        )}
      </div>

      {/* Dialogs */}
      <NewDealDialog
        open={showNewDeal}
        onClose={() => setShowNewDeal(false)}
        etapas={etapas}
      />
      <StagesConfigDialog
        open={showStagesConfig}
        onClose={() => setShowStagesConfig(false)}
      />
    </div>
  );
}
