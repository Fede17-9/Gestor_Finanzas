# Plan de desarrollo hasta la versión 1.0

Referencia: **20 de octubre de 2026**. Este documento describe trabajo pendiente, no funciones ya construidas.

## Decisiones acordadas

- Primera versión: ingresos, gastos, recurrencias, calendario, presupuestos y metas de ahorro.
- Uso inicial personal y familiar, pero **cada usuario con sus datos privados, sin relaciones ni finanzas compartidas entre usuarios**.
- Un evaluador podrá registrarse y crear su cuenta propia.
- Presupuesto bajo: priorizar cuotas gratuitas, pocos servicios externos y mantenimiento sencillo.
- Apariencia profesional y sobria; el tema oscuro/neón actual puede cambiar.
- Referencia: [PliP](https://plip.co/), sobre todo categorías, presupuestos y reportes. Su carga automática de facturas/correo es una posible ampliación, no un requisito implícito del MVP.
- Recurrencias con confirmación manual o registro automático configurable; una obligación puede seguir pendiente después de su fecha prevista si el pago real se retrasa.

No se ha fijado dedicación semanal ni fecha de entrega. Las estimaciones son orientativas e incluyen desarrollo y validación; deben revisarse al conocer el esquema remoto.

## Qué significa terminar

La versión 1.0 permite registrarse, configurar moneda, registrar operaciones, consultar cifras consistentes, planificar pagos sin confundirlos con dinero ya gastado, controlar presupuestos, seguir metas y exportar información. Funciona en teléfono y mantiene aislados los datos de cada usuario. Su instalación, publicación y recuperación son reproducibles.

No hace falta alcanzar todas las capacidades de PliP ni abrir registro masivo para terminar esta primera versión. El crecimiento global se evalúa después de una beta estable.

## Etapa 0. Base de trabajo ordenada

**Esfuerzo: 3–6 horas.**

- Guardar los cambios de formato existentes por separado.
- Versionar documentación, ejemplo de variables y reglas de edición/finales de línea.
- Conservar historia Git; usar ramas pequeñas en adelante.
- Registrar checks fallidos sin esconder errores ni desactivar reglas para simular éxito.

**Criterio de salida:** árbol limpio mediante commits revisados y bloqueos documentados. La auditoría prepara documentación/higiene inicial; log y status indican qué quedó efectivamente guardado.

## Etapa 1. Integridad del dinero y compilación

**Esfuerzo: 12–20 horas. Prioridad inmediata.**

1. Retirar el borrado automático de supuestos duplicados al cargar el dashboard. Investigar posibles pérdidas antiguas solo contra respaldo; no reconstruir movimientos por coincidencias de categoría/importe.
2. Separar lectura de reportes de creación/eliminación automática de movimientos.
3. Corregir TypeScript y los 26 errores actuales de lint; extraer componentes declarados durante render, tipos del dominio y cálculos puros.
4. Unificar validación de importes positivos, límites y redondeo en interfaz y Postgres. Definir precisión decimal y evitar comparaciones financieras ambiguas con floats.
5. Usar fecha civil para operaciones diarias y zona `America/Bogota` como propuesta inicial. Evitar que el «hoy» cambie a las 19:00 por usar UTC.
6. Saldo real calculado con movimientos registrados; pendientes y proyección separados. Una moneda por usuario inicialmente: cambiar etiqueta no convierte importes históricos.
7. Paginar listados y consultar por intervalos/agrupaciones. Pedir todos los movimientos no garantiza recibir todo el historial si la API limita resultados.

**Pruebas:** dos gastos iguales legítimos; ingreso/egreso misma categoría; montos cero/negativos; mes/año; horario nocturno de Bogotá; historial mayor al límite por respuesta de la API.

**Salida:** lint, tipos y build pasan; abrir reportes no modifica contabilidad; cifras contrastadas con datos de resultado conocido.

**PR sugeridas:** `fix: retirar borrado automatico de movimientos`, `fix: corregir tipos y componentes del dashboard`, `fix: unificar fechas e importes`.

## Etapa 2. Base reproducible y acceso privado

**Esfuerzo: 10–18 horas.**

1. Inspeccionar el esquema real de Supabase en una tarea sobre ese entorno, compararlo con el TXT y respaldarlo antes de migrar.
2. Versionar migraciones, índices, restricciones y datos iniciales. Los archivos históricos no son migraciones seguras.
3. Generar tipos TypeScript desde el esquema y sustituir `any`.
4. Crear perfiles consistentemente y con correo confirmado; evitar cuentas Auth sin perfil cuando falla el segundo INSERT.
5. RLS por propietario para SELECT/INSERT/UPDATE/DELETE y validación de pertenencia de categorías/referencias. El filtro en React no protege una petición directa a la API.
6. Centralizar sesión, redirección y expiración; no dejar carga infinita sin sesión.
7. Confirmación de correo, recuperación de contraseña, errores útiles y protección contra registros abusivos.
8. Incorporar CI con instalación reproducible, lint, tipos, pruebas de dominio y build usando configuración de pruebas.

**Pruebas:** A no puede leer ni modificar datos de B por API; invitado no accede; referencias ajenas se rechazan; registro/confirmación/recuperación completos; reconstrucción de base de pruebas desde cero.

**Salida:** permisos demostrados con dos usuarios, instalación reproducible y checks exigidos para integrar cambios.

## Etapa 3. Recurrencias pendientes y calendario consistente

**Esfuerzo: 18–30 horas.**

Una regla expresa una intención; una ocurrencia es el pago/cobro previsto de un día; un movimiento es un hecho registrado. Esta separación es el cambio central del modelo.

### Modelo propuesto

- `config_recurrencias`: propietario, importe esperado, frecuencia, vigencia, modo de confirmación y política de pausa.
- Nueva `ocurrencias_recurrencia`: regla, fecha prevista, importe esperado, estado, fecha reprogramada opcional y movimiento confirmado.
- Clave única por **regla y fecha prevista**, para resistir reintentos y dos procesos concurrentes.
- `movimientos`: importe/fecha reales y enlace opcional único a la ocurrencia; conservar hechos aunque se archive una regla.
- Estados: pendiente, confirmada y omitida. «Vencida» se deriva de fecha/estado; reprogramar conserva fecha prevista original y nueva fecha de seguimiento.

Son propuestas de diseño, no SQL listo para ejecutar. El historial sin enlace necesita reconciliación revisada; no puede asociarse con seguridad solo por categoría y fecha.

### Funcionamiento

1. Por defecto, vencer genera un pendiente; no reduce el saldo real.
2. Confirmar permite cambiar fecha real e importe. Crear movimiento y confirmar ocurrencia es una transacción atómica.
3. Cada regla puede optar por registro automático. La interfaz explica que se anotará como realizado y permite corregir esa confirmación; si el hecho se retrasa, puede volver a pendiente con trazabilidad.
4. Una demora no borra el pendiente ni cambia silenciosamente la fecha prevista. Se puede reprogramar u omitir explícitamente.
5. Propuesta de pausa: omitir nuevas ocurrencias durante el intervalo pausado; reactivar no rellena ese intervalo por defecto. Mostrar esa política claramente.
6. Cambios de importe/frecuencia afectan el futuro; no reescriben movimientos confirmados. Guardar instantáneas o versiones cuando corresponda.
7. Definir fin de mes 28/29/30/31, inicio/fin, anclaje semanal y política anual para 29 de febrero.

Un mismo motor calcula calendario y ejecuciones. La operación de servidor es transaccional e idempotente. Programar la generación con Supabase Cron; un botón manual puede invocar la misma función validada. Montar un componente React no será el disparador contable.

El motor comparte reglas, pero sus permisos distinguen ejecución global y manual: solo el scheduler puede procesar todos los usuarios; una llamada desde el navegador se limita al propietario autenticado mediante `auth.uid()`. Revisar permisos `EXECUTE`, uso de `SECURITY DEFINER` y `search_path` seguro. Probar que A no puede generar, confirmar ni alterar ocurrencias de B por RPC. [Funciones de base de datos](https://supabase.com/docs/guides/database/functions).

**Pruebas:** dos reglas misma categoría/día; sin categoría; concurrencia; reintentos; inicio/fin; bisiesto; pausa; pago demorado; importe variable; devolver a pendiente; archivar regla con historial.

**Salida:** reejecutar no duplica; pendientes no alteran saldo real; calendario y reportes concuerdan; ninguna deduplicación elimina movimientos válidos.

## Etapa 4. Completar las funciones del MVP

**Esfuerzo: 18–30 horas.**

### Movimientos y categorías

Filtros por mes/tipo/categoría, paginación, edición coherente, categorías editables/archivables y errores visibles. Ingresos/egresos son el alcance principal; inversiones/transferencias requieren cuentas y se posponen.

### Presupuestos

Pantalla mensual por categoría y total: límite, gasto real, disponible, porcentaje y aviso dentro de la app al alcanzar umbral. Restricción única usuario/categoría/mes/año. Proyección pendiente aparte del gasto confirmado. Copiar presupuesto del mes anterior es una mejora pequeña y útil.

### Metas

Historial de aportes/retiros en lugar de solo sobrescribir un saldo. Definir si un aporte asigna dinero a una meta o registra una operación real, evitando descontar dos veces. Propuesta MVP: asignación de ahorro con historial propio, sin inventar un gasto ni incrementar el saldo; explicarlo en la interfaz.

### Respaldo del usuario

Exportación CSV de movimientos y exportación completa de datos propios. Importación CSV después del primer lanzamiento, con previsualización/validación antes de escribir. Ensayar exportación y restauración técnica en pruebas.

**Salida:** completar un mes ficticio con presupuesto, pago pendiente/confirmado y aportes a meta; comparar resultados conocidos y exportar todos los datos propios.

## Etapa 5. Diseño profesional y móvil

**Esfuerzo: 12–22 horas.**

- Definir nombre; no es requisito para corregir lo urgente.
- Propuesta: superficies claras/neutras, tipografía legible, acento azul o verde moderado, modo oscuro opcional. Validar una pantalla con el propietario antes de extenderla.
- Menú móvil, formularios sin ancho fijo de sidebar y agenda alternativa al calendario en pantallas pequeñas.
- Lenguaje cotidiano: Gastos, Próximos pagos, Disponible; sustituir etiquetas de terminal que dificultan entender el producto.
- Accesibilidad: labels, teclado, foco, contraste, tamaños táctiles y estados distinguibles sin depender solo de color.
- Inicio `/` útil, metadatos reales, `lang="es"` y estados de carga/error/vacío.
- Onboarding con moneda, categorías y primer movimiento; datos ficticios solo para quien los solicite.
- Retirar tarjetas/campanas decorativas hasta tener una función real.

**Salida:** tareas principales probadas a 360 px y escritorio, navegación por teclado y cifras comprensibles. La profesionalidad depende de claridad y consistencia además del color.

## Etapa 6. Beta y publicación para evaluadores

**Esfuerzo: 10–18 horas más observación de uso.**

1. Beta para propietario/familia con cuentas independientes tras resolver integridad y seguridad.
2. Observar varios ciclos de pagos y corregir fricción; compilar no demuestra estabilidad.
3. Entorno de evaluación separado de datos reales: registro propio y cuenta vacía o semilla ficticia optativa.
4. README, arquitectura, decisiones, instalación, checks y límites; capturas sin datos privados y video breve como respaldo.
5. Elegir licencia y publicar enlace en GitHub cuando esté listo.
6. Probar restauración, límites/costos y procedimiento de despliegue/reversión.

**Salida:** un tercero entiende el repo, lo ejecuta y se registra en la publicación; ninguna prueba pública se conecta a finanzas personales.

## Esfuerzo y dependencias

Estimación inicial: **83–144 horas**, más observación de beta. A 5 horas/semana serían aproximadamente 17–29 semanas; a 10 horas, 9–15 semanas. No hay fecha comprometida. Revisar tras estabilizar recurrencias y conocer la base remota; aprendizaje/SMTP pueden añadir trabajo.

Integridad y compilación → esquema/permisos/Auth → recurrencias → presupuestos/metas → móvil → beta/evaluación. Se puede diseñar pantallas en paralelo, respetando los criterios técnicos de salida.

## Posponer para controlar costo y alcance

- Bancos, lectura de Gmail/Outlook y extracción automática de facturas.
- IA/coach, OCR y clasificación con servicios de pago.
- Apps nativas: primero web responsive; PWA instalable puede venir después.
- Multimoneda con conversión, inversiones, tarjetas, deudas y transferencias entre cuentas.
- Relaciones/colaboración entre usuarios: expresamente fuera del producto solicitado.
- Registro masivo, cobros y suscripciones: solo tras beta estable.

PliP es referencia de organización y facilidad; no se presupone replicar su marca ni infraestructura.
