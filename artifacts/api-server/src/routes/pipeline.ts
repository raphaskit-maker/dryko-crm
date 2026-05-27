import { Router } from "express";
import { z } from "zod";
import { pool, rowToNegocio, rowToEtapa, rowToHistorico } from "../lib/db.js";

const router = Router();

const NEGOCIO_JOIN = `
  SELECT n.*, c.nome AS contato_nome, e.nome AS etapa_nome, e.cor AS etapa_cor
  FROM negocios n
  LEFT JOIN contatos c ON c.id = n.contato_id
  LEFT JOIN etapas_pipeline e ON e.id = n.etapa_id
`;

const ETAPA_STATS_JOIN = `
  SELECT e.*,
    COUNT(n.id) FILTER (WHERE n.status = 'ativo') AS total_negocios,
    COALESCE(SUM(n.valor) FILTER (WHERE n.status = 'ativo'), 0) AS total_valor
  FROM etapas_pipeline e
  LEFT JOIN negocios n ON n.etapa_id = e.id
  GROUP BY e.id
  ORDER BY e.ordem
`;

// GET /pipeline/stats
router.get("/stats", async (req, res) => {
  const { rows } = await pool.query(ETAPA_STATS_JOIN);
  res.json({ etapas: rows.map(rowToEtapa) });
});

// GET /pipeline/etapas
router.get("/etapas", async (req, res) => {
  const { rows } = await pool.query(ETAPA_STATS_JOIN);
  res.json(rows.map(rowToEtapa));
});

// POST /pipeline/etapas
router.post("/etapas", async (req, res) => {
  const body = z
    .object({
      nome: z.string().min(1),
      ordem: z.number().int().optional(),
      cor: z.string().optional(),
    })
    .parse(req.body);

  let ordem = body.ordem;
  if (ordem === undefined) {
    const { rows } = await pool.query("SELECT COALESCE(MAX(ordem),0)+1 AS next FROM etapas_pipeline");
    ordem = rows[0].next as number;
  }

  const { rows } = await pool.query(
    "INSERT INTO etapas_pipeline (nome, ordem, cor) VALUES ($1,$2,$3) RETURNING id",
    [body.nome, ordem, body.cor ?? "#6B7280"]
  );
  const { rows: full } = await pool.query(
    `${ETAPA_STATS_JOIN.replace("ORDER BY e.ordem", "HAVING e.id = $1 ORDER BY e.ordem")}`,
    [rows[0].id]
  );
  if (full.length === 0) {
    const { rows: e } = await pool.query(
      `SELECT e.*, 0 AS total_negocios, 0 AS total_valor FROM etapas_pipeline e WHERE e.id=$1`,
      [rows[0].id]
    );
    res.status(201).json(rowToEtapa(e[0]));
    return;
  }
  res.status(201).json(rowToEtapa(full[0]));
});

// PUT /pipeline/etapas/:id
router.put("/etapas/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const body = z
    .object({
      nome: z.string().min(1),
      ordem: z.number().int().optional(),
      cor: z.string().optional(),
    })
    .parse(req.body);

  const { rows: existing } = await pool.query("SELECT id FROM etapas_pipeline WHERE id=$1", [id]);
  if (existing.length === 0) { res.status(404).json({ error: "Etapa não encontrada" }); return; }

  await pool.query(
    "UPDATE etapas_pipeline SET nome=$1, ordem=COALESCE($2,ordem), cor=COALESCE($3,cor) WHERE id=$4",
    [body.nome, body.ordem ?? null, body.cor ?? null, id]
  );

  const { rows } = await pool.query(
    `SELECT e.*, COUNT(n.id) FILTER (WHERE n.status='ativo') AS total_negocios,
     COALESCE(SUM(n.valor) FILTER (WHERE n.status='ativo'),0) AS total_valor
     FROM etapas_pipeline e LEFT JOIN negocios n ON n.etapa_id=e.id WHERE e.id=$1 GROUP BY e.id`,
    [id]
  );
  res.json(rowToEtapa(rows[0]));
});

// DELETE /pipeline/etapas/:id
router.delete("/etapas/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const { rows: existing } = await pool.query("SELECT id FROM etapas_pipeline WHERE id=$1", [id]);
  if (existing.length === 0) { res.status(404).json({ error: "Etapa não encontrada" }); return; }

  const { rows: count } = await pool.query("SELECT COUNT(*) AS c FROM negocios WHERE etapa_id=$1", [id]);
  if (parseInt(count[0].c) > 0) {
    res.status(409).json({ error: "Etapa possui negócios vinculados. Mova-os antes de excluir." });
    return;
  }

  await pool.query("DELETE FROM etapas_pipeline WHERE id=$1", [id]);
  res.status(204).send();
});

// GET /pipeline/negocios
router.get("/negocios", async (req, res) => {
  const { rows } = await pool.query(`${NEGOCIO_JOIN} ORDER BY n.criado_em DESC`);
  res.json(rows.map(rowToNegocio));
});

