import { Router, type IRouter } from "express";
import { pool, rowToContact } from "../lib/db";
import {
  ListContactsQueryParams,
  CreateContactBody,
  UpdateContactBody,
  GetContactParams,
  UpdateContactParams,
  DeleteContactParams,
  ImportContactsBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/contacts", async (req, res): Promise<void> => {
  const parsed = ListContactsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { search, tag, canal } = parsed.data;

  const conditions: string[] = ["1=1"];
  const args: unknown[] = [];
  let paramIdx = 1;

  if (search) {
    conditions.push(`(nome ILIKE $${paramIdx} OR telefone ILIKE $${paramIdx + 1} OR email ILIKE $${paramIdx + 2})`);
    const like = `%${search}%`;
    args.push(like, like, like);
    paramIdx += 3;
  }

  if (canal) {
    conditions.push(`canal = $${paramIdx}`);
    args.push(canal);
    paramIdx++;
  }

  if (tag) {
    conditions.push(`tags @> $${paramIdx}::jsonb`);
    args.push(JSON.stringify([tag]));
    paramIdx++;
  }

  const sql = `SELECT * FROM contatos WHERE ${conditions.join(" AND ")} ORDER BY atualizado_em DESC`;
  const { rows } = await pool.query(sql, args);
  res.json(rows.map((r: Record<string, unknown>) => rowToContact(r)));
});

router.get("/contacts/stats", async (_req, res): Promise<void> => {
  const totalResult = await pool.query("SELECT COUNT(*) AS c FROM contatos");
  const total = parseInt(totalResult.rows[0].c);

  const canalResult = await pool.query(
    "SELECT canal, COUNT(*) AS total FROM contatos GROUP BY canal"
  );

  const porCanal = canalResult.rows.map((r: Record<string, unknown>) => ({
    canal: r.canal as string,
    total: parseInt(String(r.total)),
  }));

  res.json({ total, porCanal });
});

router.get("/contacts/tags", async (_req, res): Promise<void> => {
  const { rows } = await pool.query("SELECT tags FROM contatos");
  const tagSet = new Set<string>();
  for (const row of rows) {
    const tags = (row.tags as string[]) ?? [];
    tags.forEach((t: string) => tagSet.add(t));
  }
  res.json(Array.from(tagSet).sort());
});

router.post("/contacts/import", async (req, res): Promise<void> => {
  const parsed = ImportContactsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { registros } = parsed.data;
  let importados = 0;
  const erros: string[] = [];

  for (const registro of registros) {
    try {
      await pool.query(
        "INSERT INTO contatos (nome, telefone, email, canal, tags, notas) VALUES ($1,$2,$3,$4,$5,$6)",
        [registro.nome, registro.telefone, registro.email ?? null, registro.canal,
          JSON.stringify(registro.tags ?? []), registro.notas ?? null]
      );
      importados++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      erros.push(`${registro.nome} (${registro.telefone}): ${msg}`);
    }
  }

  res.json({ importados, erros });
});

router.get("/contacts/:id", async (req, res): Promise<void> => {
  const params = GetContactParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { rows } = await pool.query("SELECT * FROM contatos WHERE id = $1", [params.data.id]);
  if (rows.length === 0) {
    res.status(404).json({ error: "Contato não encontrado" });
    return;
  }

  res.json(rowToContact(rows[0] as Record<string, unknown>));
});

router.put("/contacts/:id", async (req, res): Promise<void> => {
  const params = UpdateContactParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateContactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await pool.query("SELECT * FROM contatos WHERE id = $1", [params.data.id]);
  if (existing.rows.length === 0) {
    res.status(404).json({ error: "Contato não encontrado" });
    return;
  }

  const data = parsed.data;
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (data.nome !== undefined) { setClauses.push(`nome = $${paramIdx++}`); values.push(data.nome); }
  if (data.telefone !== undefined) { setClauses.push(`telefone = $${paramIdx++}`); values.push(data.telefone); }
  if ("email" in data) { setClauses.push(`email = $${paramIdx++}`); values.push(data.email ?? null); }
  if (data.canal !== undefined) { setClauses.push(`canal = $${paramIdx++}`); values.push(data.canal); }
  if (data.tags !== undefined) { setClauses.push(`tags = $${paramIdx++}`); values.push(JSON.stringify(data.tags)); }
  if ("notas" in data) { setClauses.push(`notas = $${paramIdx++}`); values.push(data.notas ?? null); }

  if (setClauses.length === 0) {
    res.json(rowToContact(existing.rows[0] as Record<string, unknown>));
    return;
  }

  setClauses.push(`atualizado_em = NOW()`);
  values.push(params.data.id);

  try {
    const { rows } = await pool.query(
      `UPDATE contatos SET ${setClauses.join(", ")} WHERE id = $${paramIdx} RETURNING *`,
      values
    );
    res.json(rowToContact(rows[0] as Record<string, unknown>));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique") || msg.includes("UNIQUE")) {
      res.status(409).json({ error: "Telefone ou e-mail já cadastrado" });
      return;
    }
    throw err;
  }
});

router.delete("/contacts/:id", async (req, res): Promise<void> => {
  const params = DeleteContactParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { rows } = await pool.query("SELECT id FROM contatos WHERE id = $1", [params.data.id]);
  if (rows.length === 0) {
    res.status(404).json({ error: "Contato não encontrado" });
    return;
  }

  await pool.query("DELETE FROM contatos WHERE id = $1", [params.data.id]);
  res.sendStatus(204);
});

router.post("/contacts", async (req, res): Promise<void> => {
  const parsed = CreateContactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { nome, telefone, email, canal, tags, notas } = parsed.data;

  try {
    const { rows } = await pool.query(
      `INSERT INTO contatos (nome, telefone, email, canal, tags, notas)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [nome, telefone, email ?? null, canal, JSON.stringify(tags ?? []), notas ?? null]
    );
    res.status(201).json(rowToContact(rows[0] as Record<string, unknown>));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique") || msg.includes("UNIQUE")) {
      res.status(409).json({ error: "Telefone ou e-mail já cadastrado" });
      return;
    }
    throw err;
  }
});

export default router;
