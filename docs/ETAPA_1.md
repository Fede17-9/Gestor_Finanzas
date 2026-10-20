# Primera entrega: integridad y compilación

Fecha: **20 de octubre de 2026**. Supabase ya era y sigue siendo el backend de este proyecto. Esta entrega modifica la aplicación conectada a ese servicio; no crea otro backend ni cambia sus datos remotos.

## Cambios implementados

- Dashboard y calendario usan un lector financiero sin métodos de escritura. Montar estas pantallas no borra supuestos duplicados ni crea movimientos atrasados.
- Se retira la sincronización anterior desde React. El registro automático queda temporalmente desactivado y explicado en dashboard, calendario, reglas y formulario de movimientos.
- El calendario conserva movimientos distintos aunque coincidan categoría, importe y fecha; muestra operaciones registradas y programación estimada por separado.
- Las proyecciones comparten reglas puras para Diario/Semanal/Mensual/Anual; respetan inicio y fin inclusivos, último día válido del mes y aniversario del 29 de febrero al 28 en años comunes. Pausar una regla la excluye de proyecciones.
- Totales en centavos enteros con validación de precisión/rango. Los formularios rechazan negativos, cero donde no corresponde, más de dos decimales, notación científica e importes fuera de `numeric(15,2)`.
- La fecha «hoy» usa `America/Bogota`. Los registros históricos conservan el día escrito en `fecha_operacion`; no se reinterpretan ni actualizan timestamps remotos.
- El formulario de movimientos permite confirmar operaciones hasta hoy. Una regla nueva toma como inicio la fecha elegida, en vez de la fecha UTC del navegador.
- Crear una regla junto a un movimiento no convierte el movimiento manual en automático. Se evita repetir el envío mientras la solicitud está en curso y se informa si el movimiento se guardó pero falló su regla.
- Los listados financieros se consultan en páginas con orden estable y filtro de propietario. Un fallo de página impide presentar cifras parciales; no se trunca silenciosamente en el primer límite de respuesta.
- Un formato común identifica COP/USD/EUR. Se bloquea el cambio de moneda en Configuración para impedir que se reetiquete el historial sin conversión; sigue eligiéndose en Registro.
- Se sustituyen los componentes de gráficos definidos dentro de render, tipos `any` y efectos de estado derivado; se corrigen advertencias de imágenes/imports sin desactivar reglas de lint.
- Node 24.x queda declarado en `engines` y `.nvmrc`. Scripts: `test`, `typecheck`, `lint`, `build`. Las pruebas usan el runner nativo de Node y no añaden dependencias.

## Verificación

- `npm test`: **22 pruebas aprobadas**.
- `npm run typecheck`: aprobado.
- `npm run lint`: aprobado, sin errores ni advertencias.
- `npm run build`: aprobado con acceso de red para las fuentes Geist.
- Servidor de producción local: las nueve rutas existentes respondieron HTTP 200 con HTML. Esto comprueba arranque y rutas; no sustituye una sesión autenticada ni una revisión visual.
- `git diff --check`: aprobado.

Las pruebas cubren gastos iguales legítimos, ingreso/egreso que comparten categoría/día, decimales, montos inválidos, tipos contables del catálogo inicial, fecha nocturna de Bogotá, cambio de año, años bisiestos, vigencia/frecuencias, reglas sin categoría, separación registrado/proyectado, 1.205 filas con páginas limitadas, fallos de carga e identidad de filas.

El SDK real de Supabase se prueba con transporte HTTP simulado: consultas GET, filtro de propietario y paginación. No se usan credenciales reales ni se envían solicitudes a la base remota. Los lectores no ocultan un perfil cuya moneda sea inválida bajo una moneda supuesta.

## Límites que siguen abiertos

1. **Supabase remoto:** no se han certificado ni cambiado esquema, RLS, índices o restricciones. El rechazo de importes está en la aplicación; debe reforzarse en PostgreSQL durante la etapa 2.
2. **Recurrencias nuevas:** todavía no existen ocurrencias pendientes persistidas ni confirmación automática/manual por regla. Esa función corresponde al modelo de la etapa 3. Mientras tanto, el usuario registra el hecho cuando ocurre.
3. **Historial legado:** no se reconstruyen movimientos que pudieran haberse borrado antes. Las proyecciones pueden incluir reglas ya pagadas: se indican como programación estimada y no se suman al saldo. No se puede conciliar con certeza sin un vínculo movimiento–ocurrencia.
4. **Pausas:** en esta entrega solo afectan la visualización de reglas activas. No se persisten intervalos de pausa ni se regeneran movimientos al reactivar.
5. **Saldo:** conserva la semántica del historial completo registrado. Los formularios impiden nuevas operaciones confirmadas con fecha futura; no se reescriben fechas antiguas que ya estén en la base.
6. **Lecturas concurrentes:** la paginación reduce truncamiento y detecta IDs repetidos durante una carga, pero no es una transacción de snapshot. Si otro dispositivo modifica el historial mientras se consulta, se debe refrescar; una garantía transaccional requiere consultas del servidor en una etapa posterior.
7. **Operaciones compuestas:** crear categoría, movimiento y regla aún son solicitudes independientes. Se informa un resultado parcial para evitar repetir el movimiento; la atomicidad debe resolverse con el esquema/funciones de base de datos.
8. **Pruebas remotas y visuales:** falta verificar una sesión real, RLS A/B, registro/recuperación, envíos de formularios contra pruebas y diseño móvil. Los 200 HTTP no demuestran seguridad de rutas; la protección de datos requiere RLS.

Por esos límites, esta entrega no equivale a producción certificada ni a la finalización de las seis etapas. El siguiente bloque es inspeccionar y versionar la configuración real de Supabase, con respaldo antes de migrar.
