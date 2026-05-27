import { Router, type IRouter } from "express";
import { z } from "zod";
import { pool, rowToInboxConversation, rowToMensagem } from "../lib/db";

const router: IRouter = Router();

const INBOX_SELECT = `
  SELECT
    c.id,
    c.contato_id,
    ct.nome AS contato_nome,
    ct.telefone AS contato_telefone,
    c.canal,
    c.status,
    c.atendente,
    c.criado_em,
    c.encerrado_em,
    c.classificacao,
    (SELECT texto FROM mensagens m WHERE m.conversa_id = c.id ORDER BY m.criado_em DESC LIMIT 1) AS ultima_mensagem,
    (SELECT COUNT(*) FROM mensagens m WHERE m.conversa_id = c.id) AS total_mensagens
  FROM conversas c
  JOIN contatos ct ON ct.id = c.contato_id
`;

router.get("/inbox", async (req, res): Promise<void> => {
  const StatusFilter = z.string().optional();
  const CanalFilter = z.string().optional();
  const status = StatusFilter.parse(req.query.status);
  const canal = CanalFilter.parse(req.query.canal);

  const conditions: string[] = [];
  const args: unknown[] = [];
  let paramIdx = 1;

  if (status) {
    conditions.push(`c.status = $${paramIdx++}`);
    args.push(status);
  }
  if (canal) {
    conditions.push(`c.canal = $${paramIdx++}`);
    args.push(canal);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await pool.query(
    `${INBOX_SELECT} ${where} ORDER BY c.criado_em DESC`,
    args
  );
  res.json(rows.map((r: Record<string, unknown>) => rowToInboxConversation(r)));
});

router.get("/inbox/stats", async (_req, res): Promise<void> => {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'aberta') AS abertas,
      COUNT(*) FILTER (WHERE status = 'em_andamento') AS em_andamento,
      COUNT(*) FILTER (WHERE status = 'resolvida') AS resolvidas,
      COUNT(*) AS total
    FROM conversas
  `);
  const r = rows[0] as Record<string, unknown>;
  res.json({
    abertas: parseInt(String(r.abertas ?? "0")),
    emAndamento: parseInt(String(r.em_andamento ?? "0")),
    resolvidas: parseInt(String(r.resolvidas ?? "0")),
    total: parseInt(String(r.total ?? "0")),
  });
});

router.get("/inbox/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const { rows } = await pool.query(`${INBOX_SELECT} WHERE c.id = $1`, [id]);
  if (rows.length === 0) { res.status(404).json({ error: "Conversa não encontrada" }); return; }
  res.json(rowToInboxConversation(rows[0] as Record<string, unknown>));
});

router.post("/inbox", async (req, res): Promise<void> => {
  const Body = z.object({
    contatoId: z.number().int().positive(),
    canal: z.enum(["whatsapp", "email", "instagram", "telefone"]),
    atendente: z.string().nullable().optional(),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const contact = await pool.query("SELECT id FROM contatos WHERE id = $1", [parsed.data.contatoId]);
  if (contact.rows.length === 0) { res.status(404).json({ error: "Contato não encontrado" }); return; }

  const { rows: convRows } = await pool.query(
    `INSERT INTO conversas (contato_id, canal, atendente) VALUES ($1,$2,$3) RETURNING id`,
    [parsed.data.contatoId, parsed.data.canal, parsed.data.atendente ?? null]
  );
  const newId = (convRows[0] as Record<string, unknown>).id as number;

  const { rows } = await pool.query(`${INBOX_SELECT} WHERE c.id = $1`, [newId]);
  res.status(201).json(rowToInboxConversation(rows[0] as Record<string, unknown>));
});

router.patch("/inbox/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const Body = z.object({
    status: z.enum(["aberta", "em_andamento", "resolvida"]).optional(),
    atendente: z.string().nullable().optional(),
    classificacao: z.string().nullable().optional(),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const existing = await pool.query("SELECT id FROM conversas WHERE id = $1", [id]);
  if (existing.rows.length === 0) { res.status(404).json({ error: "Conversa não encontrada" }); return; }

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (parsed.data.status !== undefined) {
    setClauses.push(`status = $${paramIdx++}`);
    values.push(parsed.data.status);
    if (parsed.data.status === "resolvida") {
      setClauses.push(`encerrado_em = NOW()`);
    }
  }
  if (parsed.data.atendente !== undefined) {
    setClauses.push(`atendente = $${paramIdx++}`);
    values.push(parsed.data.atendente);
  }
  if (parsed.data.classificacao !== undefined) {
    setClauses.push(`classificacao = $${paramIdx++}`);
    values.push(parsed.data.classificacao);
  }

  if (setClauses.length === 0) {
    const { rows } = await pool.query(`${INBOX_SELECT} WHERE c.id = $1`, [id]);
    res.json(rowToInboxConversation(rows[0] as Record<string, unknown>));
    return;
  }

  values.push(id);
  await pool.query(`UPDATE conversas SET ${setClauses.join(", ")} WHERE id = $${paramIdx}`, values);

  const { rows } = await pool.query(`${INBOX_SELECT} WHERE c.id = $1`, [id]);
  res.json(rowToInboxConversation(rows[0] as Record<string, unknown>));
});

router.get("/inbox/:id/mensagens", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const conv = await pool.query("SELECT id FROM conversas WHERE id = $1", [id]);
  if (conv.rows.length === 0) { res.status(404).json({ error: "Conversa não encontrada" }); return; }

  const { rows } = await pool.query(
    "SELECT * FROM mensagens WHERE conversa_id = $1 ORDER BY criado_em ASC",
    [id]
  );
  res.json(rows.map((r: Record<string, unknown>) => rowToMensagem(r)));
});

router.post("/inbox/:id/mensagens", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const conv = await pool.query("SELECT id, status FROM conversas WHERE id = $1", [id]);
  if (conv.rows.length === 0) { res.status(404).json({ error: "Conversa não encontrada" }); return; }

  const Body = z.object({
    texto: z.string().min(1),
    autor: z.string().min(1),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { rows } = await pool.query(
    "INSERT INTO mensagens (conversa_id, texto, autor) VALUES ($1,$2,$3) RETURNING *",
    [id, parsed.data.texto, parsed.data.autor]
  );

  const convStatus = (conv.rows[0] as Record<string, unknown>).status as string;
  if (convStatus === "aberta") {
    await pool.query("UPDATE conversas SET status = 'em_andamento' WHERE id = $1", [id]);
  }

  res.status(201).json(rowToMensagem(rows[0] as Record<string, unknown>));
});

export default router;