// POST /pipeline/negocios
router.post("/negocios", async (req, res) => {
  const body = z
    .object({
      nome: z.string().min(1),
      valor: z.number().optional().default(0),
      contatoId: z.number().int().nullable().optional(),
      responsavel: z.string().nullable().optional(),
      prazo: z.string().nullable().optional(),
      etapaId: z.number().int(),
    })
    .parse(req.body);

  const { rows: etapa } = await pool.query("SELECT nome FROM etapas_pipeline WHERE id=$1", [body.etapaId]);
  if (etapa.length === 0) { res.status(400).json({ error: "Etapa não encontrada" }); return; }

  const { rows: [neg] } = await pool.query(
    `INSERT INTO negocios (nome, valor, contato_id, responsavel, prazo, etapa_id, status)
     VALUES ($1,$2,$3,$4,$5,$6,'ativo') RETURNING id`,
    [body.nome, body.valor, body.contatoId ?? null, body.responsavel ?? null, body.prazo ?? null, body.etapaId]
  );

  await pool.query(
    "INSERT INTO historico_pipeline (negocio_id, etapa_anterior, etapa_nova) VALUES ($1,$2,$3)",
    [neg.id, null, etapa[0].nome]
  );

  const { rows } = await pool.query(`${NEGOCIO_JOIN} WHERE n.id=$1`, [neg.id]);
  res.status(201).json(rowToNegocio(rows[0]));
});

// GET /pipeline/negocios/:id
router.get("/negocios/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const { rows } = await pool.query(`${NEGOCIO_JOIN} WHERE n.id=$1`, [id]);
  if (rows.length === 0) { res.status(404).json({ error: "Negócio não encontrado" }); return; }
  res.json(rowToNegocio(rows[0]));
});

// PATCH /pipeline/negocios/:id
router.patch("/negocios/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const body = z
    .object({
      nome: z.string().min(1).optional(),
      valor: z.number().optional(),
      contatoId: z.number().int().nullable().optional(),
      responsavel: z.string().nullable().optional(),
      prazo: z.string().nullable().optional(),
      etapaId: z.number().int().optional(),
      status: z.enum(["ativo", "ganho", "perdido"]).optional(),
    })
    .parse(req.body);

  const { rows: existing } = await pool.query(`${NEGOCIO_JOIN} WHERE n.id=$1`, [id]);
  if (existing.length === 0) { res.status(404).json({ error: "Negócio não encontrado" }); return; }

  const current = rowToNegocio(existing[0]);

  if (body.etapaId !== undefined && body.etapaId !== current.etapaId) {
    const { rows: novaEtapa } = await pool.query("SELECT nome FROM etapas_pipeline WHERE id=$1", [body.etapaId]);
    if (novaEtapa.length === 0) { res.status(400).json({ error: "Etapa não encontrada" }); return; }
    await pool.query(
      "INSERT INTO historico_pipeline (negocio_id, etapa_anterior, etapa_nova) VALUES ($1,$2,$3)",
      [id, current.etapaNome, novaEtapa[0].nome]
    );
  }

  if (body.status !== undefined && body.status !== current.status && (body.status === "ganho" || body.status === "perdido")) {
    await pool.query(
      "INSERT INTO historico_pipeline (negocio_id, etapa_anterior, etapa_nova) VALUES ($1,$2,$3)",
      [id, current.etapaNome, body.status === "ganho" ? "Ganho" : "Perdido"]
    );
  }

  await pool.query(
    `UPDATE negocios SET
      nome = COALESCE($1, nome),
      valor = COALESCE($2, valor),
      contato_id = CASE WHEN $3::boolean THEN $4::integer ELSE contato_id END,
      responsavel = CASE WHEN $5::boolean THEN $6 ELSE responsavel END,
      prazo = CASE WHEN $7::boolean THEN $8::date ELSE prazo END,
      etapa_id = COALESCE($9, etapa_id),
      status = COALESCE($10, status)
    WHERE id = $11`,
    [
      body.nome ?? null,
      body.valor ?? null,
      "contatoId" in body,
      body.contatoId ?? null,
      "responsavel" in body,
      body.responsavel ?? null,
      "prazo" in body,
      body.prazo ?? null,
      body.etapaId ?? null,
      body.status ?? null,
      id,
    ]
  );

  const { rows } = await pool.query(`${NEGOCIO_JOIN} WHERE n.id=$1`, [id]);
  res.json(rowToNegocio(rows[0]));
});

// DELETE /pipeline/negocios/:id
router.delete("/negocios/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const { rows } = await pool.query("SELECT id FROM negocios WHERE id=$1", [id]);
  if (rows.length === 0) { res.status(404).json({ error: "Negócio não encontrado" }); return; }

  await pool.query("DELETE FROM negocios WHERE id=$1", [id]);
  res.status(204).send();
});

// GET /pipeline/negocios/:id/historico
router.get("/negocios/:id/historico", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const { rows } = await pool.query(
    "SELECT * FROM historico_pipeline WHERE negocio_id=$1 ORDER BY criado_em DESC",
    [id]
  );
  res.json(rows.map(rowToHistorico));
});

export default router;
