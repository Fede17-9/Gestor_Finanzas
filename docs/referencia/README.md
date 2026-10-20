# Referencias históricas

Estos archivos son copias de los documentos que estaban en la carpeta superior, fuera del repositorio, al comenzar la revisión del 20 de octubre de 2026. Los originales se conservan.

Se preservan sus bytes originales, incluidos finales de línea y espacios históricos. `.gitattributes` limita a estos dos archivos la excepción de normalización y revisión de espacios; los documentos actuales y el código mantienen la política habitual.

- `base_de_datos.txt`: diseño de siete tablas y datos iniciales de tipos de movimiento. No representa una extracción verificada del proyecto remoto y no incluye todas las políticas RLS.
- `historial_desarrollo.md`: bitácora original hasta la fase 9. Hay funciones posteriores en el código y afirmaciones sobre seguridad, zonas horarias y deduplicación que requieren corrección; consultar el diagnóstico actual.

No ejecutar estos archivos como migraciones. La bitácora incluye una política de perfil con `WITH CHECK (true)` y una abreviación `FOR SELECT/INSERT/UPDATE` que no es una sentencia PostgreSQL válida. Las políticas definitivas deben limitar acceso por propietario y estar versionadas y probadas.
