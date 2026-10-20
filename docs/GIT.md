# Guía de Git

Esta guía propone un flujo sencillo para mantener ordenado este proyecto personal y facilitar su revisión en GitHub. Ejecuta los comandos desde la carpeta `gestor-finanzas`, donde está `.git`.

## Punto de partida: auditoría del 20 de octubre de 2026

- Repositorio remoto: <https://github.com/Fede17-9/Gestor_Finanzas>.
- Rama local: `main`, en el commit `cac89c4`, con 11 commits en su historia.
- `main` estaba 0 commits por delante y 0 por detrás de la referencia local `origin/main`. No se ejecutó `fetch`: ese dato no garantiza que GitHub no tuviera cambios nuevos.
- Había modificaciones locales en `app/dashboard/calendario/page.tsx` y `app/dashboard/movimientos/page.tsx`. La revisión mostró cambios de formato, sin cambios de lógica observados. No había cambios preparados para commit ni archivos sin seguimiento.
- `.env.local`, `node_modules`, `.next` y `next-env.d.ts` estaban ignorados. No se leyeron los valores de las variables de entorno.
- `base_de_datos.txt` e `historial_desarrollo.md` estaban en la carpeta superior, fuera del repositorio. Por tanto, no se incluían en los commits ni se enviaban a GitHub.
- No había un flujo de CI versionado. El README seguía siendo la plantilla de Next.js.

Este apartado es una fotografía inicial, no el estado actual del repositorio. Compruébalo siempre con `git status`.

## Un cambio y un propósito por commit

Un commit debe poder explicarse en una frase: corregir un cálculo, añadir una función, documentar una instalación o aplicar formato. Evita mezclar cambios de comportamiento con una reformateada general.

Usa mensajes breves y específicos:

- `feat: añadir filtro de movimientos por cuenta`
- `fix: evitar duplicados al confirmar una recurrencia`
- `docs: documentar la instalación local`
- `style: unificar formato de calendario y movimientos`
- `chore: configurar la integración continua`

Antes de guardar un commit, verifica que incluye todo lo necesario para ese propósito y ningún cambio ajeno. Incluye `package-lock.json` cuando cambien las dependencias de `package.json`.

## Flujo de trabajo en PowerShell

Primero inspecciona el estado y el contenido pendiente:

```powershell
git status --short --branch
git diff --stat
git diff
git diff --check
```

Si ya hay cambios propios en curso, revísalos y consérvalos antes de actualizar ramas o iniciar otra tarea. Los cambios iniciales de calendario y movimientos merecen una revisión y un commit de formato independiente.

Con el árbol de trabajo limpio, actualiza `main` y crea una rama para la tarea. Estos comandos acceden a GitHub:

```powershell
git switch main
git fetch origin
git log --oneline --left-right main...origin/main
git merge --ff-only origin/main
git switch -c feature/filtro-por-cuenta
```

`--ff-only` detiene la actualización si las historias divergen. Si ocurre, revisa los commits antes de decidir cómo integrarlos; no fuerces la actualización.

Elige un nombre de rama según el propósito:

- `feature/<tema>` para funciones nuevas.
- `fix/<tema>` para correcciones.
- `chore/<tema>` para mantenimiento, documentación y herramientas.

Después de implementar y verificar un cambio, prepara únicamente los archivos correspondientes. Este es un ejemplo para los dos archivos de formato detectados en la auditoría; comprueba su contenido actual antes de usarlo:

```powershell
git add -- app/dashboard/calendario/page.tsx app/dashboard/movimientos/page.tsx
git diff --cached --stat
git diff --cached
git diff --cached --check
git status --short
git commit -m "style: unificar formato de calendario y movimientos"
git status --short --branch
```

Evita `git add .`: preparar rutas explícitas facilita detectar archivos accidentales. Si un archivo contiene cambios de distintos propósitos, usa `git add -p -- ruta/del/archivo` para revisar y seleccionar fragmentos.

Si preparaste un archivo por error, quítalo del área de preparación conservando su contenido local:

```powershell
git restore --staged -- ruta/del/archivo
```

No uses `git reset --hard`, `git clean` ni restauraciones del contenido del árbol de trabajo como rutina de limpieza. Un árbol limpio se obtiene guardando cambios revisados, no borrando trabajo pendiente.

## Pull requests y validación

Publica la rama cuando el cambio esté listo para revisión:

```powershell
git push -u origin feature/filtro-por-cuenta
```

Abre una pull request hacia `main` con una descripción del problema, el resultado y las comprobaciones realizadas. Para cambios visuales, añade una captura; para cálculos o recurrencias, describe los casos comprobados. Incluso trabajando solo, la pull request deja una revisión legible para futuros evaluadores.

Cuando se resuelvan los errores existentes, configura CI para ejecutar lint, comprobación de TypeScript y build. Añade pruebas para los cálculos y los flujos críticos a medida que se implementen. Usa los comandos que declare el proyecto y no marques una comprobación como exitosa si todavía falla.

Después de estabilizar esas comprobaciones, configúralas como requisito para integrar pull requests y protege `main`. Un squash merge puede agrupar los commits de una tarea en un único commit claro. Revisa su título antes de integrar.

No hagas force push ni reescribas los commits publicados para mejorar su apariencia. La historia existente sirve como registro del desarrollo; las mejoras pueden introducirse en commits nuevos.

## Finales de línea y formato

En la auditoría, `core.autocrlf` estaba activado y Git avisaba de conversiones LF a CRLF. El repositorio ahora incluye `.gitattributes` con una política LF y `.editorconfig` para que los editores apliquen criterios consistentes. La incorporación de estas reglas no equivale a haber normalizado todos los archivos existentes.

Una normalización de archivos existentes debe hacerse después de guardar los cambios funcionales y en un commit separado. Con el árbol limpio y `.gitattributes` revisado, se puede normalizar una lista explícita de archivos de texto:

```powershell
git add --renormalize -- app/dashboard/calendario/page.tsx app/dashboard/movimientos/page.tsx
git diff --cached --stat
git diff --cached
git diff --cached --check
```

Estos comandos preparan cambios: revísalos antes de confirmar. No normalices todo el repositorio a la vez sin revisar las rutas afectadas. Si no hay diferencias, no hace falta un commit vacío. No cambies la configuración global de Git para resolver una decisión propia de este repositorio.

## Documentación y variables de entorno

El repositorio ahora incluye un README específico, documentación dentro de `docs/` y un `.env.example` con nombres de variables y campos vacíos, sin credenciales reales. `.gitignore` mantiene ignorados los archivos `.env*` y contiene una excepción explícita para poder versionar `.env.example`. Los nuevos archivos deben revisarse y guardarse en commits por propósito; su presencia en disco no implica que ya estén publicados en GitHub.

Comprueba el seguimiento y las reglas sin mostrar el contenido de las variables:

```powershell
git check-ignore -v .env.local
git ls-files -- '.env*'
git status --short --untracked-files=all
```

Si `.env.example` aparece en `git ls-files`, debe contener únicamente datos de ejemplo. Mantén las credenciales de despliegue en la configuración del proveedor y los valores locales en archivos ignorados. No incluyas datos financieros personales en documentación, capturas o datos de demostración públicos.

## Revisión antes de terminar una tarea

Comprueba que el commit explica un solo propósito, que las verificaciones pertinentes pasaron y que el diff preparado no incluye secretos, archivos generados ni trabajo ajeno. Tras el commit, ejecuta `git status --short --branch` y revisa si quedan cambios locales o commits por publicar. No hace falta que cada sesión termine con un push: sí debe quedar claro qué se guardó y qué continúa pendiente.
