import { Router, type IRouter } from "express";
import { pool, rowToInteracao } from "../lib/db";
import {
  ListConversationsParams,
  CreateConversationParams,
  CreateConversationBody,
  DeleteConversationParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/contacts/:id/conversations", async (req, res): Promise<void> => {
  const params = ListConversationsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { rows } = await pool.query(
    "SELECT * FROM interacoes WHERE contato_id = $1 ORDER BY criado_em ASC",
    [params.data.id]
  );

  res.json(rows.map((r: Record<string, unknown>) => rowToInteracao(r)));
});

router.post("/contacts/:id/conversations", async (req, res): Promise<void> => {
  const params = CreateConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const contact = await pool.query("SELECT id FROM contatos WHERE id = $1", [params.data.id]);
  if (contact.rows.length === 0) {
    res.status(404).json({ error: "Contato não encontrado" });
    return;
  }

  const parsed = CreateConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { conteudo, canal, direcao } = parsed.data;

  const { rows } = await pool.query(
    `INSERT INTO interacoes (contato_id, conteudo, canal, direcao)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [params.data.id, conteudo, canal, direcao]
  );
  res.status(201).json(rowToInteracao(rows[0] as Record<string, unknown>));
});

router.delete("/conversations/:id", async (req, res): Promise<void> => {
  const params = DeleteConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { rows } = await pool.query("SELECT id FROM interacoes WHERE id = $1", [params.data.id]);
  if (rows.length === 0) {
    res.status(404).json({ error: "Interação não encontrada" });
    return;
  }

  await pool.query("DELETE FROM interacoes WHERE id = $1", [params.data.id]);
  res.sendStatus(204);
});

export default router;
