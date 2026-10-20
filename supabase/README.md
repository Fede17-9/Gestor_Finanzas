# Base de datos de Flux

Supabase sigue siendo el backend. Estos archivos versionan el esquema; **no se han aplicado al proyecto remoto existente**.

## Archivos y orden

1. `inspect.sql`: inspección administrativa de solo lectura. Devuelve estructura, permisos, políticas, índices, restricciones, triggers y catálogo contable, sin exportar perfiles ni movimientos. Guardar su resultado fuera del repositorio público. No sustituye un respaldo completo.
2. `migrations/20261020000100_baseline.sql`: crea las siete tablas históricas y el catálogo; bloquea el acceso de la API mientras se prepara la seguridad. **Solo para una base nueva sin tablas de la aplicación**. Se detiene si encuentra cualquiera de ellas.
3. `migrations/20261020000200_private_finance.sql`: restricciones, índices, validación de categorías, privilegios mínimos y RLS por propietario. Solo admite catálogo y estructura compatibles. Sustituye las políticas de las siete tablas de la aplicación, sin tocar otras tablas.

Cada migración es transaccional. Una fila histórica inválida, un alias duplicado al normalizarlo o una referencia de categoría ajena hacen fallar la transacción: no se borran ni reparan datos automáticamente. Se debe revisar la causa antes de reintentar.

## Proyecto Supabase existente

No ejecutar la baseline ni hacer `db reset` sobre él. Primero:

1. Inspeccionar estructura, políticas, privilegios, funciones expuestas, triggers de `auth.users` y registro de migraciones. `inspect.sql` cubre las tablas conocidas; revisar además funciones/RPC, otras tablas y vistas del proyecto.
2. Exportar esquema y datos mediante acceso administrativo; guardar el respaldo en privado y comprobar su restauración en otro entorno.
3. Comparar contra la baseline y resolver diferencias en una copia. Un trigger remoto de creación de perfiles puede requerir reconciliación con el nuevo flujo de la aplicación.
4. Integrar el historial de migraciones existente. Marcar una baseline como aplicada solo tras demostrar equivalencia; no crear un historial ficticio para saltarse una diferencia.
5. Ensayar la migración de seguridad, conservar los resultados y repetir pruebas directas con usuarios A/B y sesión anónima mediante la API real.
6. Aplicar cambios revisados y generar tipos TypeScript desde el esquema real. Volver a probar registro, confirmación, recuperación, categorías y formularios.

La aplicación usa una clave pública. Las migraciones requieren acceso administrativo; una clave `service_role` nunca debe incluirse en `.env` pública ni en el navegador. La migración no configura SMTP, plantillas de correo, URLs de Auth, protección contra abuso, funciones remotas preexistentes ni copias de seguridad.

## Pruebas sin tocar Supabase

Con Node 24 y dependencias instaladas:

```powershell
npm test
```

`tests/database.test.mjs` ejecuta ambas migraciones en PostgreSQL local en memoria con PGlite. Simula `auth.users`, `auth.uid()` y roles de Supabase, prueba aislamiento y validación SQL, y descarta la base al terminar. No requiere Docker, CLI de Supabase ni credenciales. PGlite es dependencia de desarrollo; la aplicación publicada sigue usando Supabase.

Estas pruebas demuestran el comportamiento SQL bajo ese entorno, no la configuración efectiva del servicio remoto, sus JWT, correos, PostgREST o funciones adicionales. Ver [entrega de acceso privado](../docs/ETAPA_2.md).
