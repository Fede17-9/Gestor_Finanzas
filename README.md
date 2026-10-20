# Flux · Gestor de Finanzas

Aplicación web personal para registrar ingresos y gastos, consultar el flujo mensual, proyectar operaciones recurrentes y llevar metas de ahorro. Está construida con Next.js, TypeScript y Supabase.

El proyecto está en fase de **MVP en desarrollo**. El objetivo es terminar un registro financiero personal confiable y publicar una demostración con datos ficticios que pueda probarse desde el portafolio. Cada usuario gestionará sus datos privados, sin relaciones entre usuarios ni finanzas compartidas. La dirección visual acordada es una identidad sobria, tomando PliP como referencia; la interfaz actual conserva el estilo oscuro con acentos verdes.

## Estado al 20 de octubre de 2026

Supabase **ya está integrado** para autenticación y datos. La primera entrega de integridad/compilación está implementada en la aplicación:

- Dashboard y calendario consultan datos sin crear ni borrar movimientos al cargar.
- Los gastos legítimos con igual categoría/importe/fecha se conservan.
- Importes calculados en centavos y validados; fecha «hoy» de Bogotá; proyecciones con vigencia y frecuencias coherentes.
- Historial paginado y errores visibles, sin presentar totales parciales como si fueran completos.
- **22 pruebas, TypeScript, lint sin errores/advertencias y build aprobados.**

El registro automático anterior se retiró. Las reglas se muestran como proyecciones separadas de las operaciones registradas; las ocurrencias pendientes y confirmaciones configurables se construirán en la etapa 3.

Aún faltan restricciones/migraciones y comprobación de RLS en Supabase remoto, presupuestos, historial de aportes a metas, presentación móvil y beta. Cambiar la moneda sin conversión está bloqueado; se selecciona al registrarse. La portada `/` sigue siendo la plantilla de Next.js.

Consulta [primera entrega y límites](docs/ETAPA_1.md) y [validación actual](docs/VALIDACION.md). El [diagnóstico inicial](docs/ESTADO_PROYECTO.md) se conserva como fotografía anterior a las correcciones. Ningún dato remoto se modificó durante esta implementación.

## Tecnología

- Next.js 16.1.7 con App Router y React 19.2.3.
- TypeScript y Tailwind CSS 4.
- Supabase Auth y PostgreSQL; acceso desde el navegador mediante `lib/supabase.ts`.
- Recharts para gráficos y Lucide para iconos.

El proyecto requiere **Node.js 24.x**, declarado en `engines` y `.nvmrc`; se validó con 24.19.0. Las pruebas usan el runner nativo de Node, sin nuevas dependencias. Versiones y scripts en [package.json](package.json), resolución en `package-lock.json`.

## Ejecutar en local

Conserva la configuración de tu Supabase existente. Para verificar cambios de esquema y envíos de formularios, usa un entorno de pruebas con datos ficticios. Dashboard y calendario son de solo lectura; crear, editar o eliminar desde formularios sigue modificando el Supabase configurado.

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
npm test
npm run typecheck
npm run lint
npm run build
```

**Las cuatro comprobaciones pasan en esta entrega.** El build descarga las fuentes Geist y necesita acceso de red. También se comprobó el arranque de producción y HTTP 200 en las nueve rutas. Esto no certifica RLS ni los formularios contra la base real; consulta [validación y límites](docs/VALIDACION.md).

## Documentación y continuación

- [Primera entrega](docs/ETAPA_1.md): correcciones, pruebas y pendientes concretos.
- [Estado del proyecto](docs/ESTADO_PROYECTO.md): auditoría inicial; arquitectura, pantallas reales, base documentada y problemas priorizados.
- [Plan de desarrollo](docs/PLAN_DESARROLLO.md): alcance personal, fases y criterios para completar el producto.
- [Plan de despliegue](docs/DESPLIEGUE.md): entorno privado, demo pública y preparación para publicación.
- [Guía de Git](docs/GIT.md): estado inicial, commits, ramas, pull requests y convenciones.
- [Validación técnica](docs/VALIDACION.md): comprobaciones ejecutadas y límites de la auditoría.
- [SQL de referencia](docs/referencia/base_de_datos.txt) e [historial de desarrollo](docs/referencia/historial_desarrollo.md): antecedentes conservados; no equivalen al estado verificado del servicio remoto.

El siguiente bloque es inspeccionar/versionar la base de datos y sus políticas. Después se implementarán las ocurrencias pendientes y su confirmación manual/automática. La publicación para evaluadores tendrá cuentas propias y datos ficticios, separada del uso personal.

## Publicación prevista

Supabase ya proporciona autenticación y datos. La publicación futura añade alojamiento para Next.js en Vercel, manteniendo ese backend. Como `package.json` está en la raíz del repositorio Git, la configuración **Root Directory** será `./` para este repositorio. Las variables de entorno se configurarán en el proveedor; no se publicarán credenciales ni datos financieros personales.

Todavía no hay una demo publicada y validada en esta documentación. El despliegue queda condicionado a validar restricciones/permisos remotos y probar el recorrido completo con datos ficticios. El procedimiento está en [Plan de despliegue](docs/DESPLIEGUE.md).

## Licencia

La licencia todavía no se ha elegido. Debe definirse antes de presentar el proyecto como reutilizable por terceros.
