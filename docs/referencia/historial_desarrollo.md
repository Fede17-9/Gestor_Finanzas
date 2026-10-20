# Historial de Desarrollo - FinanzaPro

Este documento sirve como bitácora paso a paso del proceso de creación de la aplicación "FinanzaPro" utilizando Next.js y Supabase. Aquí se detallan los comandos de consola, scripts de SQL e implementaciones clave.

## FASE 1: Configuración Inicial e Infraestructura de Base de Datos
* **Inicialización:** Se creó el proyecto en Next.js (App Router).
  ```bash
  # Asumiendo el estándar de Next.js:
  npx create-next-app@latest gestor-finanzas
  cd gestor-finanzas
  ```
* **Conexión a Supabase:** 
  - Se instaló el SDK de Supabase para Javascript:
    ```bash
    npm install @supabase/supabase-js
    ```
  - Se configuraron las variables seguras (`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`) en el archivo raíz `.env.local`.
  - Se expuso la conexión creando el cliente en `lib/supabase.ts`.

## FASE 2: Sistema de Autenticación y Cuentas de Usuario
* **Página de Registro (`/registro`):**
  - Se creó el formulario (`app/registro/page.tsx`) enlazado al método de registro de la base de datos: `supabase.auth.signUp()`.
  - Se programó un bloque automático que toma el ID generado e inserta el perfil en una tabla `usuarios` mediante: `supabase.from("usuarios").insert([...])`.
* **Seguridad y Errores Corregidos (RLS en Supabase):**
  - Se configuraron las Políticas de Privacidad (Row Level Security) directamente desde el Editor SQL de Supabase para evitar el error "new row violates row-level security policy":
    ```sql
    -- Hacer editable la tabla
    ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

    -- Política para insertar por código frontend:
    CREATE POLICY "Permitir crear perfil" ON public.usuarios FOR INSERT WITH CHECK (true);
    -- Política para seleccionar datos:
    CREATE POLICY "Usuarios pueden ver su propio perfil" ON public.usuarios FOR SELECT USING (auth.uid() = id_usuario);
    ```
* **Ajustes Prácticos:**
  - Se desactivó temporalmente "Confirm email" (Panel Auth > Providers) para evitar el bloqueo `email rate limit exceeded` durante pruebas de desarrollo.

## FASE 3: Interfaz de Usuario (Dashboard) - ¡EN PROGRESO!
* **Levantar Entorno Local:** El comando principal usado para previsualizar desarrollo:
  ```bash
  npm run dev
  ```
* **Dependencias Visuales:** Se instaló la librería estándar de iconos que se implementan en el menú:
  ```bash
  npm install lucide-react
  ```
* **Estructura de Carpeta (`/dashboard`):**
  - Componente creado: `components/Sidebar.tsx` con su respectivo diseño Tailwind CSS con fondo oscuro `bg-slate-900`.
  - Layout (`app/dashboard/layout.tsx`) diseñado para anclar la barra izquierda y cargar `children` a la derecha.
  - Vista Principal (`app/dashboard/page.tsx`) maquetada con las primeras tarjetas de balances económicos de prueba.
* **Componente de Cabecera (`components/DashboardHeader.tsx`):**
  - Se creó un Header dinámico y estilizado (`DashboardHeader`) para que los usuarios vean su saldo inicial al entrar y un mensaje de bienvenida.
  - Integración del Header en la página principal (`app/dashboard/page.tsx`) sustituyendo el título estático de "Resumen General".

## FASE 4: Login y Conexión en Tiempo Real de Sesiones
* **Página de Login (`/login`):**
  - Creación de ruta `app/login/page.tsx` para iniciar sesión con `supabase.auth.signInWithPassword()`.
  - Se entrelazaron las páginas de _Registro_ y _Login_ mediante `<Link href="...">` para facilitar iteración de usabilidad.
  - Se redirecciona el enrutador (`useRouter`) al flujo protegido (`/dashboard`) cuando la sesión inicia correctamente.
* **Protección del Dashboard y Datos reales:**
  - Se convirtió `app/dashboard/page.tsx` a un Componente de Cliente (`use client`).
  - Se usó `supabase.auth.getSession()` dentro de un `useEffect` para validar que solo usuarios activos entren (si no, redirige a `/login`).
  - El Dashboard ahora consulta la tabla `usuarios` cruzando el `id_usuario` activo para extraer el nombre y moneda verdaderos y rellenar la cabecera del banco en lugar de datos falsos de tutorial.

## FASE 5: Rediseño Estético (Tema Hacker/Neón "Flux")
* **Renovación Visual (UI/UX):** 
  - Se migró toda la aplicación a un tema "Dark Mode" absoluto (`bg-[#000000]`, `bg-[#09090b]`) con acentos de color verde fosforescente o neón (`#39FF14`).
  - Se aplicó esta estética consistente a las pantallas de Registro (`/registro`), Acceso (`/login`), Menú Lateral (`Sidebar.tsx`), y Panel de Control (`/dashboard`).
  - Se incorporaron detalles premium como efectos de "Glow", bordes translúcidos (`backdrop-blur-xl`), tipografías en monoespaciado para estética de terminal financiera, e iconografía modernizada.

## FASE 6: Módulo central de Movimientos y Automatizaciones
* **Página de Movimientos (`/dashboard/movimientos/page.tsx`):**
  - Se estructuró la tabla principal consultando `movimientos` unida a `categorias` para renderizar el historial del flujo de caja (identificadores verdes para ingresos, blancos para egresos, trazabilidad con íconos de rayo ⚡ para las ejecutadas por la máquina).
  - Se corrigió el error de "Sidebar highlight" modificando la lógica de "isActive" para que las subrutas no iluminen el botón principal del Dashboard.
