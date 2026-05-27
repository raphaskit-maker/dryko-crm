import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListTarefas,
  useCreateTarefa,
  useUpdateTarefa,
  useDeleteTarefa,
  useListContacts,
  getListTarefasQueryKey,
  getGetTarefasStatsQueryKey,
  type Tarefa,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Plus,
  X,
  CheckCircle2,
  Clock,
  User,
  Calendar,
  Flag,
  Pencil,
  Trash2,
  CalendarClock,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PRIORIDADE_CONFIG = {
  alta:  { label: "Alta",  color: "#EF4444", bg: "bg-red-100 text-red-700",    border: "#EF4444" },
  media: { label: "Média", color: "#F59E0B", bg: "bg-yellow-100 text-yellow-700", border: "#F59E0B" },
  baixa: { label: "Baixa", color: "#10B981", bg: "bg-green-100 text-green-700",  border: "#10B981" },
} as const;

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isOverdue(dateStr: string, status: string) {
  return status === "pendente" && new Date(dateStr) < new Date();
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDatetimeLocal(dateStr: string) {
  const d = new Date(dateStr);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── TaskCard ─────────────────────────────────────────────────────────────────

function TaskCard({
  tarefa,
  onClick,
  onConcluir,
  onReagendar,
}: {
  tarefa: Tarefa;
  onClick: () => void;
  onConcluir: () => void;
  onReagendar: () => void;
}) {
  const overdue = isOverdue(tarefa.dataHora, tarefa.status);
  const today = isToday(tarefa.dataHora) && tarefa.status === "pendente";
  const done = tarefa.status === "concluida";
  const pri = PRIORIDADE_CONFIG[tarefa.prioridade as keyof typeof PRIORIDADE_CONFIG];

  let cardBg = "bg-white";
  if (overdue) cardBg = "bg-red-50";
  else if (today) cardBg = "bg-orange-50";
  else if (done) cardBg = "bg-gray-50";

  let timeColor = "text-gray-500";
  if (overdue) timeColor = "text-red-600 font-semibold";
  else if (today) timeColor = "text-[#F4831F] font-semibold";

  return (
    <div
      onClick={onClick}
      className={`${cardBg} border rounded-xl p-4 cursor-pointer hover:shadow-md transition-all`}
      style={{ borderLeft: `4px solid ${overdue ? "#EF4444" : today ? "#F4831F" : pri.border}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`font-semibold text-gray-800 ${done ? "line-through text-gray-400" : ""}`}>
              {tarefa.titulo}
            </span>
            {overdue && (
              <span className="flex items-center gap-0.5 text-xs text-red-600 font-bold">
                <AlertTriangle className="w-3 h-3" /> Vencida
              </span>
            )}
            {today && !overdue && (
              <span className="text-xs text-[#F4831F] font-bold">Hoje</span>
            )}
          </div>

          {tarefa.descricao && (
            <p className="text-xs text-gray-500 truncate mb-2">{tarefa.descricao}</p>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            <span className={`flex items-center gap-1 ${timeColor}`}>
              <Calendar className="w-3 h-3" />
              {formatDateTime(tarefa.dataHora)}
            </span>
            {tarefa.contatoNome && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {tarefa.contatoNome}
              </span>
            )}
            {tarefa.responsavel && (
              <span className="flex items-center gap-1">
                <span className="text-gray-300">👤</span>
                {tarefa.responsavel}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pri.bg}`}>
            <Flag className="w-2.5 h-2.5 inline mr-0.5" />
            {pri.label}
          </span>
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              done
                ? "bg-green-100 text-green-700"
                : "bg-blue-100 text-blue-700"
            }`}
          >
            {done ? "Concluída" : "Pendente"}
          </span>
        </div>
      </div>

      {!done && (
        <div
          className="flex gap-2 mt-3 pt-3 border-t"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onConcluir}
            className="flex items-center gap-1 text-xs text-green-600 hover:bg-green-100 rounded px-2 py-1 transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Concluir
          </button>
          <button
            onClick={onReagendar}
            className="flex items-center gap-1 text-xs text-blue-600 hover:bg-blue-100 rounded px-2 py-1 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reagendar
          </button>
        </div>
      )}
    </div>
  );
}

// ─── TaskSidePanel ─────────────────────────────────────────────────────────────

function TaskSidePanel({
  tarefa,
  onClose,
  onDeleted,
}: {
  tarefa: Tarefa;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: contatos } = useListContacts();

  const [editing, setEditing] = useState(false);
  const [titulo, setTitulo] = useState(tarefa.titulo);
  const [descricao, setDescricao] = useState(tarefa.descricao ?? "");
  const [contatoId, setContatoId] = useState<string>(tarefa.contatoId ? String(tarefa.contatoId) : "none");
  const [responsavel, setResponsavel] = useState(tarefa.responsavel ?? "");
  const [dataHora, setDataHora] = useState(toDatetimeLocal(tarefa.dataHora));
  const [prioridade, setPrioridade] = useState(tarefa.prioridade);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: getListTarefasQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetTarefasStatsQueryKey() });
  };

  const updateMutation = useUpdateTarefa({
    mutation: {
      onSuccess: () => { invalidate(); setEditing(false); toast({ title: "Tarefa atualizada" }); },
      onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteTarefa({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Tarefa excluída" }); onDeleted(); },
    },
  });

  const overdue = isOverdue(tarefa.dataHora, tarefa.status);
  const today = isToday(tarefa.dataHora) && tarefa.status === "pendente";
  const done = tarefa.status === "concluida";
  const pri = PRIORIDADE_CONFIG[tarefa.prioridade as keyof typeof PRIORIDADE_CONFIG];

  let accentColor: string = pri.color;
  if (overdue) accentColor = "#EF4444";
  else if (today) accentColor = "#F4831F";

  function saveEdit() {
    updateMutation.mutate({
      id: tarefa.id,
      data: {
        titulo: titulo.trim() || tarefa.titulo,
        descricao: descricao.trim() || null,
        contatoId: contatoId !== "none" ? parseInt(contatoId) : null,
        responsavel: responsavel.trim() || null,
        dataHora: new Date(dataHora).toISOString(),
        prioridade: prioridade as "alta" | "media" | "baixa",
      },
    });
  }

  function markDone() {
    updateMutation.mutate({ id: tarefa.id, data: { status: "concluida" } });
  }

  function markPending() {
    updateMutation.mutate({ id: tarefa.id, data: { status: "pendente" } });
  }

  return (
    <div className="w-80 border-l bg-white flex flex-col h-full shadow-xl">
      {/* Header */}
      <div
        className="flex items-start justify-between p-4 border-b gap-2"
        style={{ borderTop: `3px solid ${accentColor}` }}
      >
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-800 text-sm leading-tight">{tarefa.titulo}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${pri.bg}`}>
              {pri.label}
            </span>
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                done ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
              }`}
            >
              {done ? "Concluída" : overdue ? "⚠ Vencida" : today ? "Hoje" : "Pendente"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!done && (
            <button
              onClick={() => setEditing((v) => !v)}
              className="text-gray-400 hover:text-[#1A3568] p-1 rounded"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {editing ? (
          /* Edit form */
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Título</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="mt-1 h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="mt-1 text-sm resize-none"
                rows={3}
              />
            </div>
            <div>
              <Label className="text-xs">Contato</Label>
              <Select value={contatoId} onValueChange={setContatoId}>
                <SelectTrigger className="mt-1 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {(contatos ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Responsável</Label>
              <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className="mt-1 h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Data e hora</Label>
              <Input
                type="datetime-local"
                value={dataHora}
                onChange={(e) => setDataHora(e.target.value)}
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Prioridade</Label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as typeof prioridade)}>
                <SelectTrigger className="mt-1 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => setEditing(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-[#1A3568] hover:bg-[#142b55]"
                onClick={saveEdit}
                disabled={updateMutation.isPending}
              >
                Salvar
              </Button>
            </div>
          </div>
        ) : (
          /* View details */
          <div className="space-y-3 text-sm">
            {tarefa.descricao && (
              <div>
                <div className="text-xs text-gray-400 font-medium mb-1">Descrição</div>
                <p className="text-gray-700 leading-relaxed">{tarefa.descricao}</p>
              </div>
            )}
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <CalendarClock className={`w-4 h-4 mt-0.5 ${overdue ? "text-red-500" : today ? "text-[#F4831F]" : "text-gray-400"}`} />
                <div>
                  <div className="text-xs text-gray-400">Data e hora</div>
                  <div className={overdue ? "text-red-600 font-semibold" : today ? "text-[#F4831F] font-semibold" : "text-gray-700"}>
                    {formatDateTime(tarefa.dataHora)}
                  </div>
                </div>
              </div>
              {tarefa.contatoNome && (
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <div className="text-xs text-gray-400">Contato</div>
                    <div className="text-gray-700">{tarefa.contatoNome}</div>
                  </div>
                </div>
              )}
              {tarefa.responsavel && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">👤</span>
                  <div>
                    <div className="text-xs text-gray-400">Responsável</div>
                    <div className="text-gray-700">{tarefa.responsavel}</div>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-xs text-gray-400">Criada em</div>
                  <div className="text-gray-700">
                    {new Date(tarefa.criadoEm).toLocaleDateString("pt-BR")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="p-4 border-t space-y-2">
        {done ? (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={markPending}
            disabled={updateMutation.isPending}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Marcar como Pendente
          </Button>
        ) : (
          <Button
            size="sm"
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={markDone}
            disabled={updateMutation.isPending}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Marcar como Concluída
          </Button>
        )}
        <Button
          size="sm"
          variant="destructive"
          className="w-full"
          onClick={() => {
            if (confirm("Excluir esta tarefa?")) deleteMutation.mutate({ id: tarefa.id });
          }}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Excluir Tarefa
        </Button>
      </div>
    </div>
  );
}

// ─── NewTaskDialog ─────────────────────────────────────────────────────────────

function NewTaskDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: contatos } = useListContacts();

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [contatoId, setContatoId] = useState("none");
  const [responsavel, setResponsavel] = useState("");
  const [dataHora, setDataHora] = useState(() => {
    const d = new Date(); d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return toDatetimeLocal(d.toISOString());
  });
  const [prioridade, setPrioridade] = useState<"alta" | "media" | "baixa">("media");

  const createMutation = useCreateTarefa({
    mutation: {
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: getListTarefasQueryKey() });
        void qc.invalidateQueries({ queryKey: getGetTarefasStatsQueryKey() });
        toast({ title: "Tarefa criada com sucesso!" });
        reset(); onClose();
      },
      onError: () => toast({ title: "Erro ao criar tarefa", variant: "destructive" }),
    },
  });

  function reset() {
    setTitulo(""); setDescricao(""); setContatoId("none");
    setResponsavel(""); setPrioridade("media");
    const d = new Date(); d.setMinutes(0,0,0); d.setHours(d.getHours()+1);
    setDataHora(toDatetimeLocal(d.toISOString()));
  }

  function handleClose() { reset(); onClose(); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;
    createMutation.mutate({
      data: {
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        contatoId: contatoId !== "none" ? parseInt(contatoId) : null,
        responsavel: responsavel.trim() || null,
        dataHora: new Date(dataHora).toISOString(),
        prioridade: prioridade as "alta" | "media" | "baixa",
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Título *</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Ligar para cliente confirmar visita"
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes da tarefa..."
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Prioridade *</Label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as typeof prioridade)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Contato vinculado</Label>
              <Select value={contatoId} onValueChange={setContatoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {(contatos ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Data e hora *</Label>
            <Input
              type="datetime-local"
              value={dataHora}
              onChange={(e) => setDataHora(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Responsável</Label>
            <Input
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              placeholder="Ex: João Silva"
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
              {createMutation.isPending ? "Criando..." : "Criar Tarefa"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── ReagendarDialog ───────────────────────────────────────────────────────────

function ReagendarDialog({
  tarefa,
  onClose,
}: {
  tarefa: Tarefa;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dataHora, setDataHora] = useState(toDatetimeLocal(tarefa.dataHora));

  const updateMutation = useUpdateTarefa({
    mutation: {
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: getListTarefasQueryKey() });
        void qc.invalidateQueries({ queryKey: getGetTarefasStatsQueryKey() });
        toast({ title: "Tarefa reagendada!" });
        onClose();
      },
    },
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Reagendar Tarefa</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-gray-500 truncate">{tarefa.titulo}</p>
          <div className="space-y-1">
            <Label>Nova data e hora</Label>
            <Input
              type="datetime-local"
              value={dataHora}
              onChange={(e) => setDataHora(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-[#1A3568] hover:bg-[#142b55]"
              onClick={() =>
                updateMutation.mutate({
                  id: tarefa.id,
                  data: { dataHora: new Date(dataHora).toISOString() },
                })
              }
              disabled={updateMutation.isPending}
            >
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tarefas Page ─────────────────────────────────────────────────────────────

type StatusFilter = "todas" | "pendente" | "concluida";
type PrioFilter = "todas" | "alta" | "media" | "baixa";

export default function Tarefas() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: tarefas = [], isLoading } = useListTarefas();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas");
  const [prioFilter, setPrioFilter] = useState<PrioFilter>("todas");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [reagendarTarefa, setReagendarTarefa] = useState<Tarefa | null>(null);

  const updateMutation = useUpdateTarefa({
    mutation: {
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: getListTarefasQueryKey() });
        void qc.invalidateQueries({ queryKey: getGetTarefasStatsQueryKey() });
      },
      onError: () => toast({ title: "Erro ao atualizar tarefa", variant: "destructive" }),
    },
  });

  const filtered = useMemo(() => {
    return tarefas
      .filter((t) => statusFilter === "todas" || t.status === statusFilter)
      .filter((t) => prioFilter === "todas" || t.prioridade === prioFilter);
  }, [tarefas, statusFilter, prioFilter]);

  // Counts for tab labels
  const pendentes = tarefas.filter((t) => t.status === "pendente").length;
  const vencidas = tarefas.filter((t) => isOverdue(t.dataHora, t.status)).length;
  const hoje = tarefas.filter((t) => isToday(t.dataHora) && t.status === "pendente").length;

  const selectedTarefa = tarefas.find((t) => t.id === selectedId) ?? null;

  const tabs: { key: StatusFilter; label: string; count?: number }[] = [
    { key: "todas", label: "Todas", count: tarefas.length },
    { key: "pendente", label: "Pendentes", count: pendentes },
    { key: "concluida", label: "Concluídas", count: tarefas.filter((t) => t.status === "concluida").length },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-[#1A3568]">Tarefas</h1>
            <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
              {vencidas > 0 && (
                <span className="flex items-center gap-1 text-red-500 font-semibold">
                  <AlertTriangle className="w-3 h-3" />
                  {vencidas} vencida{vencidas > 1 ? "s" : ""}
                </span>
              )}
              {hoje > 0 && (
                <span className="text-[#F4831F] font-semibold">
                  {hoje} para hoje
                </span>
              )}
            </div>
          </div>
          <Button
            className="bg-[#F4831F] hover:bg-[#e07519] gap-1"
            size="sm"
            onClick={() => setShowNew(true)}
          >
            <Plus className="w-4 h-4" />
            Nova Tarefa
          </Button>
        </div>

        {/* Tabs + priority filter */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  statusFilter === tab.key
                    ? "bg-[#1A3568] text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span
                    className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center ${
                      statusFilter === tab.key
                        ? "bg-white text-[#1A3568]"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <Select value={prioFilter} onValueChange={(v) => setPrioFilter(v as PrioFilter)}>
            <SelectTrigger className="w-36 h-8 text-sm">
              <Flag className="w-3 h-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas prioridades</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Task list */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center text-gray-400 mt-20">Carregando tarefas...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-gray-400 mt-20">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Nenhuma tarefa encontrada.</p>
              <button
                className="text-[#1A3568] underline text-sm mt-1"
                onClick={() => setShowNew(true)}
              >
                Criar primeira tarefa
              </button>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-3">
              {/* Overdue group */}
              {statusFilter !== "concluida" && filtered.some((t) => isOverdue(t.dataHora, t.status)) && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="text-xs font-bold text-red-500 uppercase tracking-wide">Vencidas</span>
                  </div>
                  {filtered
                    .filter((t) => isOverdue(t.dataHora, t.status))
                    .map((t) => (
                      <div key={t.id} className="mb-2">
                        <TaskCard
                          tarefa={t}
                          onClick={() => setSelectedId(t.id)}
                          onConcluir={() => updateMutation.mutate({ id: t.id, data: { status: "concluida" } })}
                          onReagendar={() => setReagendarTarefa(t)}
                        />
                      </div>
                    ))}
                </div>
              )}

              {/* Today group */}
              {statusFilter !== "concluida" && filtered.some((t) => isToday(t.dataHora) && t.status === "pendente" && !isOverdue(t.dataHora, t.status)) && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarClock className="w-4 h-4 text-[#F4831F]" />
                    <span className="text-xs font-bold text-[#F4831F] uppercase tracking-wide">Hoje</span>
                  </div>
                  {filtered
                    .filter((t) => isToday(t.dataHora) && t.status === "pendente" && !isOverdue(t.dataHora, t.status))
                    .map((t) => (
                      <div key={t.id} className="mb-2">
                        <TaskCard
                          tarefa={t}
                          onClick={() => setSelectedId(t.id)}
                          onConcluir={() => updateMutation.mutate({ id: t.id, data: { status: "concluida" } })}
                          onReagendar={() => setReagendarTarefa(t)}
                        />
                      </div>
                    ))}
                </div>
              )}

              {/* Remaining tasks */}
              {filtered
                .filter((t) => {
                  const over = isOverdue(t.dataHora, t.status);
                  const tod = isToday(t.dataHora) && t.status === "pendente";
                  return !over && !tod;
                })
                .map((t) => (
                  <TaskCard
                    key={t.id}
                    tarefa={t}
                    onClick={() => setSelectedId(t.id)}
                    onConcluir={() => updateMutation.mutate({ id: t.id, data: { status: "concluida" } })}
                    onReagendar={() => setReagendarTarefa(t)}
                  />
                ))}
            </div>
          )}
        </div>

        {/* Side panel */}
        {selectedTarefa && (
          <TaskSidePanel
            key={selectedTarefa.id}
            tarefa={selectedTarefa}
            onClose={() => setSelectedId(null)}
            onDeleted={() => setSelectedId(null)}
          />
        )}
      </div>

      {/* Dialogs */}
      <NewTaskDialog open={showNew} onClose={() => setShowNew(false)} />
      {reagendarTarefa && (
        <ReagendarDialog tarefa={reagendarTarefa} onClose={() => setReagendarTarefa(null)} />
      )}
    </div>
  );
}
