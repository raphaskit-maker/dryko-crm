import { useGetContactStats, useListContacts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Phone, Mail, MessageCircle, Instagram } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetContactStats();
  const { data: contacts, isLoading: contactsLoading } = useListContacts();

  const recentContacts = contacts?.slice(0, 5) || [];

  const getCanalIcon = (canal: string) => {
    switch (canal.toLowerCase()) {
      case "whatsapp": return <MessageCircle className="w-4 h-4 text-green-500" />;
      case "telefone": return <Phone className="w-4 h-4 text-blue-500" />;
      case "email": return <Mail className="w-4 h-4 text-gray-500" />;
      case "instagram": return <Instagram className="w-4 h-4 text-pink-500" />;
      default: return <MessageCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-8 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Visão geral da sua operação comercial.</p>
        </div>
        <Button asChild className="bg-accent hover:bg-accent/90 text-white">
          <Link href="/contatos/novo">Novo Contato</Link>
        </Button>
      </div>

      {statsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-10 bg-muted/50 rounded-t-lg" />
              <CardContent className="h-20 bg-muted/20" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="bg-primary text-primary-foreground">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Total de contatos</CardTitle>
              <Users className="w-4 h-4 opacity-80" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.total || 0}</div>
            </CardContent>
          </Card>
          
          {stats?.porCanal?.map((stat) => (
            <Card key={stat.canal}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium capitalize">{stat.canal}</CardTitle>
                {getCanalIcon(stat.canal)}
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.total}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Contatos Recentes</h2>
        <div className="border rounded-lg bg-card text-card-foreground shadow-sm">
          {contactsLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : recentContacts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum contato encontrado.</div>
          ) : (
            <div className="divide-y">
              {recentContacts.map(contact => (
                <Link key={contact.id} href={`/contatos/${contact.id}`} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                      {contact.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{contact.nome}</p>
                      <p className="text-sm text-muted-foreground">{contact.telefone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded-full capitalize flex items-center gap-1">
                      {getCanalIcon(contact.canal)}
                      {contact.canal}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
