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
  `);

  await pool.query(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversas' AND column_name = 'conteudo'
      ) THEN
        ALTER TABLE conversas RENAME TO interacoes;
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS interacoes (
      id SERIAL PRIMARY KEY,
      contato_id INTEGER NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
      conteudo TEXT NOT NULL,
      canal TEXT NOT NULL CHECK (canal IN ('whatsapp', 'email', 'instagram', 'telefone')),
      direcao TEXT NOT NULL CHECK (direcao IN ('entrada', 'saida')),
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS conversas (
      id SERIAL PRIMARY KEY,
      contato_id INTEGER NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
      canal TEXT NOT NULL CHECK (canal IN ('whatsapp', 'email', 'instagram', 'telefone')),
      status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'em_andamento', 'resolvida')),
      atendente TEXT,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      encerrado_em TIMESTAMPTZ,
      classificacao TEXT CHECK (classificacao IN ('Ótimo', 'Bom', 'Regular', 'Ruim'))
    );

    CREATE TABLE IF NOT EXISTS mensagens (
      id SERIAL PRIMARY KEY,
      conversa_id INTEGER NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
      texto TEXT NOT NULL,
      autor TEXT NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS respostas_rapidas (
      id SERIAL PRIMARY KEY,
      titulo TEXT NOT NULL,
      texto TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_contatos_telefone ON contatos(telefone);
    CREATE INDEX IF NOT EXISTS idx_contatos_email ON contatos(email);
    CREATE INDEX IF NOT EXISTS idx_interacoes_contato ON interacoes(contato_id);
    CREATE INDEX IF NOT EXISTS idx_conversas_contato ON conversas(contato_id);
    CREATE INDEX IF NOT EXISTS idx_conversas_status ON conversas(status);
    CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON mensagens(conversa_id);
  `);

  await seedInitialData();
}

