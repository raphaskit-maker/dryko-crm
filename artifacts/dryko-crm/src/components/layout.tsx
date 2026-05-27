import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, UserPlus, Inbox } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { useGetInboxStats } from "@workspace/api-client-react";

function InboxBadge() {
  const { data } = useGetInboxStats();
  const count = (data?.abertas ?? 0) + (data?.emAndamento ?? 0);
  if (!count) return null;
  return (
    <span className="ml-auto bg-[#F4831F] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <Sidebar className="border-r border-sidebar-border">
          <SidebarHeader className="h-16 flex items-center px-4 border-b border-sidebar-border">
            <div className="flex items-center gap-2 font-bold text-xl text-sidebar-foreground">
              <div className="w-8 h-8 bg-accent rounded flex items-center justify-center text-white">D</div>
              Dryko CRM
            </div>
          </SidebarHeader>
          <SidebarContent className="py-4">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/"}>
                  <Link href="/">
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.startsWith("/contatos") && location !== "/contatos/novo"}>
                  <Link href="/contatos">
                    <Users className="w-4 h-4 mr-2" />
                    <span>Contatos</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/contatos/novo"}>
                  <Link href="/contatos/novo">
                    <UserPlus className="w-4 h-4 mr-2" />
                    <span>Novo Contato</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.startsWith("/caixa-de-entrada")}>
                  <Link href="/caixa-de-entrada">
                    <Inbox className="w-4 h-4 mr-2" />
                    <span>Caixa de Entrada</span>
                    <InboxBadge />
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
