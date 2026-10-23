# Base de datos de Flux

Supabase proporciona autenticación y PostgreSQL. Esta carpeta conserva el esquema reproducible, la seguridad y las operaciones transaccionales de la aplicación.

## Migraciones, en orden

1. `20261020000100_baseline.sql`: tablas iniciales y catálogo contable. Solo para una base nueva sin tablas de la aplicación.
2. `20261020000200_private_finance.sql`: validación, índices, privilegios y RLS por propietario.
3. `20261022000100_recurrence_occurrences.sql`: reglas, vencimientos, confirmaciones, historial y procesamiento de recurrencias.
4. `20261022000200_budgets_and_goal_ledger.sql`: presupuestos, metas e historial de aportes y reversiones.

Las migraciones son transaccionales. Los errores revierten la operación; no se borran ni reparan datos automáticamente. No ejecutes la baseline ni un reset sobre tu proyecto existente. Los cambios de esquema se prueban primero en una copia con respaldo privado.

El propietario ya aplicó los cambios de las fases 2 a 4 al proyecto existente mediante el SQL Editor y reportó las pruebas funcionales y de aislamiento. Las pruebas locales reconstruyen el esquema versionado; no certifican que futuras modificaciones manuales del servicio remoto coincidan con él. Tampoco implican que el historial de Supabase CLI se haya reconciliado automáticamente.

## Herramientas conservadas

- `inspect.sql`: consulta estructura, permisos y funciones sin exportar perfiles ni movimientos.
- `verify_isolation.sql`: verificación administrativa de aislamiento entre cuentas con reversión de los datos de prueba. Revisa sus requisitos antes de ejecutarla.
- `enable_recurrence_cron.sql`: configura la tarea de recurrencias. El proyecto existente tiene `flux-recurrencias` programada cada quince minutos; no hace falta reinstalarla por fusionar ramas.
- `npm run db:types`: genera `lib/database.types.ts` desde las migraciones usando PostgreSQL local en memoria.
- `npm run db:types:check`: comprueba que los tipos versionados coincidan con ese esquema.
- `npm test`: valida permisos, aislamiento, recurrencias, presupuestos y metas con roles simulados en PGlite; no requiere Docker ni credenciales remotas.

## Configuración externa

Las migraciones no configuran URLs de Auth, SMTP, límites de correo ni respaldos. Al publicar, revisa en Supabase **Authentication → URL Configuration** el dominio de la aplicación y sus callbacks. Prueba registro, confirmación y recuperación en ese dominio.

La aplicación utiliza una clave pública con RLS. Las operaciones administrativas requieren un entorno privado; nunca coloques claves secretas o `service_role` en el navegador. Guarda respaldos fuera del repositorio y comprueba que puedan restaurarse.
