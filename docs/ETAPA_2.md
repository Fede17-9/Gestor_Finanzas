# Segunda entrega: base versionada y autenticación

Fecha: **20 de octubre de 2026**. Implementación local de la etapa 2; la etapa no se declara cerrada hasta validar Supabase remoto.

## Qué cambió

- Dos migraciones transaccionales reconstruyen el esquema documentado y establecen restricciones de dinero/fechas, alias normalizados, presupuestos únicos, índices y RLS por propietario. Categorías globales solo se leen; las privadas solo pertenecen a su usuario. El catálogo contable no es editable desde la aplicación.
- `supabase/inspect.sql` prepara una inspección de estructura sin exportar datos personales. Las migraciones se detienen ante incompatibilidades; no limpian registros por coincidencias ni corrigen datos silenciosamente.
- Registro compatible con confirmación de correo: mientras no hay sesión no intenta insertar en `usuarios`. Al confirmar se verifica la identidad y se completa el perfil. Un alias ocupado o metadata incompleta lleva a `/completar-perfil`, conservando la cuenta. No se sobrescribe un perfil existente con metadata de Auth.
- `/auth/callback` intercambia el código PKCE una sola vez, retira códigos/tokens de la URL y admite enlaces implícitos anteriores. El destino de recuperación se reconoce por el intercambio de Auth; un parámetro `next` no permite una redirección externa ni habilita por sí solo el formulario de contraseña.
- `/recuperar-clave` solicita un enlace con respuesta genérica. `/actualizar-clave` verifica sesión y contexto de recuperación antes de actualizar la contraseña; después cierra la sesión. Los enlaces PKCE se abren en el navegador donde se solicitaron.
- El layout de dashboard comprueba usuario con `getUser` y existencia del perfil antes de montar sus pantallas; distingue desconexión, perfil pendiente y error de red. Esta protección visual complementa RLS, no la reemplaza.
- La portada `/` dirige al acceso y conserva compatibilidad con callbacks antiguos dirigidos a la raíz. El login incorpora recuperación de acceso y errores visibles.
- Se admite `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, manteniendo compatibilidad con `NEXT_PUBLIC_SUPABASE_ANON_KEY`. No se reemplazó la configuración local existente.
- Next.js y su configuración ESLint se actualizaron de 16.1.7 a 16.4.2; se actualizaron dependencias transitivas compatibles. GitHub Actions queda preparado para pruebas, tipos, lint, auditoría de producción y build, sin credenciales reales.

## Verificación local

**48 pruebas aprobadas**: 22 de finanzas/reportes, 12 de autenticación y 14 de PostgreSQL/RLS. Las de Auth usan un cliente inyectado; las de SQL ejecutan PostgreSQL en memoria con PGlite y roles/identidad simulados.

Casos relevantes: registro sin sesión, perfil propio, alias ocupado, metadata que no sobrescribe perfiles, enlaces vencidos y redirecciones; invitados sin acceso, aislamiento A/B, categorías ajenas, moneda/identidad inmutables, importes inválidos y reversión completa ante historial incompatible.

`npm audit --omit=dev` informa **0 vulnerabilidades** al momento de esta entrega. La auditoría completa conserva **5 alertas altas** en la cadena de desarrollo `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`. No se aplicó `--force`: propone degradar la configuración a Next 14. Esto no equivale a ausencia absoluta de riesgos; revisar el aviso y actualizaciones futuras. [Aviso de braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [versión Next 16.4.2](https://github.com/vercel/next.js/releases/tag/v16.4.2).

Los resultados finales de compilación y revisión visual se registran en [VALIDACION.md](VALIDACION.md). La configuración de GitHub Actions está versionada; no se afirma que haya corrido en GitHub sin haberla publicado.

## Configuración de Supabase Auth

En un proyecto de pruebas, revisar **Authentication → URL Configuration**:

- Site URL local: `http://localhost:3000`.
- Redirect URL: `http://localhost:3000/auth/callback**` para cubrir los parámetros de confirmación/recuperación. Acotar las URLs al dominio de cada entorno al publicarlo; no autorizar dominios ajenos.
- Activar confirmación de correo y comprobar las plantillas de confirmación y recuperación con su enlace de confirmación estándar. Plantillas personalizadas que entreguen `token_hash` requieren adaptación antes de usarlas con este callback.
- Revisar política de contraseñas, límites y correo saliente. Antes de abrir registro público, configurar el servicio de correo y protección contra abuso adecuados a las cuotas reales.

No se envió ningún correo durante las pruebas de esta entrega. Hay que probar los enlaces reales, incluidos vencimiento, segundo uso y acceso desde el navegador solicitado. [URLs de redirección](https://supabase.com/docs/guides/auth/redirect-urls), [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [recuperación](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail).

## Pendientes para cerrar la etapa

1. Inspección y respaldo del Supabase existente, reconciliación de estructura y migraciones en una copia.
2. Validación A/B/invitado mediante API remota, incluyendo funciones/RPC/vistas y permisos no presentes en los archivos históricos.
3. Registro confirmado y recuperación por correo reales; comprobar completar perfil y errores de alias. Generar tipos desde la base definitiva.
4. Publicar la rama cuando corresponda, ejecutar CI remoto y exigir sus checks antes de integrar.

No se modificaron tablas, políticas, credenciales ni configuración del Supabase remoto. Recurrencias pendientes, presupuestos completos y aportes a metas siguen siendo las próximas entregas del plan.
