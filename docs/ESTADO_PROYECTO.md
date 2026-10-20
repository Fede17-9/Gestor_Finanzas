# Estado del proyecto Flux / Gestor de Finanzas

Fecha de corte: **20 de octubre de 2026**, zona horaria de referencia: **America/Bogota**.

Este diagnóstico describe el código local revisado y los resultados de validación disponibles en esta fecha. No se inspeccionó la base de datos remota, no se abrió una sesión con datos personales y no se modificó el código de la aplicación. Las referencias de líneas corresponden al estado auditado, antes de corregir los problemas descritos.

## Diagnóstico general

Flux es una aplicación web personal para registrar ingresos y gastos, consultar el flujo mensual, definir operaciones recurrentes y llevar metas de ahorro. Tiene una interfaz oscura con acentos verdes y una base funcional considerable: autenticación, movimientos editables, gráficos, calendario, recurrencias, metas y perfil.

El estado adecuado para describirla es **MVP en desarrollo**. Varias pantallas hacen operaciones reales contra Supabase, pero la integridad de los movimientos recurrentes necesita trabajo antes de confiarle el registro financiero principal. La prioridad es corregir la posibilidad de borrar movimientos válidos al cargar el dashboard, reemplazar las coincidencias por categoría por una identidad real de cada ejecución y unificar las reglas de fechas.

La presencia de una pantalla o de una tabla SQL no significa que el módulo esté terminado. Tampoco se puede deducir del código que la configuración de seguridad y autenticación del servicio remoto sea la misma que describe la bitácora.

## Objetivo acordado para continuar: aún no implementado

La siguiente versión se orientará al uso **personal y familiar con cuentas privadas independientes**. Cada persona, incluidos los familiares, manejará su propio registro. No se crearán relaciones entre cuentas, grupos familiares, datos compartidos o permisos cruzados como parte del alcance acordado.

Los evaluadores del portafolio podrán **registrar su propia cuenta** y probar la aplicación con datos ficticios. El acceso público no debe exponer los movimientos del propietario ni depender de compartir una cuenta personal. Preparar ese registro y comprobar el aislamiento entre usuarios son tareas pendientes de publicación, no capacidades remotas certificadas en esta auditoría.

Se buscará una apariencia más sobria, tomando **PliP como referencia de producto y presentación**, y se priorizarán decisiones compatibles con un presupuesto bajo. Es una dirección de diseño acordada; la interfaz existente conserva el tema negro y verde neón descrito en este documento.

El MVP objetivo incluye **ingresos, gastos, recurrencias, calendario, presupuestos y metas**. Presupuestos requiere desarrollar su módulo: hoy solo está definido en el SQL. Las otras áreas existen en distintos grados, con las limitaciones señaladas en el inventario y los hallazgos.

Para las recurrencias se acordó permitir **operaciones pendientes y registro automático seleccionable por regla**. La **fecha prevista** de una operación debe conservarse separada de su **fecha real** de registro o ejecución. La versión actual no dispone de ese flujo ni de esos campos y estados diferenciados: genera movimientos desde el dashboard y solo conserva `fecha_operacion` en cada movimiento. Por tanto, estos comportamientos pertenecen al desarrollo propuesto y requieren definir el modelo, la interfaz y las pruebas correspondientes.

## Arquitectura que existe

La aplicación usa Next.js 16.1.7 con App Router, React 19.2.3, TypeScript y Tailwind CSS 4. Recharts dibuja los gráficos y Lucide aporta los iconos. Las versiones declaradas están en [package.json](../package.json).

El recorrido principal es:

```text
Navegador del usuario
  └─ Pantallas React de Next.js
       └─ lib/supabase.ts: cliente de Supabase
            ├─ Supabase Auth: registro, sesión y cierre de sesión
            └─ API de datos → PostgreSQL: perfiles y datos financieros
                 └─ Políticas RLS: aislamiento por usuario, si están configuradas
```

