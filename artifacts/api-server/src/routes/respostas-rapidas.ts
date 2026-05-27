import { Router, type IRouter } from "express";
import { z } from "zod";
import { pool, rowToRespostaRapida } from "../lib/db";

const router: IRouter = Router();

router.get("/respostas-rapidas", async (_req, res): Promise<void> => {
  const { rows } = await pool.query("SELECT * FROM respostas_rapidas ORDER BY id ASC");
  res.json(rows.map((r: Record<string, unknown>) => rowToRespostaRapida(r)));
});

router.post("/respostas-rapidas", async (req, res): Promise<void> => {
  const Body = z.object({
    titulo: z.string().min(1),
    texto: z.string().min(1),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { rows } = await pool.query(
    "INSERT INTO respostas_rapidas (titulo, texto) VALUES ($1,$2) RETURNING *",
    [parsed.data.titulo, parsed.data.texto]
  );
  res.status(201).json(rowToRespostaRapida(rows[0] as Record<string, unknown>));
});

router.delete("/respostas-rapidas/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const { rows } = await pool.query("SELECT id FROM respostas_rapidas WHERE id = $1", [id]);
  if (rows.length === 0) { res.status(404).json({ error: "Resposta rápida não encontrada" }); return; }

  await pool.query("DELETE FROM respostas_rapidas WHERE id = $1", [id]);
  res.sendStatus(204);
});

export default router;
