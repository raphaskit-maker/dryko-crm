import { Router } from "express";
import { z } from "zod";
import { pool } from "../lib/db.js";

const router = Router();

const TAREFA_JOIN = `
  SELECT t.*, c.nome AS contato_nome
  FROM tarefas t
  LEFT JOIN contatos c ON c.id = t.contato_id
`;

function rowToTarefa(row: Record<string, unknown>) {
  return {
    id: row.id as number,
    titulo: row.titulo as string,
    descricao: (row.descricao as string | null) ?? null,
    contatoId: (row.contato_id as number | null) ?? null,
    contatoNome: (row.contato_nome as string | null) ?? null,
    responsavel: (row.responsavel as string | null) ?? null,
    dataHora: (row.data_hora as Date).toISOString(),
    prioridade: row.prioridade as string,
    status: row.status as string,
    criadoEm: (row.criado_em as Date).toISOString(),
  };
}

// GET /tarefas/stats
router.get("/stats", async (req, res) => {
  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);

  const { rows } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pendente' AND data_hora >= $1 AND data_hora <= $2) AS pendentes_hoje,
      COUNT(*) FILTER (WHERE status = 'pendente') AS pendentes_total,
      COUNT(*) FILTER (WHERE status = 'pendente' AND data_hora < $1) AS vencidas
    FROM tarefas
  `, [startOfDay.toISOString(), endOfDay.toISOString()]);

  res.json({
    pendentesHoje: parseInt(String(rows[0].pendentes_hoje ?? "0")),
    pendentesTotal: parseInt(String(rows[0].pendentes_total ?? "0")),
    vencidas: parseInt(String(rows[0].vencidas ?? "0")),
  });
});

// GET /tarefas
router.get("/", async (req, res) => {
  const status = req.query.status as string | undefined;
  const prioridade = req.query.prioridade as string | undefined;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (status && ["pendente", "concluida"].includes(status)) {
    conditions.push(`t.status = $${idx++}`);
    values.push(status);
  }
  if (prioridade && ["alta", "media", "baixa"].includes(prioridade)) {
    conditions.push(`t.prioridade = $${idx++}`);
    values.push(prioridade);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await pool.query(
    `${TAREFA_JOIN} ${where} ORDER BY t.data_hora ASC`,
    values
  );
  res.json(rows.map(rowToTarefa));
});

// POST /tarefas
router.post("/", async (req, res) => {
  const body = z.object({
    titulo: z.string().min(1),
    descricao: z.string().nullable().optional(),
    contatoId: z.number().int().nullable().optional(),
    responsavel: z.string().nullable().optional(),
    dataHora: z.string(),
    prioridade: z.enum(["alta", "media", "baixa"]),
    status: z.enum(["pendente", "concluida"]).optional().default("pendente"),
  }).parse(req.body);

  const { rows: [t] } = await pool.query(
    `INSERT INTO tarefas (titulo, descricao, contato_id, responsavel, data_hora, prioridade, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [body.titulo, body.descricao ?? null, body.contatoId ?? null, body.responsavel ?? null,
     body.dataHora, body.prioridade, body.status]
  );
  const { rows } = await pool.query(`${TAREFA_JOIN} WHERE t.id=$1`, [t.id]);
  res.status(201).json(rowToTarefa(rows[0]));
});

// GET /tarefas/:id
router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const { rows } = await pool.query(`${TAREFA_JOIN} WHERE t.id=$1`, [id]);
  if (rows.length === 0) { res.status(404).json({ error: "Tarefa não encontrada" }); return; }
  res.json(rowToTarefa(rows[0]));
});

// PATCH /tarefas/:id
router.patch("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const body = z.object({
    titulo: z.string().min(1).optional(),
    descricao: z.string().nullable().optional(),
    contatoId: z.number().int().nullable().optional(),
    responsavel: z.string().nullable().optional(),
    dataHora: z.string().optional(),
    prioridade: z.enum(["alta", "media", "baixa"]).optional(),
    status: z.enum(["pendente", "concluida"]).optional(),
  }).parse(req.body);

  const { rows: existing } = await pool.query("SELECT id FROM tarefas WHERE id=$1", [id]);
  if (existing.length === 0) { res.status(404).json({ error: "Tarefa não encontrada" }); return; }

  await pool.query(
    `UPDATE tarefas SET
      titulo = COALESCE($1, titulo),
      descricao = CASE WHEN $2::boolean THEN $3 ELSE descricao END,
      contato_id = CASE WHEN $4::boolean THEN $5::integer ELSE contato_id END,
      responsavel = CASE WHEN $6::boolean THEN $7 ELSE responsavel END,
      data_hora = COALESCE($8::timestamptz, data_hora),
      prioridade = COALESCE($9, prioridade),
      status = COALESCE($10, status)
    WHERE id = $11`,
    [
      body.titulo ?? null,
      "descricao" in body, body.descricao ?? null,
      "contatoId" in body, body.contatoId ?? null,
      "responsavel" in body, body.responsavel ?? null,
      body.dataHora ?? null,
      body.prioridade ?? null,
      body.status ?? null,
      id,
    ]
  );

  const { rows } = await pool.query(`${TAREFA_JOIN} WHERE t.id=$1`, [id]);
  res.json(rowToTarefa(rows[0]));
});

// DELETE /tarefas/:id
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const { rows } = await pool.query("SELECT id FROM tarefas WHERE id=$1", [id]);
  if (rows.length === 0) { res.status(404).json({ error: "Tarefa não encontrada" }); return; }

  await pool.query("DELETE FROM tarefas WHERE id=$1", [id]);
  res.status(204).send();
});

export default router;
