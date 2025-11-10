import pkg from 'pg';
const { Pool } = pkg;

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function ensureSchema() {
  await pool.query(`
    create table if not exists companies (
      id bigserial primary key,
      name text,
      domain text unique,
      website text,
      category text,
      address text,
      city text, state text, country text default 'US',
      created_at timestamptz default now()
    );
  `);
  await pool.query(`
    create table if not exists emails (
      id bigserial primary key,
      company_id bigint references companies(id) on delete cascade,
      email text not null,
      source_url text not null,
      first_seen timestamptz default now(),
      last_seen  timestamptz default now(),
      status text default 'unknown',
      verified_at timestamptz,
      unique (company_id, email)
    );
  `);
  await pool.query(`
    create table if not exists campaign_targets (
      id bigserial primary key,
      email_id bigint references emails(id) on delete cascade,
      campaign smallint not null check (campaign in (1,2,3)),
      stage text default 'new',
      last_action_at timestamptz,
      unique (email_id, campaign)
    );
  `);
  await pool.query(`
    create table if not exists events (
      id bigserial primary key,
      email_id bigint references emails(id) on delete cascade,
      event text,
      meta jsonb,
      created_at timestamptz default now()
    );
  `);
  await pool.query(`create index if not exists idx_companies_domain on companies(domain);`);
  await pool.query(`create index if not exists idx_emails_status on emails(status);`);
  await pool.query(`create index if not exists idx_campaign_stage on campaign_targets(campaign, stage);`);
}

export async function upsertCompanyAndEmail({ domain, source_url, email, name=null, category=null }) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const c = await client.query(`
      insert into companies(domain, website, name, category)
      values ($1, $2, $3, $4)
      on conflict (domain) do update set website=excluded.website
      returning id
    `, [domain, `https://${domain}`, name, category]);
    const companyId = c.rows[0].id;
    await client.query(`
      insert into emails(company_id, email, source_url)
      values ($1, $2, $3)
      on conflict (company_id, email) do update set last_seen=now()
    `, [companyId, email, source_url]);
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}

export const listLeads = async ({ domain } = {}) => {
  const q = domain ? `where c.domain=$1` : ``;
  const params = domain ? [domain] : [];
  const { rows } = await pool.query(
    `select c.domain, c.name, e.email, e.source_url, e.status, e.first_seen, e.last_seen
     from emails e join companies c on c.id = e.company_id
     ${q}
     order by c.domain, e.email`,
    params
  );
  return rows;
};
