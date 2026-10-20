# Instalación y plan de publicación

Revisado el **20 de octubre de 2026**. No se ha realizado un despliegue ni comprobado una URL de producción. Revisar precios/cuotas oficiales antes de contratar.

## Qué se despliega

Next.js sirve la web; Supabase aloja Auth y Postgres. No hay un backend propio separado en el repositorio. Muchas operaciones van del navegador directamente a Supabase: las políticas RLS son la frontera real de acceso a datos.

`npm run dev` inicia desarrollo; `npm run build` prepara producción; `npm run start` sirve un build válido con Node. Publicar la web no crea tablas, permisos ni tareas programadas de base de datos.

## Ejecutar hoy en local

1. Entrar donde está `package.json`: carpeta local `gestor-finanzas`, raíz `./` del repositorio Git.
2. Usar Node 24.x (`.nvmrc` y `engines`) e instalar con `npm ci` para respetar el lockfile. La entrega se comprobó con Node 24.19.0.
3. Si no existe `.env.local`, copiar `.env.example` y completar valores. No sobrescribir configuración existente.
4. Usar Supabase de pruebas con tablas, datos iniciales y políticas correctas. No ejecutar las sugerencias históricas de permisos sin revisarlas.
5. Ejecutar `npm run dev` y abrir `/login` o `/registro` en `http://localhost:3000`.

Variables consumidas por el código:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

