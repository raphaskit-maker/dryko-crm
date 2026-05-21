import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useImportContacts, getListContactsQueryKey, getGetContactStatsQueryKey, getListTagsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CSVImportDialog({ open, onOpenChange }: CSVImportDialogProps) {
  const [csvText, setCsvText] = useState("");
  const importContacts = useImportContacts();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleImport = () => {
    if (!csvText.trim()) return;

    // Parse CSV (basic implementation)
    const lines = csvText.trim().split("\n");
    const registros = lines.map(line => {
      const parts = line.split(",").map(p => p.trim());
      // nome,telefone,email,canal,tags,notas
      const [nome = "", telefone = "", email = "", canalStr = "", tagsStr = "", notas = ""] = parts;
      
      const canalValid = ["whatsapp", "email", "instagram", "telefone"].includes(canalStr.toLowerCase()) 
        ? canalStr.toLowerCase() as "whatsapp" | "email" | "instagram" | "telefone" 
        : "whatsapp";
        
      return {
        nome: nome || "Sem Nome",
        telefone: telefone || "0000000000",
        email: email || undefined,
        canal: canalValid,
        tags: tagsStr ? tagsStr.split(";").map(t => t.trim()).filter(Boolean) : undefined,
        notas: notas || undefined
      };
    });

    importContacts.mutate(
      { data: { registros } },
      {
        onSuccess: (result) => {
          queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetContactStatsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListTagsQueryKey() });
          
          if (result.importados > 0) {
            toast({
              title: "Importação concluída",
              description: `${result.importados} contatos importados com sucesso.`,
            });
          }
          if (result.erros && result.erros.length > 0) {
            toast({
              variant: "destructive",
              title: "Erros na importação",
              description: `${result.erros.length} erros encontrados.`,
            });
          }
          onOpenChange(false);
          setCsvText("");
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Erro ao importar",
            description: "Não foi possível realizar a importação do CSV.",
          });
        }
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Importar Contatos</DialogTitle>
          <DialogDescription>
            Cole seus dados no formato CSV (separado por vírgulas).
            Ordem esperada: nome,telefone,email,canal,tags,notas
            (Use ponto e vírgula para múltiplas tags)
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="Exemplo: João Silva,11999999999,joao@email.com,whatsapp,cliente;vip,Notas do cliente..."
            className="min-h-[200px]"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={importContacts.isPending || !csvText.trim()}>
            {importContacts.isPending ? "Importando..." : "Importar CSV"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
