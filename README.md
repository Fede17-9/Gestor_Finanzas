# Flux · Gestor de finanzas

Aplicación personal para registrar ingresos y gastos, planificar recurrencias, consultar un calendario, controlar presupuestos mensuales y reservar dinero para metas de ahorro.

Cada cuenta mantiene sus datos privados. La interfaz está en español y usa una presentación clara, sobria y adaptable a móvil.

**Beta publicada:** [gestor-finanzas-green.vercel.app](https://gestor-finanzas-green.vercel.app/login). Para evaluar el proyecto, utiliza información ficticia en tu propia cuenta.

## Estado

Las fases de integridad, autenticación y seguridad, recurrencias, presupuestos/metas y diseño están implementadas. El propietario probó los flujos principales contra su Supabase, incluidos confirmación de correo, recuperación de contraseña, aislamiento entre cuentas y procesamiento programado.

La beta está desplegada en Vercel Hobby y utiliza Supabase para autenticación y base de datos. El propietario verificó la recuperación de contraseña y el acceso en el dominio publicado. Los textos de privacidad, la autorización de tratamiento, la atención de solicitudes de usuarios y la preparación del correo para nuevos destinatarios siguen pendientes antes de ampliar la beta a evaluadores.

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

`vercel.json` limita los despliegues automáticos a `main`. Las ramas de trabajo se validan en GitHub Actions; las variables del Supabase personal se configuran solo en Production. Cuando exista una base de pruebas separada, se podrá habilitar su despliegue de preview explícitamente.

La publicación del código no publica la base de datos. Las migraciones se aplican por separado y con respaldo; fusionar una rama no modifica Supabase.

## Recursos y licencia

Los avisos de los recursos utilizados están en [Créditos](app/creditos/page.tsx) y [textos de licencia](public/third-party-notices.txt). La licencia del código propio todavía no se ha elegido; no se presenta el repositorio como código abierto reutilizable.

## Protección de formularios con Turnstile

El registro, el acceso, la recuperación y el reenvío de confirmación admiten Cloudflare Turnstile. Sin la variable pública mantienen su funcionamiento anterior. Los tokens se envían a Supabase Auth, nunca se guardan en el navegador y se renuevan después de cada intento. El recuadro por sí solo no protege el servicio: Supabase debe validar los tokens.

Orden de activación:

1. Crea un widget Managed con los hostnames de producción y localhost, sin protocolo, puerto ni ruta. Deja pre-clearance desactivado.
2. Configura la **Site Key pública** en Vercel Production como `NEXT_PUBLIC_TURNSTILE_SITE_KEY` y también en el `.env.local` privado. No la añadas al repositorio.
3. Despliega el código y comprueba que el recuadro carga y permite completar la verificación. Reinicia el servidor local si estaba abierto.
4. Solo entonces activa CAPTCHA en Supabase Authentication / Attack Protection, elige Turnstile y guarda la **Secret Key** exclusivamente allí. El cambio afecta a todos los clientes del proyecto, incluido localhost.
5. Prueba registro, reenvío, inicio de sesión incorrecto seguido de correcto y recuperación en el dominio publicado y desde un teléfono. Confirma en Supabase que una solicitud sin token queda rechazada.

Si el widget falla, revisa los hostnames, la clave pública y los bloqueadores. Para recuperar temporalmente el acceso durante una configuración fallida, desactiva CAPTCHA en Supabase; no desactives la confirmación de correo ni RLS. Las pruebas locales de código comprueban el envío de tokens y los errores; no prueban la configuración real de Cloudflare/Supabase.