* **Modal Avanzado de "Nuevo Registro" (Integración inteligente DB):**
  - **Categorías Dinámicas:** En lugar de un select estricto, el input de categoría busca coincidencias. Si no existe, realiza de fondo un `INSERT` en la tabla `categorias` y extrae el ID foráneo transparente para el usuario.
  - **Motor de Recurrencias:** Se implementó un toggle que despliega atributos (Frecuencia, Día, Fin). En el Submit, el código inserta la transacción manual (`es_automatico: false`) y graba una regla maestra programada en `config_recurrencias`.
* **Políticas de Seguridad en BBDD (RLS) para el núcleo financiero:**
  - Se ejecutaron sentencias bloqueantes a nivel de SQL:
    ```sql
    ALTER TABLE movimientos ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Seguridad" ON movimientos FOR SELECT/INSERT/UPDATE USING (auth.uid() = id_usuario);
    -- Aplicado replicado idéntico a las tablas 'categorias' y 'config_recurrencias'
    ```
* **Conexión de Métricas Globales (Dashboard Dashboard):**
  - El componente `DashboardPage` ahora ejecuta lógica matemática cruzando TODOS los movimientos del usuario para calcular el "Saldo Total" global.
  - Genera filtros internos de JavaScript para aislar y proyectar el "Ingreso Mensual" y "Gasto Mensual" perteneciente estricta y únicamente al mes calendario en curso.
  - Enruta a los 4 movimientos transados de forma más reciente en el panel dinámico lateral.

## FASE 7: El Calendario Predictivo (Proyección de Automatizaciones)
* **Visualización de Flujo Futuro (`/dashboard/calendario/page.tsx`):**
  - Se construyó un calendario personalizado interactivo (mediante *CSS Grid*) capaz de dibujar la matriz de tiempo del mes en curso y meses paralelos.
  - El componente lee rigurosamente la tabla `config_recurrencias` y filtra sólo la programación activa (`estado_activo: true`).
* **Motor Proyector (La función `mapEventsToDays`):**
  - Se diseñó un algoritmo front-end de mapeo temporal. Cruza la regla (`frecuencia`: Semanal, Diaria, Mensual) y mapea las apariciones matemáticas de ese evento en los días del mes renderizado (evaluando `fecha_inicio` y residuo % 7).
* **Pronósticos Globales:**
  - El Header de la aplicación totaliza (`proyeccionIngresos`, `proyeccionEgresos`) toda la carga económica que la máquina va a procesar en el mes dibujado para entregarle al usuario visibilidad financiera total (Trazabilidad estricta y funcional, la espina dorsal del Coach Financiero).

## FASE 8: Refinamiento de Carga Visual, Zonas Horarias y Fusiones Sensoriales
* **Auditoría de Fechas (UTC Shift) e Input Retroactivo:**
  - Corrección global del clásico fallo de la Zona Horaria (donde fechas caían un día antes por resta de horas GMT). Se implementó parsing puro de tipo de dato string `YYYY-MM-DD` a nivel Javascript asegurando precisión estricta de tiempo en el Dashboard, Calendario y lista de Movimientos.
  - Modificación del UX en `Nuevo Registro` para permitir inyección de información retroactiva manual (así los usuarios pueden auditar lo sucedido en días pasados).
* **Algoritmo de 'Fusión Inteligente' e Identidad de Semilla Automática:**
  - El modal de creación ahora le pasa inteligentemente el flag *Automático* a la semilla origen si el usuario activó la casilla `Automatizar Operación`.
  - El Calendario renderiza y mapea ambas colecciones: reales vs proyectados.
  - Para corregir duplicados visuales en la matriz matemática, se programó un sistema de intersección. Cuando un registro Real Humano (`isReal: true`) choca el mismo día en la misma categoría con una Proyección (`isReal: false`), esta última es ocultada y su naturaleza transaccional es "heredada" (*Identity Transfer*) al estático. Los headers (`Caja Estática` vs `Flujo Máquina`) lo leen en tiempo real y ajustan la matemática evitando desastres contables.

## FASE 9: Analítica Visual Interactiva y Robot Automatizador (Cron)
* **Gráficos Dinámicos con Recharts:**
  - Se reconstruyó la sección principal del Dashboard para desplegar un `AreaChart` responsivo de **Rendimiento Operativo**. Analiza el diferencial entre ingresos (áreas neón) y egresos (áreas rojas carmesí) cruzando el historial contable agrupándolo por día base de un mes determinado.
  - Selectores dinámicos permiten consultar el flujo retrospectivo con hasta 6 meses de antelación sin requerir recargar la aplicación (Reactivo).
* **Motor Cron de Evaluación Perezosa (Lazy Sync Engine):**
  - Creación un "Robot de Sincronización" que se despiera al montar los Dashboards. Verifica `config_recurrencias`, extrapola matemáticamente qué fechas pasadas debieron ejecutarse, cursa contra `movimientos`, e inyecta silenciosamente en DB los `INSERT` de la máquina.
  - Asegurado contra condiciones de carrera de React (Strict Mode) a través de llaves de asincronismo en `useRef` garantizando un único pulso de ejecución segura.
* **Deduplicación Recursiva (*Reduce / Merge*):**
  - Se potenció el motor de visualización (Calendario Extendido) agrupando registros reales por firma hash (`categoria + monto_recurrente`). Proyecta *sets in-order* blindándolo contra cualquier probabilidad de desborde de RAM o dupleta en front-end si llegase a existir basuras temporales en los inserts robóticos, reparando el panel matemáticamente de forma definitiva.

