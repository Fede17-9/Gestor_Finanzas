# Flux · Gestor de finanzas

Aplicación personal para registrar ingresos y gastos, planificar recurrencias, consultar un calendario, controlar presupuestos mensuales y reservar dinero para metas de ahorro.

Cada cuenta mantiene sus datos privados. La interfaz está en español y usa una presentación clara, sobria y adaptable a móvil.

## Estado

Las fases de integridad, autenticación y seguridad, recurrencias, presupuestos/metas y diseño están implementadas. El propietario probó los flujos principales contra su Supabase, incluidos confirmación de correo, recuperación de contraseña, aislamiento entre cuentas y procesamiento programado.

El proyecto está preparando su beta de portafolio. El destino acordado es Vercel Hobby para la web y Supabase para autenticación y base de datos. La configuración pública, los textos de privacidad, la autorización de tratamiento y la atención de solicitudes de usuarios siguen pendientes antes de abrir el registro a evaluadores.

- Los saldos cuentan movimientos confirmados. Los pendientes y previsiones no registran pagos.
- Cada regla recurrente admite confirmación manual o automática. Supabase Cron procesa las automáticas cuando la web está cerrada.
- Los presupuestos cuentan egresos confirmados del mes; los límites de categoría no se suman al general.
- Los aportes a metas reservan dinero y conservan historial: no crean gastos ni modifican el saldo general.
- La moneda base se elige al crear el perfil y queda fija.

## Tecnología

Next.js 16.4.2, React 19, TypeScript, Tailwind CSS 4, Supabase, Recharts y Lucide. Node.js 24.x, indicado en `.nvmrc` y `package.json`.

## Ejecutar en local

Desde esta carpeta, donde está `package.json`:

```powershell
npm ci
if (-not (Test-Path -LiteralPath .env.local)) {
  Copy-Item -LiteralPath .env.example -Destination .env.local
}
npm run dev
```

Antes de arrancar por primera vez, configura en `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

La variable heredada `NEXT_PUBLIC_SUPABASE_ANON_KEY` sigue siendo compatible. Las claves publicables son para el navegador y requieren RLS; nunca uses claves secretas ni `service_role` en estas variables.

Abre [localhost:3000](http://localhost:3000). La aplicación usa la base configurada: guardar o eliminar desde los formularios modifica sus datos. Las pruebas automatizadas usan datos ficticios y una base local en memoria, sin acceder a Supabase remoto.

## Comprobaciones

```powershell
npm run db:types:check
npm test
npm run typecheck
npm run lint
npm audit --omit=dev --audit-level=high
npm run build
```

GitHub Actions ejecuta estas comprobaciones en cada push y pull request. El build necesita descargar las fuentes Geist. Las pruebas automatizadas no sustituyen las comprobaciones de correo y navegador contra el servicio real.

El esquema reproducible, las migraciones y el procesamiento programado están en [supabase](supabase/README.md). Nunca ejecutes la baseline sobre una base existente ni subas respaldos o información personal al repositorio.

## Despliegue previsto en Vercel

Importa este repositorio como proyecto Next.js. **Root Directory: `./`**, porque `package.json` está en la raíz del repositorio; rama de producción: `main`. Configura las variables de Supabase en Vercel y vuelve a desplegar si cambian.

En Supabase, configura Site URL y las redirecciones de confirmación/recuperación para el dominio definitivo, conservando localhost para desarrollo. Revisa el servicio de correo, las cuotas y la protección contra abuso antes de abrir el registro. Las previews que necesiten probar datos deben utilizar un entorno de prueba, separado de la información personal.

La publicación del código no publica la base de datos. Las migraciones se aplican por separado y con respaldo; fusionar una rama no modifica Supabase.

## Recursos y licencia

Los avisos de los recursos utilizados están en [Créditos](app/creditos/page.tsx) y [textos de licencia](public/third-party-notices.txt). La licencia del código propio todavía no se ha elegido; no se presenta el repositorio como código abierto reutilizable.