Las pantallas consultan e insertan datos directamente desde el navegador mediante [lib/supabase.ts](../lib/supabase.ts#L1), líneas 1–6. El cliente utiliza las variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`; los valores no se incluyen en este diagnóstico. El código revisado no presenta una capa propia de API para las operaciones financieras.

El navegador decide qué mostrar y qué solicitar, pero el aislamiento de los datos debe imponerse en PostgreSQL mediante RLS. Los filtros de las consultas y las redirecciones de React no sustituyen esas políticas. El [layout del dashboard](../app/dashboard/layout.tsx#L8), líneas 8–15, monta el menú y el contenido; no incorpora una comprobación central de autenticación. Distintas pantallas comprueban la sesión de forma individual.

La lógica de recurrencias está dentro del efecto de carga de [app/dashboard/page.tsx](../app/dashboard/page.tsx#L79), líneas 79–154. El calendario tiene otro algoritmo para proyectarlas en [app/dashboard/calendario/page.tsx](../app/dashboard/calendario/page.tsx#L50), líneas 50–135. Esta duplicación permite que la previsión y los movimientos generados discrepen.

## Inventario de pantallas y comportamiento real

### `/`

La portada sigue siendo la plantilla inicial de Next.js, con enlaces de documentación y despliegue: [app/page.tsx](../app/page.tsx#L3), desde la línea 3. No explica Flux ni conduce al visitante por una experiencia de demostración propia. Es una pieza pendiente para presentar el proyecto en un portafolio.

### `/registro`

Existe un formulario para correo, contraseña, nombre, alias, moneda y avatar. Primero crea la cuenta mediante `signUp` y después intenta insertar su perfil en `usuarios`: [app/registro/page.tsx](../app/registro/page.tsx#L33), líneas 33–57. Son operaciones separadas; crear la cuenta no garantiza que se haya creado también su perfil.

La bitácora menciona que se desactivó temporalmente la confirmación de correo durante el desarrollo. Esa afirmación histórica no permite saber la configuración actual de Supabase. La experiencia de registro debe comprobarse con la configuración que se vaya a desplegar.

### `/login`

El formulario inicia sesión con correo y contraseña mediante `signInWithPassword` y redirige al dashboard: [app/login/page.tsx](../app/login/page.tsx#L19), líneas 19–28. Hay navegación hacia registro. El menú permite cerrar sesión mediante `signOut`: [components/Sidebar.tsx](../components/Sidebar.tsx#L29), líneas 29–31.

### `/dashboard`

Consulta perfil y movimientos; presenta saldo histórico, ingreso mensual, gasto mensual, gráfico diario, últimos cuatro movimientos y desgloses por categoría. El selector permite recorrer seis meses, incluido el actual: [app/dashboard/page.tsx](../app/dashboard/page.tsx#L34), líneas 34–39. Los acumuladores mensuales están en las líneas 171–215 y el análisis por categoría en las líneas 396–426.

El saldo mostrado suma ingresos menos egresos registrados. No representa una conciliación bancaria ni el saldo de varias cuentas. Los últimos cuatro movimientos son los más recientes del historial completo, incluso al seleccionar otro mes; esto está implementado expresamente en las líneas 211–212.

Al entrar también intenta borrar supuestos duplicados y crear movimientos recurrentes atrasados. Por tanto, esta pantalla produce escrituras en la base de datos durante su carga. Su tarjeta de tarjetas bancarias muestra el literal `0 Activas`, sin consultar un módulo de tarjetas: línea 240. La campana de [DashboardHeader.tsx](../components/DashboardHeader.tsx#L38), líneas 38–40, no tiene una acción conectada.

### `/dashboard/movimientos`

Permite listar, buscar, crear, editar y eliminar ingresos y egresos. El formulario admite efectivo y transferencia, categoría existente o nueva, descripción y fecha elegida por el usuario. La búsqueda se ejecuta en memoria sobre los registros cargados: [app/dashboard/movimientos/page.tsx](../app/dashboard/movimientos/page.tsx#L379), líneas 379–398.

La edición y el borrado están implementados en las líneas 62–165. La creación del movimiento y de una regla recurrente opcional está en las líneas 203–287. El formulario ofrece frecuencia diaria, semanal, mensual y anual, aunque el resto de la aplicación no ejecuta todas ellas.

### `/dashboard/calendario`

Presenta una cuadrícula navegable por meses. Combina movimientos registrados con proyecciones de reglas activas y calcula encabezados de actividad manual y automática: [app/dashboard/calendario/page.tsx](../app/dashboard/calendario/page.tsx#L13), líneas 13–153.

No debe interpretarse todavía como una previsión financiera exacta: omite límites de algunas reglas y fusiona movimientos distintos por coincidencias de categoría e importe. También mezcla movimientos automáticos ya ejecutados con proyecciones dentro de «Flujo Máquina»; esa cifra no equivale exclusivamente a dinero futuro pendiente.

### `/dashboard/recurrencias`

Lista y busca reglas; permite pausar, reactivar, borrar y editar importe, frecuencia, fecha de inicio y fecha de fin: [app/dashboard/recurrencias/page.tsx](../app/dashboard/recurrencias/page.tsx#L71), líneas 71–219. Borrar una regla conserva los movimientos históricos.

La edición no permite modificar el día mensual de ejecución, el tipo o la categoría: los campos enviados al actualizar son los de las líneas 187–192. Además, el selector de edición ofrece Diario, Semanal y Mensual en las líneas 471–473, mientras que la creación desde Movimientos también ofrece Anual.

### `/dashboard/metas`

Permite crear una meta con objetivo, ahorro inicial, fecha y prioridad, modificar su importe ahorrado y eliminarla. El estado completado se calcula comparando monto actual y objetivo: [app/dashboard/metas/page.tsx](../app/dashboard/metas/page.tsx#L40), líneas 40–41. Las operaciones están en las líneas 117–199.

Actualizar una meta modifica directamente `monto_actual`; no registra un aporte financiero ni separa dinero del saldo. Tampoco hay historial de aportes, relación con movimientos o conciliación entre ahorro y efectivo disponible. La edición actual modifica el avance; no ofrece cambiar todos los datos de definición de la meta.

### `/dashboard/configuracion`

Permite modificar nombre, alias, moneda base y avatar. Muestra información de cuenta de solo lectura: [app/dashboard/configuracion/page.tsx](../app/dashboard/configuracion/page.tsx#L71), líneas 71–137 y 309–335.

El selector de moneda admite USD, COP y EUR. Cambiarlo modifica un atributo del perfil; no convierte importes ni cambia una moneda guardada por movimiento, porque ese dato no existe en el esquema local.

## Base de datos documentada

El archivo [base_de_datos.txt](referencia/base_de_datos.txt#L1) contiene un esquema SQL inicial con siete tablas propias. La referencia a `auth.users` corresponde a la tabla administrada por Supabase Auth, adicional a estas siete.

1. **`usuarios`**, líneas 2–9: perfil asociado a `auth.users`, nombre, alias único, moneda y avatar.
2. **`tipos_movimiento`**, líneas 12–17: catálogo de tipos y signo contable. Los datos iniciales, líneas 80–84, son Ingreso, Egreso, Inversión y Traspaso.
3. **`categorias`**, líneas 20–27: categorías por usuario con nombre, color e icono opcionales. El esquema evita repetir exactamente el mismo nombre para un usuario.
4. **`movimientos`**, líneas 30–40: usuario, tipo, categoría, importe, método, fecha, descripción y marca de automático. No contiene cuenta financiera, moneda propia ni vínculo a una recurrencia.
5. **`config_recurrencias`**, líneas 43–54: regla con importe, frecuencia, día, inicio, fin y estado activo. El esquema admite Anual.
6. **`presupuestos_mensuales`**, líneas 57–65: límite por categoría, mes, año y umbral de alerta. Existe en el diseño SQL; no hay una pantalla o flujo de presupuestos implementado en el código revisado.
7. **`metas_ahorro`**, líneas 68–77: objetivo, monto acumulado, fecha, prioridad y estado. No hay una tabla de aportes.

Este archivo **no es una fotografía verificada de la base remota**. No se consultaron tablas, políticas, índices, restricciones o datos reales de Supabase. Tampoco incorpora las políticas RLS que narra la bitácora. Las operaciones de edición y borrado presentes en el código necesitan políticas compatibles, pero su existencia en producción no quedó demostrada en esta revisión.

El SQL local no define restricciones positivas para todos los importes, coherencia entre inicio y fin, identidad única de una ejecución recurrente o pertenencia del usuario de una categoría respecto del movimiento que la utiliza. Debe evolucionar hacia migraciones versionadas con restricciones y políticas verificables; solo copiar este archivo no reproduce necesariamente el entorno utilizado durante el desarrollo.

## Relación con el historial de desarrollo

La bitácora [historial_desarrollo.md](referencia/historial_desarrollo.md#L1) explica el origen con Next.js y Supabase, autenticación, rediseño visual, movimientos, calendario y sincronización al entrar. Su última fase documentada es la 9, desde la línea 108.

El código incluye avances que la bitácora ya no detalla: edición y eliminación de movimientos, análisis por categorías, página de recurrencias, metas y configuración. Por eso el historial sirve como contexto de construcción, pero no como inventario actualizado ni como prueba de que cada función está terminada.

Hay afirmaciones que necesitan corregirse. La protección descrita mediante `useRef` en la línea 114 no evita ejecuciones concurrentes entre pestañas o dispositivos. La «deduplicación extrema» de la línea 116 no garantiza integridad: puede ocultar movimientos legítimos. La corrección global de zona horaria de la línea 101 tampoco está completa mientras los valores predeterminados de fecha se sigan obteniendo desde UTC.

## Hallazgos que impiden dar el MVP por terminado

### P0: riesgo de pérdida de movimientos al visitar el dashboard

En [app/dashboard/page.tsx](../app/dashboard/page.tsx#L59), líneas 59–75, el dashboard identifica supuestos duplicados automáticos usando únicamente fecha y categoría. Si encuentra dos, ejecuta un borrado real en la línea 74. No compara importe, tipo, descripción o regla de origen.

Dos cobros válidos de servicios el mismo día pueden colisionar aunque sus importes sean diferentes. También pueden colisionar un ingreso y un egreso de la misma categoría. La siguiente carga de la pantalla puede eliminar uno de ellos. Además, la lista local se filtra aunque el borrado remoto no se haya completado correctamente.

**Acción prioritaria:** retirar esta limpieza de la carga normal, conservar los registros existentes y resolver duplicados únicamente mediante una identidad demostrable de ejecución. Para reproducir o verificar el problema deben usarse datos de prueba aislados.

### P1: las ejecuciones recurrentes carecen de identidad e idempotencia

El esquema de [movimientos](referencia/base_de_datos.txt#L30), líneas 30–40, no guarda `id_recurrencia` ni una clave única de regla y fecha programada. El motor de [dashboard/page.tsx](../app/dashboard/page.tsx#L118), líneas 118–125, pregunta si existe cualquier movimiento de igual categoría y fecha.

Esto permite que un movimiento manual impida generar otra obligación distinta. Las reglas sin categoría nunca encuentran coincidencia, porque la línea 122 descarta los movimientos sin categoría. Pueden volver a generarse en visitas posteriores. Si varias reglas comparten categoría y fecha, el cálculo no incorpora a su comprobación los movimientos que ya está acumulando en `newMovs`, lo que también permite insertar varias filas que después la limpieza tratará como duplicadas.

El bloqueo con `useRef` se limita a la instancia del componente. No es una garantía de exclusión entre dos pestañas, dos dispositivos o reintentos. La garantía debe vivir en la base de datos mediante una clave de ejecución única y una operación segura de inserción.

### P1: fecha de fin ignorada y frecuencia anual incompleta

La creación ofrece Anual y fecha final en [movimientos/page.tsx](../app/dashboard/movimientos/page.tsx#L599), líneas 599–617. Sin embargo, el motor del dashboard solo implementa Mensual, Semanal y Diario y no usa `fecha_fin`: [dashboard/page.tsx](../app/dashboard/page.tsx#L90), líneas 90–116.

El calendario tampoco implementa Anual y ni siquiera selecciona la fecha final al consultar las reglas: [calendario/page.tsx](../app/dashboard/calendario/page.tsx#L19), líneas 19–23 y 55–74. Una regla terminada puede seguir produciendo proyecciones y movimientos; una regla anual puede crearse sin ejecutarse.

### P1: el calendario elimina visualmente movimientos distintos

La deduplicación de [calendario/page.tsx](../app/dashboard/calendario/page.tsx#L106), líneas 106–115, agrupa los movimientos reales del día por nombre de categoría e importe. No utiliza su ID ni distingue el tipo. Dos compras de comida de $20 pueden aparecer como una sola. Un ingreso y un egreso del mismo monto y categoría también pueden colisionar.

Las sumas de la pantalla se calculan a partir de esa lista ya reducida en las líneas 137–153. Por tanto, el problema afecta tanto a la representación como a los totales del calendario, aunque las dos filas sigan existiendo en la base de datos.

### P1: reglas temporales distintas en creación, ejecución y proyección

Las proyecciones Mensual y Diario se dibujan sin comprobar `fecha_inicio` en [calendario/page.tsx](../app/dashboard/calendario/page.tsx#L57), líneas 57–63. Una suscripción iniciada en octubre puede aparecer al consultar septiembre. La rama Semanal sí comprueba el inicio, en las líneas 66–71.

Al crear una operación recurrente retroactiva, el movimiento usa la fecha elegida por el usuario, pero la regla utiliza el día actual obtenido por UTC: [movimientos/page.tsx](../app/dashboard/movimientos/page.tsx#L246), líneas 246 y 267. La recurrencia semanal se ancla a ese inicio y no al «Día del mes» del formulario, que aparece para todas las frecuencias.

Pausar y reactivar solo cambia un booleano en [recurrencias/page.tsx](../app/dashboard/recurrencias/page.tsx#L105), líneas 105–118. Al reactivar, el dashboard vuelve a recorrer desde el inicio original hasta hoy. No existe un historial de pausas ni una política explícita para omitir o recuperar las ocurrencias durante ese intervalo.

### P1: creación de movimientos con importes no positivos

El input de alta no tiene mínimo en [movimientos/page.tsx](../app/dashboard/movimientos/page.tsx#L525), línea 525, y el manejador guarda `parseFloat(monto)` sin validar que sea positivo en las líneas 203–249. El SQL tampoco añade esa restricción en [base_de_datos.txt](referencia/base_de_datos.txt#L35), línea 35.

Un egreso negativo aumenta el saldo, porque se resta un número negativo en [dashboard/page.tsx](../app/dashboard/page.tsx#L195), línea 195. La edición sí comprueba que el importe sea mayor que cero, por lo que alta y edición no aplican la misma regla.

### P1: el día predeterminado cambia antes de la medianoche de Bogotá

En [movimientos/page.tsx](../app/dashboard/movimientos/page.tsx#L20), líneas 20, 267 y 280, `toISOString().split('T')[0]` obtiene la fecha UTC. En Bogotá, después de las 19:00, puede seleccionar el día siguiente como «hoy». El motor también transforma fechas locales en UTC en [dashboard/page.tsx](../app/dashboard/page.tsx#L119), línea 119.

Separar el texto `YYYY-MM-DD` al mostrarlo evita algunos desplazamientos de lectura, pero no corrige estos valores al escribir. La aplicación necesita una definición única de fecha civil y zona horaria para sus operaciones.

### P2: moneda, tipos contables y metas tienen alcance limitado

El catálogo SQL incluye Inversión con signo -1 y Traspaso con signo 0, pero los acumuladores solo contemplan los tipos 1 y 2 en [dashboard/page.tsx](../app/dashboard/page.tsx#L194), líneas 194–205. La interfaz de alta permite únicamente Ingreso y Egreso. Debe completarse la semántica antes de usar los otros tipos del catálogo.

Cambiar `codigo_moneda` en [configuracion/page.tsx](../app/dashboard/configuracion/page.tsx#L118), líneas 118–123, no transforma el historial. Distintas pantallas continúan mostrando `$` fijo. Para una primera versión personal es razonable definir una única moneda para todo el historial y un formato monetario compartido. Si se quiere conversión real, requiere otro modelo de datos y reglas de valoración.

Las metas son contadores manuales. Modificar su avance en [metas/page.tsx](../app/dashboard/metas/page.tsx#L160), líneas 160–163, no mueve dinero ni registra su origen. El total ahorrado puede diferir de los fondos disponibles. Hace falta decidir si esa simplicidad es deseada o si deben existir aportes asociados a movimientos.

### P2: errores, operaciones parciales y consistencia de sesión

Crear categoría, movimiento y recurrencia son solicitudes distintas en [movimientos/page.tsx](../app/dashboard/movimientos/page.tsx#L221), líneas 221–271. Si una falla, las anteriores pueden quedar guardadas. La interfaz reconoce un caso parcial de recurrencia fallida, pero no existe una transacción de negocio que garantice el resultado completo.

Varios listados solo actualizan su estado cuando la consulta tiene éxito, sin comunicar siempre el fallo: [calendario/page.tsx](../app/dashboard/calendario/page.tsx#L32), líneas 32–35; [recurrencias/page.tsx](../app/dashboard/recurrencias/page.tsx#L78), líneas 78–79; [metas/page.tsx](../app/dashboard/metas/page.tsx#L103), línea 103. El usuario puede interpretar un fallo como ausencia de datos.

Movimientos y Calendario retornan al no encontrar sesión, sin completar la carga ni redirigir: [movimientos/page.tsx](../app/dashboard/movimientos/page.tsx#L174), líneas 174–177, y [calendario/page.tsx](../app/dashboard/calendario/page.tsx#L13), líneas 13–16. Conviene unificar la gestión de sesión, carga y errores. Las consultas generales tampoco incorporan paginación explícita; deben revisarse antes de que el historial crezca.

### P2: experiencia móvil y presentación pública pendientes

El menú conserva un ancho fijo y posición fija en [Sidebar.tsx](../components/Sidebar.tsx#L35), línea 35. El contenido conserva `ml-64` en [dashboard/layout.tsx](../app/dashboard/layout.tsx#L11), línea 11, independientemente del tamaño de pantalla. El calendario sigue usando siete columnas de contenido reducido. Falta validar y adaptar el uso desde un teléfono.

La portada de plantilla y los controles decorativos deben completarse o aclararse antes de que un evaluador pruebe una demo. El primer recorrido debería explicar el objetivo, permitir entrar con datos ficticios y mostrar con claridad qué hace la aplicación.

## Qué significan «cron», «robot» e «IA» en esta versión

El sincronizador es una función del navegador ejecutada al montar el dashboard. No es un servicio programado independiente: si el usuario no entra, esa función no se ejecuta. Su diseño intenta recuperar fechas atrasadas cuando vuelve a entrar.

`Robot IA` es el texto asignado a `metodo_pago` en [dashboard/page.tsx](../app/dashboard/page.tsx#L133), línea 133. No hay un modelo de inteligencia artificial involucrado en ese algoritmo. El coach financiero aparece como dirección futura en la bitácora, pero no como función implementada. La automatización existente es una aplicación de reglas de fechas e importes.

El desarrollo acordado debe incorporar operaciones pendientes y permitir elegir el registro automático por regla, conservando fecha prevista y fecha real por separado. Ambos modos deben compartir el mismo cálculo de ocurrencias. La creación automática debe ser idempotente, trazable y comprobable, independientemente de que finalmente se dispare desde una visita o desde un programador del servidor. Estas son condiciones del diseño propuesto, todavía ausentes en el flujo actual.

## Validación técnica disponible en esta auditoría

La comprobación `tsc --noEmit --incremental false` falla con tres diagnósticos reportados:

- `TS7034` en [calendario/page.tsx](../app/dashboard/calendario/page.tsx#L100), línea 100.
- `TS7005` en [calendario/page.tsx](../app/dashboard/calendario/page.tsx#L131), línea 131.
- `TS2322` en [dashboard/page.tsx](../app/dashboard/page.tsx#L496), línea 496.

El lint reporta **35 problemas: 26 errores y 9 advertencias**. Esto confirma que las comprobaciones de calidad no están en verde en el estado auditado. Que el servidor de desarrollo muestre pantallas no sustituye estas comprobaciones.

El primer intento de compilación de producción no pudo completarse por la descarga de Google Geist y Geist Mono. Se repitió con acceso de red: **JavaScript compiló, pero TypeScript detuvo el build en `calendario/page.tsx:100`**. No hay un build desplegable verificado. Los comandos, resultados y límites completos están en [VALIDACION.md](VALIDACION.md).

No se ejecutaron pruebas funcionales con una cuenta remota, no se verificaron políticas RLS reales ni se hizo una prueba de escritura sobre datos personales. Los hallazgos funcionales provienen de las rutas del código y del esquema documentado. La aplicación conserva su código original para que los problemas sean revisables.

## Orden recomendado para continuar

1. Proteger el historial: retirar el borrado automático y definir la identidad de ejecución de cada regla recurrente.
2. Versionar el esquema real, sus políticas y restricciones; comprobar separación entre usuarios con datos de prueba.
3. Unificar fechas, frecuencias, inicio, fin, pausas y reactivaciones en un motor de dominio compartido por calendario y ejecución; incorporar pendientes, modo automático por regla y fechas prevista y real separadas.
4. Validar importes y hacer consistentes las operaciones compuestas, los errores y las sesiones.
5. Resolver TypeScript y lint y completar una compilación de producción reproducible.
6. Añadir pruebas del comportamiento financiero: compras idénticas legítimas, varias reglas el mismo día, regla sin categoría, meses cortos, año bisiesto, frecuencia anual, operaciones retroactivas, pausas, Bogotá después de las 19:00 y ejecuciones concurrentes.
7. Completar presupuestos y metas dentro del alcance personal acordado; terminar una interfaz sobria, el uso móvil, exportación y respaldo, con costos bajos y sin relaciones entre cuentas.
8. Preparar el registro propio de evaluadores, una portada propia, documentación de arranque y recorrido de prueba con datos ficticios para el portafolio, verificando el aislamiento respecto a las cuentas personales.

El siguiente hito de producto debería ser un registro personal confiable y recuperable, con cálculos comprobados y una demo aislada. Los módulos adicionales pueden crecer sobre esa base una vez que la integridad y las validaciones sean verificables.
