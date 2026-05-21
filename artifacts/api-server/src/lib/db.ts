import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contatos (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      telefone TEXT NOT NULL UNIQUE,
      email TEXT UNIQUE,
      canal TEXT NOT NULL CHECK (canal IN ('whatsapp', 'email', 'instagram', 'telefone')),
      tags JSONB NOT NULL DEFAULT '[]',
      notas TEXT,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS conversas (
      id SERIAL PRIMARY KEY,
      contato_id INTEGER NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
      conteudo TEXT NOT NULL,
      canal TEXT NOT NULL CHECK (canal IN ('whatsapp', 'email', 'instagram', 'telefone')),
      direcao TEXT NOT NULL CHECK (direcao IN ('entrada', 'saida')),
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_contatos_telefone ON contatos(telefone);
    CREATE INDEX IF NOT EXISTS idx_contatos_email ON contatos(email);
    CREATE INDEX IF NOT EXISTS idx_conversas_contato ON conversas(contato_id);
  `);

  await seedInitialData();
}

async function seedInitialData() {
  const { rows } = await pool.query("SELECT COUNT(*) AS c FROM contatos");
  if (parseInt(rows[0].c) > 0) return;

  const c1 = await pool.query(
    `INSERT INTO contatos (nome, telefone, email, canal, tags, notas)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    ["Carlos Mendes", "(11) 99123-4567", "carlos.mendes@email.com", "whatsapp",
      JSON.stringify(["cliente", "impermeabilização"]),
      "Cliente desde 2023. Interesse em tratamento de laje."]
  );
  await pool.query(
    `INSERT INTO contatos (nome, telefone, email, canal, tags, notas)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    ["Ana Paula Souza", "(21) 98765-4321", "anapaula@empresa.com.br", "email",
      JSON.stringify(["lead", "orçamento"]),
      "Solicitou orçamento para 3 apartamentos."]
  );
  await pool.query(
    `INSERT INTO contatos (nome, telefone, email, canal, tags, notas)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    ["Roberto Lima", "(31) 97654-3210", null, "instagram",
      JSON.stringify(["lead"]),
      "Veio pelo Instagram. Interessado em impermeabilização de piscina."]
  );

  const c1id = c1.rows[0].id as number;
  await pool.query(
    "INSERT INTO conversas (contato_id, conteudo, canal, direcao) VALUES ($1,$2,$3,$4)",
    [c1id, "Olá! Gostaria de saber mais sobre impermeabilização de laje.", "whatsapp", "entrada"]
  );
  await pool.query(
    "INSERT INTO conversas (contato_id, conteudo, canal, direcao) VALUES ($1,$2,$3,$4)",
    [c1id, "Claro! Podemos agendar uma visita técnica. Qual o melhor horário?", "whatsapp", "saida"]
  );
}

export function rowToContact(row: Record<string, unknown>) {
  return {
    id: row.id as number,
    nome: row.nome as string,
    telefone: row.telefone as string,
    email: (row.email as string | null) ?? null,
    canal: row.canal as string,
    tags: (row.tags as string[]) ?? [],
    notas: (row.notas as string | null) ?? null,
    criadoEm: (row.criado_em as Date).toISOString(),
    atualizadoEm: (row.atualizado_em as Date).toISOString(),
  };
}

export function rowToConversation(row: Record<string, unknown>) {
  return {
    id: row.id as number,
    contatoId: row.contato_id as number,
    conteudo: row.conteudo as string,
    canal: row.canal as string,
    direcao: row.direcao as string,
    criadoEm: (row.criado_em as Date).toISOString(),
  };
}
