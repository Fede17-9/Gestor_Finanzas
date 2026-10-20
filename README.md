# Flux · Gestor de Finanzas

Aplicación web personal para registrar ingresos y gastos, consultar el flujo mensual, proyectar operaciones recurrentes y llevar metas de ahorro. Está construida con Next.js, TypeScript y Supabase.

El proyecto está en fase de **MVP en desarrollo**. El objetivo es terminar un registro financiero personal confiable y publicar una demostración con datos ficticios que pueda probarse desde el portafolio. Cada usuario gestionará sus datos privados, sin relaciones entre usuarios ni finanzas compartidas. La dirección visual acordada es una identidad sobria, tomando PliP como referencia; la interfaz actual conserva el estilo oscuro con acentos verdes.

## Estado al 20 de octubre de 2026

Ya existen registro e inicio de sesión, dashboard con métricas y gráficos, creación y edición de movimientos, calendario, gestión de recurrencias, metas de ahorro y configuración del perfil. Estas pantallas consultan y modifican datos de Supabase.

La aplicación todavía requiere correcciones antes de usarse como registro financiero principal o publicarse:

- **Riesgo de pérdida de datos:** cargar el dashboard puede ejecutar un `DELETE` para eliminar supuestos movimientos automáticos duplicados. La coincidencia por fecha y categoría puede borrar operaciones legítimas. Debe retirarse o sustituirse antes de usar datos reales.
- Las recurrencias no tienen una identidad de ejecución que evite duplicados de forma fiable; la frecuencia anual, las fechas límite, las pausas y las zonas horarias tienen inconsistencias.
- Las metas son contadores manuales; cambiar la moneda del perfil no convierte el historial. Presupuestos, cuentas y tarjetas no son módulos terminados.
- TypeScript y la compilación de producción fallan. ESLint reportó **26 errores y 9 advertencias**. No hay una versión de producción validada.
- No se verificaron las políticas de seguridad ni el esquema de la base remota. El SQL de referencia todavía no constituye una migración segura y reproducible.
- La ruta `/` sigue mostrando la plantilla de Next.js. La presentación pública y la experiencia móvil están pendientes.

El diagnóstico completo, con alcance y evidencias, está en [Estado del proyecto](docs/ESTADO_PROYECTO.md) y [Validación técnica](docs/VALIDACION.md). No se probaron operaciones con datos personales durante la auditoría.

## Tecnología

- Next.js 16.1.7 con App Router y React 19.2.3.
- TypeScript y Tailwind CSS 4.
- Supabase Auth y PostgreSQL; acceso desde el navegador mediante `lib/supabase.ts`.
- Recharts para gráficos y Lucide para iconos.

El entorno auditado utilizó Node.js **24.19**. El proyecto todavía no fija una versión mediante `engines`; debe definirse y validarse antes de establecer el entorno de CI y despliegue. Las dependencias y los scripts están en [package.json](package.json); `package-lock.json` registra su resolución.

## Ejecutar en local

Usa un proyecto Supabase de pruebas y datos ficticios. El dashboard realiza escrituras al cargar y conserva el riesgo de borrado descrito arriba.

Desde la raíz del repositorio, donde está `package.json`, instala las dependencias y crea el archivo local de configuración solo si todavía no existe:

```powershell
npm ci
if (-not (Test-Path -LiteralPath .env.local)) {
  Copy-Item -LiteralPath .env.example -Destination .env.local
}
```

Configura en `.env.local` estas variables con los valores de tu proyecto de pruebas:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

La segunda variable conserva el nombre que utiliza el cliente actual. Usa una clave pública apta para navegador; nunca una clave secreta o `service_role`. Los datos deben protegerse mediante políticas RLS comprobadas en Supabase.

El esquema histórico está en [Referencia de la base de datos](docs/referencia/base_de_datos.txt). No lo ejecutes sobre una base con datos: no incluye toda la configuración necesaria para reproducir y proteger el servicio. Antes de probar los flujos, prepara y verifica el esquema, los catálogos, las políticas RLS y la configuración de autenticación en el entorno de pruebas. Esa instalación todavía necesita convertirse en migraciones versionadas.

Después inicia el servidor:

```powershell
npm run dev
```

Abre [http://localhost:3000/login](http://localhost:3000/login) o [http://localhost:3000/registro](http://localhost:3000/registro). La portada `http://localhost:3000/` continúa siendo la plantilla inicial. Que una pantalla cargue en desarrollo no demuestra que la compilación de producción o sus operaciones financieras sean correctas.

## Comprobaciones

Desde la raíz del repositorio:

```powershell
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

**Las tres comprobaciones fallan en el estado auditado.** Lint reportó 26 errores y 9 advertencias; TypeScript presenta errores en calendario y dashboard, que también bloquean la compilación. Consulta [Validación técnica](docs/VALIDACION.md) para el detalle. El siguiente ciclo debe resolverlos antes de activar comprobaciones obligatorias en las pull requests.

## Documentación y continuación

- [Estado del proyecto](docs/ESTADO_PROYECTO.md): arquitectura, pantallas reales, base documentada y problemas priorizados.
- [Plan de desarrollo](docs/PLAN_DESARROLLO.md): alcance personal, fases y criterios para completar el producto.
- [Plan de despliegue](docs/DESPLIEGUE.md): entorno privado, demo pública y preparación para publicación.
- [Guía de Git](docs/GIT.md): estado inicial, commits, ramas, pull requests y convenciones.
- [Validación técnica](docs/VALIDACION.md): comprobaciones ejecutadas y límites de la auditoría.
- [SQL de referencia](docs/referencia/base_de_datos.txt) e [historial de desarrollo](docs/referencia/historial_desarrollo.md): antecedentes conservados; no equivalen al estado verificado del servicio remoto.

La prioridad es preservar el historial financiero, hacer seguras las recurrencias, versionar la base de datos y sus políticas, corregir las comprobaciones técnicas y completar el uso móvil. La demo deberá utilizar únicamente datos ficticios, separada de cualquier uso personal.

## Publicación prevista

La propuesta es desplegar Next.js en Vercel y mantener autenticación y datos en Supabase. Como `package.json` está en la raíz del repositorio Git, la configuración **Root Directory** será `./` para este repositorio. Las variables de entorno se configurarán en el proveedor; no se publicarán credenciales ni datos financieros personales.

Todavía no hay una demo publicada y validada en esta documentación. El despliegue queda condicionado a resolver los bloqueos de integridad, seguridad y compilación, y a probar un recorrido completo con datos ficticios. El procedimiento está en [Plan de despliegue](docs/DESPLIEGUE.md).

## Licencia

La licencia todavía no se ha elegido. Debe definirse antes de presentar el proyecto como reutilizable por terceros.