El código ya admite la clave **publishable** y conserva `NEXT_PUBLIC_SUPABASE_ANON_KEY` como alternativa para instalaciones existentes. Si ambas están presentes tiene prioridad publishable. Nunca poner `secret` o `service_role` en variables públicas. [Claves oficiales](https://supabase.com/docs/guides/getting-started/api-keys).

`NEXT_PUBLIC_*` llega al navegador y se incorpora al build: no es un secreto. Cambiar estos valores requiere recompilar para actualizar la web publicada. La protección de datos depende de Auth/RLS. [Variables Next.js](https://nextjs.org/docs/app/guides/environment-variables).

Las dos entregas locales pasan 48 pruebas, tipos, lint y build. El borrado y la generación automática desde el dashboard se retiraron. Las migraciones y nuevos flujos Auth están versionados, pendientes de validar contra el servicio real. Antes de producción seguir [procedimiento de base de datos](../supabase/README.md), [configuración de Auth](ETAPA_2.md) y [validación](VALIDACION.md).

## Alojamiento de bajo costo

Propuesta: **Vercel Hobby + Supabase Free**, subdominio del proveedor y pocos servicios externos. Evitar por ahora dominio web propio, IA, OCR y SMS.

- Hobby está orientado a uso personal no comercial y tiene límites; una futura apertura comercial requiere revisar plan. [Condiciones Vercel](https://vercel.com/docs/plans/hobby).
- Supabase Free ofrece 500 MB de base de datos, máximo dos proyectos activos y pausa tras una semana de inactividad. La aplicación de evaluación puede estar pausada al llegar un visitante. [Cuotas/precios](https://supabase.com/pricing).
- Supabase Pro parte de USD 25/mes; proyectos adicionales, recursos y uso pueden subir el costo. No es obligatorio para empezar ni un precio total garantizado. [Precios](https://supabase.com/pricing).
- Para registro por email, el SMTP incluido tiene destinatarios restringidos y no está pensado para producción. Configurar SMTP propio, cupo y entregabilidad antes de invitar evaluadores. Un proveedor con cuota gratuita podría servir, pero no se ha elegido uno ni verificado una oferta; el dominio remitente podría tener costo. [SMTP Supabase](https://supabase.com/docs/guides/auth/auth-smtp).

Objetivo: **cero mensual en beta si las cuotas y la autenticación lo permiten**. No prometer disponibilidad permanente ni correo ilimitado. Si SMTP/dominio no encaja, evaluar login OAuth con Google o GitHub; requiere su configuración y pruebas, pero evita enviar correo propio en cada login. Decidirlo antes de abrir el registro.

## Entornos y privacidad

- Desarrollo: Supabase local cuando sea viable; alternativamente proyecto cloud de pruebas sin datos reales.
- Producción personal/familiar: proyecto con datos reales, cada cuenta independiente.
- Evaluación: otro proyecto con registro propio, cuentas aisladas y datos ficticios optativos para cada usuario.

Para respetar dos proyectos Free, desarrollo y previews pueden compartir el entorno de evaluación, aceptando que las pruebas afecten su disponibilidad. Mejor opción cuando sea viable: desarrollo local y cloud solo para producción/evaluación. No crear proyectos de pago por defecto.

La web puede tener dos proyectos Vercel con el mismo repo y variables distintas. Los evaluadores se registran: no necesitan una cuenta compartida. La semilla ficticia se crea para quien la solicita; nunca copia datos familiares.

Vercel tiene variables por entorno Local/Preview/Production. Las previews de PR usan la base de pruebas, nunca el proyecto con datos personales. [Entornos](https://vercel.com/docs/deployments/environments).

## Preparación obligatoria antes de publicar

1. Corregir integridad y pasar lint, tipos, pruebas del dominio y build.
2. Versionar esquema/RLS/índices/restricciones/semilla con migraciones. Comparar contra base existente y ensayar en base nueva antes de tocar datos reales. [Migraciones](https://supabase.com/docs/guides/deployment/database-migrations).
3. RLS por propietario en tablas privadas y validación de claves foráneas. Probar API con usuarios A/B y sin sesión. [Checklist oficial](https://supabase.com/docs/guides/deployment/going-into-prod).
4. Corregir creación de perfiles compatible con email confirmado. Puede usarse trigger probado en `auth.users`; si falla, puede bloquear registros. Alternativa: completar perfil tras verificar identidad. [Perfiles](https://supabase.com/docs/guides/auth/managing-user-data).
5. Completar confirmación/callback/recuperación y SMTP u OAuth.
6. Site URL y redirecciones exactas de producción; localhost y previews controladas por separado. [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
7. Respaldos externos protegidos y prueba de restauración; no subir dumps financieros a GitHub. [Backups](https://supabase.com/docs/guides/platform/backups).

## Pasos futuros en Vercel

1. Importar `Fede17-9/Gestor_Finanzas` desde GitHub y elegir Next.js.
2. **Root Directory: `./` o vacía.** `package.json` está en raíz del remoto; no agregar de nuevo el nombre de la carpeta local.
3. Fijar Node acordado y lockfile; instalación `npm ci`, build `npm run build`, salida estándar detectada por Next.js.
4. Registrar variables públicas del Supabase correspondiente, separadas por proyecto/entorno. Credenciales administrativas solo en servidor si se necesitan.
5. Aplicar migraciones al entorno de evaluación y configurar Auth/URLs; compilar no hace esto.
6. Desplegar preview y comprobar registro, confirmación, acceso, aislamiento, operaciones, pendientes, presupuestos y metas en móvil/escritorio.
7. Publicar evaluación y añadir enlace visible en GitHub; configurar por separado la beta personal con su base real.

`vercel.json` no es obligatorio para Next.js estándar; su ausencia actual no es por sí sola un fallo.

## Automatización de recurrencias

El sincronizador anterior dependía de abrir el dashboard. Fue retirado en la etapa 1; hoy solo se proyectan reglas y no hay cron de servidor ni confirmación automática. Supabase ya aloja Auth y datos; su futura función programada se construirá sobre ese backend existente.

Diseño previsto: función transaccional/idempotente que genera ocurrencias únicas por regla/fecha; pendiente por defecto y automático optativo. Programarla con Supabase Cron y registrar ejecución/reintentos. [Supabase Cron](https://supabase.com/docs/guides/cron). El saldo usa movimientos confirmados, no proyecciones.

La ejecución global debe ser exclusiva del scheduler. La operación manual desde la web se limita al usuario de `auth.uid()`; no puede aceptar un propietario arbitrario ni exponer una función administrativa global. Revisar `EXECUTE`, `SECURITY DEFINER` y `search_path`, y probar aislamiento también mediante RPC. [Funciones de Postgres en Supabase](https://supabase.com/docs/guides/database/functions).

Si se elige Vercel Cron, el endpoint va en servidor y valida `CRON_SECRET`. Hobby permite una ejecución diaria con precisión por hora; no prometer exactitud al minuto. [Límites cron](https://vercel.com/docs/cron-jobs/usage-and-pricing), [gestión/protección](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## Portafolio y operación

En GitHub: problema resuelto, alcance/límites, enlace de app con registro propio, instrucciones para datos ficticios, capturas/video si la cuota gratuita pausa el servicio, instalación/arquitectura/migraciones/pruebas, commits/PR claros y licencia elegida. Sin datos personales en capturas, logs ni semillas.

Operación mínima: errores web, fallos cron/correo, tamaño/cuotas, backups y restauración. Rollback de frontend no revierte una migración SQL: mantener compatibilidad y procedimiento aparte de recuperación.

Antes de crecimiento global: revisar costos, abuso, soporte, accesibilidad y obligaciones de privacidad según público/jurisdicción concretos. Eso no exige construir una plataforma comercial para terminar la beta personal.
