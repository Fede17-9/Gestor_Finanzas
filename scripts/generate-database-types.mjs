import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir, writeFile } from 'node:fs/promises';

// Reconstruct the versioned application schema without credentials or user data.
// Auth is an external dependency: only its referenced ID and uid() are needed.
export async function generateDatabaseTypes() {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    `);
    const directory = new URL('../supabase/migrations/', import.meta.url);
    const migrations = (await readdir(directory)).filter(name => name.endsWith('.sql')).sort();
    if (!migrations.length) throw new Error('No se encontraron migraciones.');
    for (const migration of migrations) await db.exec(await readFile(new URL(migration, directory), 'utf8'));

    const tables = (await db.query(`select c.oid,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r' order by c.relname`)).rows;
    const unsupported = (await db.query(`select 'view' kind,c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('v','m')
      union all select 'function',p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.prokind='f' and p.prorettype <> 'trigger'::regtype`)).rows;
    if (unsupported.length) throw new Error('Ampliar el generador para estas vistas/RPC antes de continuar: ' + JSON.stringify(unsupported));

    const lines = [
      '// Generated from supabase/migrations by npm run db:types. Do not edit manually.',
      '// This checks the versioned schema, not unversioned changes in Supabase Cloud.',
      'export type DecimalString = `${number}`;',
      'export type Database = {', '  public: {', '    Tables: {',
    ];
    for (const table of tables) {
      const columns = (await db.query(`select a.attname,t.typname,a.attnotnull,a.atthasdef,a.attidentity,a.attgenerated
        from pg_attribute a join pg_type t on t.oid=a.atttypid
        where a.attrelid=$1 and a.attnum>0 and not a.attisdropped order by a.attnum`, [table.oid])).rows;
      const relationships = (await db.query(`select c.conname,foreign_table.relname referenced_relation,
          array(select a.attname from unnest(c.conkey) with ordinality k(num,ord)
            join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.num order by k.ord) columns,
          array(select a.attname from unnest(c.confkey) with ordinality k(num,ord)
            join pg_attribute a on a.attrelid=c.confrelid and a.attnum=k.num order by k.ord) referenced_columns,
          exists(select 1 from pg_constraint u where u.conrelid=c.conrelid and u.contype in ('p','u') and u.conkey=c.conkey) one_to_one
        from pg_constraint c join pg_class foreign_table on foreign_table.oid=c.confrelid
        join pg_namespace n on n.oid=foreign_table.relnamespace
        where c.conrelid=$1 and c.contype='f' and n.nspname='public' order by c.conname`, [table.oid])).rows;
      lines.push(`      ${JSON.stringify(table.relname)}: {`);
      for (const operation of ['Row','Insert','Update']) {
        lines.push(`        ${operation}: {`);
        for (const column of columns) {
          const generated = column.attgenerated !== '' || column.attidentity === 'a';
          const optional = operation !== 'Row' && (operation === 'Update' || !column.attnotnull || column.atthasdef || column.attidentity !== '' || generated);
          let type = columnType(column.typname);
          // PostgREST accepts decimal strings for numeric input, preserving cents.
          if (operation !== 'Row' && column.typname === 'numeric') type = 'number | DecimalString';
          if (!column.attnotnull) type += ' | null';
          if (operation !== 'Row' && generated) type = 'never';
          lines.push(`          ${JSON.stringify(column.attname)}${optional ? '?' : ''}: ${type};`);
        }
        lines.push('        };');
      }
      lines.push('        Relationships: [');
      for (const relation of relationships) {
        lines.push('          {',
          `            foreignKeyName: ${JSON.stringify(relation.conname)};`,
          `            columns: ${JSON.stringify(relation.columns)};`,
          `            isOneToOne: ${relation.one_to_one};`,
          `            referencedRelation: ${JSON.stringify(relation.referenced_relation)};`,
          `            referencedColumns: ${JSON.stringify(relation.referenced_columns)};`, '          },');
      }
      lines.push('        ];', '      };');
    }
    lines.push('    };', '    Views: { [_ in never]: never };', '    Functions: { [_ in never]: never };',
      '    Enums: { [_ in never]: never };', '    CompositeTypes: { [_ in never]: never };', '  };', '};', '',
      'export type TableName = keyof Database["public"]["Tables"];',
      'export type Row<T extends TableName> = Database["public"]["Tables"][T]["Row"];',
      'export type Insert<T extends TableName> = Database["public"]["Tables"][T]["Insert"];',
      'export type Update<T extends TableName> = Database["public"]["Tables"][T]["Update"];', '');
    return lines.join('\n');
  } finally { await db.close(); }
}

function columnType(type) {
  if (['uuid','text','varchar','bpchar','date','timestamp','timestamptz','time','timetz'].includes(type)) return 'string';
  if (['int2','int4','int8','numeric','float4','float8'].includes(type)) return 'number';
  if (type === 'bool') return 'boolean';
  throw new Error('Tipo PostgreSQL no soportado: ' + type);
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/scripts/generate-database-types.mjs')) {
  const generated = await generateDatabaseTypes();
  const destination = new URL('../lib/database.types.ts', import.meta.url);
  if (process.argv.includes('--check')) {
    const current = await readFile(destination, 'utf8').catch(() => '');
    if (current.replaceAll('\r\n', '\n') !== generated) {
      throw new Error('Los tipos no coinciden con las migraciones. Ejecuta npm run db:types y guarda el resultado.');
    }
    console.log('Tipos de base de datos sincronizados con las migraciones.');
  } else {
    await writeFile(destination, generated, 'utf8');
    console.log('Tipos generados en lib/database.types.ts.');
  }
}
