# Validación de la auditoría

## Resultado vigente tras la primera entrega

El **20 de octubre de 2026** se implementaron las correcciones descritas en [ETAPA_1.md](ETAPA_1.md). Resultado actual: **22 pruebas aprobadas; TypeScript, lint sin errores/advertencias y build aprobados**. El build requiere red para descargar Geist. El servidor de producción respondió HTTP 200 en las nueve rutas existentes.

Los reportes ya no escriben datos al montar. La automatización anterior está desactivada; Supabase sigue integrado. No se modificó ni certificó la base remota y las pruebas del SDK usan respuestas simuladas. La comprobación HTTP no valida una sesión autenticada ni RLS.

## Registro histórico: auditoría inicial

Lo siguiente conserva los resultados anteriores a la implementación; sus fallos de compilación y ausencia de pruebas ya fueron superados por esta entrega.

Fecha: **20 de octubre de 2026**, zona America/Bogota.

## Alcance y límites

Lectura de código/configuración, comparación con referencias, revisión local de Git y checks existentes. Documentación oficial consultada para publicación y PliP como referencia del propietario.

No se inició sesión ni se operó contra la base remota. Se evitó abrir dashboard autenticado porque su montaje borra/inserta movimientos. No se leyeron valores de `.env.local`, no se desplegó ni se certificó RLS real.

Node observado: `v24.19.0`; Next.js: `16.1.7`. Dependencias ya instaladas; `package.json` y lockfile no se cambiaron.

## TypeScript: falló

Comando: `node_modules/.bin/tsc --noEmit --incremental false`.

- `app/dashboard/calendario/page.tsx:100`: TS7034, `merged` tiene `any[]` implícito.
- `app/dashboard/calendario/page.tsx:131`: TS7005, uso sin tipo determinado.
- `app/dashboard/page.tsx:496`: TS2322, callback de `LabelList` limitado a `number`, incompatible con las etiquetas que Recharts puede entregar.

Son tres diagnósticos de compilador, no un inventario completo de fallos funcionales.

## ESLint: falló

`npm run lint`: **35 problemas, 26 errores y 9 advertencias**. Incluye `any`, variables que deben ser `const`, estado derivado actualizado en efectos y componentes definidos durante render. Advertencias incluyen imports sin uso y `<img>`.

No se aplicó autofix ni se desactivaron reglas. Corregir lint no demuestra exactitud del dinero.

## Build: falló

`npm run build`: primer intento bloqueado al descargar Geist/Geist Mono desde Google Fonts por conectividad restringida. Se repitió con red: **JavaScript compiló, pero TypeScript detuvo el build en `calendario/page.tsx:100`**. El bloqueo confirmado tras resolver red pertenece al proyecto.

No hay build desplegable verificado; no se ejecutó `npm run start` sobre un build válido.

## Git y archivos

- `git diff --check` sin errores de espacios en cambios iniciales.
- `git fsck` sin corrupción informada; dos blobs sin referencia no requieren limpieza.
- Cambios previos de calendario/movimientos revisados también ignorando espacios: formato/saltos JSX, sin cambios de lógica observados.
- `.env.local`, `.next`, `node_modules` y generados relevantes estaban ignorados.
- Paths examinados de la historia sin `.env*`, `.pem` o `.key`. No equivale a análisis exhaustivo de secretos en todo el contenido histórico.
- Comparación main/origin/main usa referencia local: no se hizo fetch ni comprobación remota en vivo.

## Trabajo de esta tarea

Documentación/plan, copias de referencias externas en `docs/referencia`, ejemplo de variables vacío y reglas de edición/finales de línea. Se preservó la lógica de la app para que el diagnóstico refleje el estado encontrado.

Copias verificadas por hash respecto a originales; revisión final de enlaces, diff y seguimiento de variables. Log y status muestran los commits efectivamente realizados. Este documento no implica push ni publicación.

## Pendiente para declarar la versión confiable

Pruebas de dinero/fechas/concurrencia; base reconstruible desde migraciones; RLS con dos usuarios; registro/confirmación/recuperación; móvil; respaldo/restauración. Todavía no existe una suite que demuestre esos resultados.