async function seedInitialData() {
  const { rows: contatoCount } = await pool.query("SELECT COUNT(*) AS c FROM contatos");
  const needsContatos = parseInt(contatoCount[0].c) === 0;

  const { rows: conversaCount } = await pool.query("SELECT COUNT(*) AS c FROM conversas");
  const needsInbox = parseInt(conversaCount[0].c) === 0;

  const { rows: rrCount } = await pool.query("SELECT COUNT(*) AS c FROM respostas_rapidas");
  const needsRR = parseInt(rrCount[0].c) === 0;

  if (!needsContatos && !needsInbox && !needsRR) return;

  let c1id: number, c2id: number, c3id: number;

  if (needsContatos) {
    const c1 = await pool.query(
      `INSERT INTO contatos (nome, telefone, email, canal, tags, notas)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ["Carlos Mendes", "(11) 99123-4567", "carlos.mendes@email.com", "whatsapp",
        JSON.stringify(["cliente", "impermeabilização"]),
        "Cliente desde 2023. Interesse em tratamento de laje."]
    );
    const c2 = await pool.query(
      `INSERT INTO contatos (nome, telefone, email, canal, tags, notas)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ["Ana Paula Souza", "(21) 98765-4321", "anapaula@empresa.com.br", "email",
        JSON.stringify(["lead", "orçamento"]),
        "Solicitou orçamento para 3 apartamentos."]
    );
    const c3 = await pool.query(
      `INSERT INTO contatos (nome, telefone, email, canal, tags, notas)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ["Roberto Lima", "(31) 97654-3210", null, "instagram",
        JSON.stringify(["lead"]),
        "Veio pelo Instagram. Interessado em impermeabilização de piscina."]
    );
    c1id = c1.rows[0].id as number;
    c2id = c2.rows[0].id as number;
    c3id = c3.rows[0].id as number;

    await pool.query(
      "INSERT INTO interacoes (contato_id, conteudo, canal, direcao) VALUES ($1,$2,$3,$4)",
      [c1id, "Olá! Gostaria de saber mais sobre impermeabilização de laje.", "whatsapp", "entrada"]
    );
    await pool.query(
      "INSERT INTO interacoes (contato_id, conteudo, canal, direcao) VALUES ($1,$2,$3,$4)",
      [c1id, "Claro! Podemos agendar uma visita técnica. Qual o melhor horário?", "whatsapp", "saida"]
    );
  } else {
    const { rows: existingContatos } = await pool.query(
      "SELECT id FROM contatos ORDER BY id ASC LIMIT 3"
    );
    c1id = (existingContatos[0] as Record<string, unknown>).id as number;
    c2id = (existingContatos[1] as Record<string, unknown>).id as number;
    c3id = (existingContatos[2] as Record<string, unknown>).id as number;
  }

  if (needsInbox) {
    const conv1 = await pool.query(
      `INSERT INTO conversas (contato_id, canal, status, atendente)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [c1id, "whatsapp", "aberta", "João Silva"]
    );
    const conv2 = await pool.query(
      `INSERT INTO conversas (contato_id, canal, status, atendente)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [c2id, "email", "em_andamento", "Maria Costa"]
    );
    const conv3 = await pool.query(
      `INSERT INTO conversas (contato_id, canal, status, atendente)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [c3id, "instagram", "aberta", "João Silva"]
    );

    const v1 = conv1.rows[0].id as number;
    const v2 = conv2.rows[0].id as number;
    const v3 = conv3.rows[0].id as number;

    await pool.query("INSERT INTO mensagens (conversa_id, texto, autor) VALUES ($1,$2,$3)",
      [v1, "Olá! Gostaria de um orçamento para impermeabilização de laje de 120m².", "Carlos Mendes"]);
    await pool.query("INSERT INTO mensagens (conversa_id, texto, autor) VALUES ($1,$2,$3)",
      [v1, "Bom dia, Carlos! Claro, podemos ajudar. Qual é o endereço do imóvel?", "Atendente"]);
    await pool.query("INSERT INTO mensagens (conversa_id, texto, autor) VALUES ($1,$2,$3)",
      [v1, "Rua das Flores, 321 — São Paulo, SP.", "Carlos Mendes"]);

    await pool.query("INSERT INTO mensagens (conversa_id, texto, autor) VALUES ($1,$2,$3)",
      [v2, "Boa tarde! Recebi o orçamento por e-mail. Gostaria de discutir os prazos.", "Ana Paula Souza"]);
    await pool.query("INSERT INTO mensagens (conversa_id, texto, autor) VALUES ($1,$2,$3)",
      [v2, "Boa tarde, Ana! Estou verificando a agenda da equipe técnica.", "Atendente"]);
    await pool.query("INSERT INTO mensagens (conversa_id, texto, autor) VALUES ($1,$2,$3)",
      [v2, "Podemos iniciar em até 15 dias úteis após a aprovação do contrato.", "Atendente"]);

    await pool.query("INSERT INTO mensagens (conversa_id, texto, autor) VALUES ($1,$2,$3)",
      [v3, "Oi! Vi o trabalho de vocês no Instagram. Quanto custa impermeabilizar uma piscina?", "Roberto Lima"]);
    await pool.query("INSERT INTO mensagens (conversa_id, texto, autor) VALUES ($1,$2,$3)",
      [v3, "Olá, Roberto! Depende do tamanho e do tipo de impermeabilização. Pode nos passar as medidas?", "Atendente"]);
  }

  if (needsRR) {
    await pool.query("INSERT INTO respostas_rapidas (titulo, texto) VALUES ($1,$2)",
      ["Saudação inicial", "Olá! Seja bem-vindo à Dryko. Como posso ajudar você hoje?"]);
    await pool.query("INSERT INTO respostas_rapidas (titulo, texto) VALUES ($1,$2)",
      ["Solicitar endereço", "Para continuarmos, poderia nos informar o endereço do imóvel e o tamanho da área a ser impermeabilizada?"]);
    await pool.query("INSERT INTO respostas_rapidas (titulo, texto) VALUES ($1,$2)",
      ["Agendamento de visita", "Podemos agendar uma visita técnica gratuita. Qual o melhor dia e horário para você?"]);
    await pool.query("INSERT INTO respostas_rapidas (titulo, texto) VALUES ($1,$2)",
      ["Encerramento", "Obrigado pelo contato! Estamos à disposição caso precise de mais informações. Até logo!"]);
  }
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

export function rowToInteracao(row: Record<string, unknown>) {
  return {
    id: row.id as number,
    contatoId: row.contato_id as number,
    conteudo: row.conteudo as string,
    canal: row.canal as string,
    direcao: row.direcao as string,
    criadoEm: (row.criado_em as Date).toISOString(),
  };
}

export function rowToInboxConversation(row: Record<string, unknown>) {
  return {
    id: row.id as number,
    contatoId: row.contato_id as number,
    contatoNome: row.contato_nome as string,
    contatoTelefone: (row.contato_telefone as string) ?? "",
    canal: row.canal as string,
    status: row.status as string,
    atendente: (row.atendente as string | null) ?? null,
    criadoEm: (row.criado_em as Date).toISOString(),
    encerradoEm: row.encerrado_em ? (row.encerrado_em as Date).toISOString() : null,
    classificacao: (row.classificacao as string | null) ?? null,
    ultimaMensagem: (row.ultima_mensagem as string | null) ?? null,
    totalMensagens: parseInt(String(row.total_mensagens ?? "0")),
  };
}

export function rowToMensagem(row: Record<string, unknown>) {
  return {
    id: row.id as number,
    conversaId: row.conversa_id as number,
    texto: row.texto as string,
    autor: row.autor as string,
    criadoEm: (row.criado_em as Date).toISOString(),
  };
}

export function rowToRespostaRapida(row: Record<string, unknown>) {
  return {
    id: row.id as number,
    titulo: row.titulo as string,
    texto: row.texto as string,
  };
}
