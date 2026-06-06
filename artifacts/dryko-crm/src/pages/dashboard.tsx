import {
  useGetContactStats,
  useListContacts,
  useGetPipelineStats,
  useListTarefas,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Users,
  Clock,
  AlertTriangle,
  TrendingUp,
  MessageCircle,
  Phone,
  Mail,
  Instagram,
  Plus,
  ArrowRight,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

function isOverdue(dateStr: string, status: string) {
  return status === "pendente" && new Date(dateStr) < new Date();
}
function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function Dashboard() {
  const { data: contactStats } = useGetContactStats();
  const { data: contacts } = useListContacts();
  const { data: pipelineStats } = useGetPipelineStats();
  const { data: tarefas = [] } = useListTarefas();
  const { data: conversas } = useQuery({
    queryKey: ["inbox-conversas-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/inbox");
      if (!res.ok) return [];
      return res.json() as Promise<Array<{ status: string }>>;
    },
  });

  const recentContacts = (contacts ?? []).slice(0, 5);
  const tarefasHoje = tarefas.filter(
    (t) => isToday(t.dataHora) && t.status === "pendente",
  ).length;
  const tarefasVencidas = tarefas.filter((t) =>
    isOverdue(t.dataHora, t.status),
  ).length;
  const tarefasPendentes = tarefas
    .filter((t) => t.status === "pendente")
    .slice(0, 5);
  const conversasAbertas = (conversas ?? []).filter(
    (c: { status: string }) =>
      c.status === "aberta" || c.status === "em_andamento",
  ).length;
  const pipelineChartData = (pipelineStats?.etapas ?? []).map((e) => ({
    nome: e.nome,
    negocios: e.totalNegocios,
    valor: e.totalValor,
    cor: e.cor,
  }));
  const totalPipelineValor = (pipelineStats?.etapas ?? []).reduce(
    (sum, e) => sum + e.totalValor,
    0,
  );

  const getCanalIcon = (canal: string) => {
    switch (canal.toLowerCase()) {
      case "whatsapp":
        return <MessageCircle className="w-3.5 h-3.5 text-green-500" />;
      case "telefone":
        return <Phone className="w-3.5 h-3.5 text-blue-500" />;
      case "email":
        return <Mail className="w-3.5 h-3.5 text-gray-500" />;
      case "instagram":
        return <Instagram className="w-3.5 h-3.5 text-pink-500" />;
      default:
        return <MessageCircle className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-6 overflow-y-auto h-full bg-gray-50">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A3568]">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Visão geral da operação comercial
          </p>
        </div>
        <Button asChild className="bg-[#F4831F] hover:bg-[#e07519]" size="sm">
          <Link href="/contatos/novo">
            <Plus className="w-4 h-4 mr-1" />
            Novo Contato
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-[#1A3568] text-white border-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 pt-4 px-4">
            <CardTitle className="text-xs font-medium opacity-80">
              Total Contatos
            </CardTitle>
            <Users className="w-4 h-4 opacity-70" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-3xl font-bold">{contactStats?.total ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[#F4831F]">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-500">
              Tarefas Hoje
            </CardTitle>
            <Clock className="w-4 h-4 text-[#F4831F]" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-3xl font-bold text-[#F4831F]">
              {tarefasHoje}
            </div>
          </CardContent>
        </Card>
        <Card
          className={tarefasVencidas > 0 ? "border-l-4 border-l-red-500" : ""}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-500">
              Vencidas
            </CardTitle>
            <AlertTriangle
              className={`w-4 h-4 ${tarefasVencidas > 0 ? "text-red-500" : "text-gray-300"}`}
            />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div
              className={`text-3xl font-bold ${tarefasVencidas > 0 ? "text-red-500" : "text-gray-700"}`}
            >
              {tarefasVencidas}
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-500">
              Conversas Abertas
            </CardTitle>
            <MessageCircle className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-3xl font-bold text-green-600">
              {conversasAbertas}
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-500">
              Pipeline Total
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-purple-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-lg font-bold text-purple-600">
              {formatBRL(totalPipelineValor)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-[#1A3568]">
                Negócios por Etapa
              </CardTitle>
              <Link
                href="/pipeline"
                className="text-xs text-[#F4831F] hover:underline flex items-center gap-1"
              >
                Ver pipeline <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {pipelineChartData.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-8">
                Nenhum negócio no pipeline
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={pipelineChartData}
                  margin={{ top: 4, right: 4, bottom: 24, left: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="nome"
                    tick={{ fontSize: 10 }}
                    angle={-15}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === "negocios"
                        ? `${value} negócios`
                        : formatBRL(value),
                      name === "negocios" ? "Negócios" : "Valor",
                    ]}
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  />
                  <Bar dataKey="negocios" radius={[4, 4, 0, 0]}>
                    {pipelineChartData.map((entry, index) => (
                      <Cell key={index} fill={entry.cor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-[#1A3568]">
                Tarefas Pendentes
              </CardTitle>
              <Link
                href="/tarefas"
                className="text-xs text-[#F4831F] hover:underline flex items-center gap-1"
              >
                Ver todas <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {tarefasPendentes.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-8">
                Nenhuma tarefa pendente 🎉
              </div>
            ) : (
              <div className="space-y-2">
                {tarefasPendentes.map((t) => {
                  const overdue = isOverdue(t.dataHora, t.status);
                  const today = isToday(t.dataHora);
                  return (
                    <div
                      key={t.id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border-l-4 ${overdue ? "bg-red-50 border-l-red-400" : today ? "bg-orange-50 border-l-[#F4831F]" : "bg-white border-l-gray-200 shadow-sm"}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {t.titulo}
                        </p>
                        <p
                          className={`text-xs mt-0.5 ${overdue ? "text-red-500 font-semibold" : today ? "text-[#F4831F] font-medium" : "text-gray-400"}`}
                        >
                          {new Date(t.dataHora).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {overdue && " · Vencida"}
                          {today && !overdue && " · Hoje"}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${t.prioridade === "alta" ? "bg-red-100 text-red-700" : t.prioridade === "media" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}
                      >
                        {t.prioridade === "alta"
                          ? "Alta"
                          : t.prioridade === "media"
                            ? "Média"
                            : "Baixa"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-[#1A3568]">
              Contatos Recentes
            </CardTitle>
            <Link
              href="/contatos"
              className="text-xs text-[#F4831F] hover:underline flex items-center gap-1"
            >
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {recentContacts.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">
              Nenhum contato encontrado.
            </div>
          ) : (
            <div className="divide-y">
              {recentContacts.map((contact) => (
                <Link
                  key={contact.id}
                  href={`/contatos/${contact.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#1A3568]/10 flex items-center justify-center text-[#1A3568] font-bold text-sm">
                      {contact.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {contact.nome}
                      </p>
                      <p className="text-xs text-gray-400">
                        {contact.telefone}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full capitalize flex items-center gap-1.5">
                    {getCanalIcon(contact.canal)}
                    {contact.canal}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
