# BIO-ACTA: cambios y propuestas de implementación

Este documento enumera las propuestas descritas en el análisis de BIO-ACTA y registra el estado actual de su implementación. ✅ indica que la funcionalidad base de la propuesta está implementada; 🟡 indica que aún falta una parte central de ese flujo. Las mejoras futuras y limitaciones fuera del alcance base se indican en la descripción.

1. **Crear una identidad digital permanente para cada animal. — ✅ Desarrollado.** Registro gratuito autenticado con UUID interno y código público aleatorio, datos descriptivos, identificadores privados y fotos. Las fotos pueden añadirse al expediente después del alta. La transferencia conserva la identidad y la historia.

2. **Permitir registros provisionales. — ✅ Desarrollado.** El alta permite marcar una identidad provisional. Un reporte de encontrado no concede propiedad ni custodia; quien reporta queda como remitente, no como propietario legal.

3. **Añadir consulta pública mediante QR. — ✅ Desarrollado.** El responsable habilita explícitamente la vista pública; el QR apunta al código aleatorio y muestra campos limitados, fotos autorizadas y solo un resumen sanitario certificado. No requiere cuenta.

4. **Incorporar biografía sanitaria y cuidados. — ✅ Desarrollado (funcionalidad base).** Los eventos declarados admiten detalles estructurados de producto, dosis, lote y próxima fecha indicada. Las programaciones admiten intervalos de 12 horas, día, semana, mes, una sola vez o intervalo personalizado; al registrar una dosis administrada u omitida, el servidor avanza la próxima fecha y conserva autoría e historial. El backend genera recordatorios persistentes en el centro de notificaciones cuando vencen los cuidados. Los documentos clínicos y las alertas push que avisen con la aplicación cerrada quedan como mejoras pendientes.

5. **Diferenciar información declarada y certificada. — 🟡 Parcial.** Las altas de cuidadores se guardan como declaradas y no certificadas. La verificación de profesionales y la certificación de registros no están habilitadas.

6. **Añadir reportes de animales perdidos o encontrados. — ✅ Desarrollado (flujo asociado a cuenta).** Se pueden crear y consultar reportes abiertos; las cuentas asociadas pueden gestionar estados y mantener conversaciones privadas dentro de la aplicación. Los mensajes nuevos generan una notificación interna para la cuenta receptora. Se ocultan los datos de contacto y se limitan reportes y mensajes. Los reportes anónimos no tienen una cuenta/bandeja para recibir mensajes ni administrar su estado; las notificaciones son internas y no llegan como push al dispositivo.

7. **Gestionar cuidadores, permisos y transferencias. — ✅ Desarrollado (base).** Se pueden conceder/revocar permisos con vencimiento y transferir custodia mediante aceptación. Se conserva el historial y se revocan accesos previos al aceptar. Invitaciones/avisos y roles profesionales verificados quedan pendientes.

8. **Crear las rutas y pantallas propuestas. — ✅ Desarrollado (frontend).** Se añadieron módulos de BIO-ACTA para resumen, salud, cuidados, reportes, accesos, custodia, QR, profesional y administración, además de la consulta pública y enlaces desde el expediente. Los formularios distinguen entre un fallo del guardado y un fallo al actualizar la lista después de guardar.

9. **Definir un flujo para crear la Bio-Acta. — ✅ Desarrollado (flujo base).** El alta busca coincidencias exactas normalizadas (sin distinguir mayúsculas ni espacios externos) y permite revisar fichas públicas. Ante cualquier posible coincidencia, solo permite continuar con una identidad provisional. Las coincidencias privadas por identificador no revelan datos. La búsqueda aproximada, la verificación humana y la integración/fusión segura de duplicados quedan como mejoras pendientes.

10. **Diseñar un modelo de datos inicial. — ✅ Desarrollado (modelo base).** Se añadieron animales, fotos, identificadores, custodia/transferencias, eventos sanitarios con detalles estructurados, cuidados recurrentes/dosis, reportes/conversaciones privadas, permisos y auditoría. La separación en entidades clínicas especializadas y la gestión de documentos clínicos quedan para una extensión posterior del modelo.

11. **Adoptar una arquitectura técnica modular. — 🟡 Parcial.** Frontend Vue 3/Vite con manifiesto instalable y caché offline limitada a la app shell, API REST, Express, MySQL, autenticación, permisos, auditoría, fotos privadas, QR y notificaciones internas de reportes/cuidados están conectados. Los datos privados y la API no se almacenan offline. Push web y política probada de respaldo/recuperación siguen pendientes.

12. **Organizar el MVP por prioridades. — 🟡 Parcial.**
    - **P0 — Imprescindible:** registro e identidad, QR público, panel, expediente e historial y permisos básicos.
    - **P1 — Siguiente etapa:** medicamentos, recordatorios, registro de dosis, reportes y transferencias.
    - **P2 — Funciones profesionales:** roles para veterinarios y refugios, registros certificados, documentos y gestión de varios animales.
    - **P3 — Investigación e integración:** búsqueda biométrica e interoperabilidad con sistemas externos e instituciones.

13. **Establecer criterios de seguridad y aceptación. — 🟡 Parcial.** Hay validación de entradas, autorización en el servidor, visibilidad pública explícita, registros no certificados por defecto, auditoría, idempotencia de recordatorios y pruebas de contratos/recurrencias. Los contactos de reportes requieren cuenta y se limitan por IP en memoria local; una instalación con varias instancias requiere almacenamiento compartido para esos límites. Faltan pruebas de integración con MySQL, respaldos/recuperación y pruebas de seguridad operativas.

14. **Considerar las limitaciones técnicas. — 🟡 Parcial.** La app shell instalable ofrece una base offline sin cachear la API ni datos privados. Las notificaciones de cuidados se guardan en el centro interno desde el servidor, pero no son push ni garantizan aviso inmediato en el dispositivo. Aún se debe validar instalación/offline en dispositivos reales; la biometría permanece fuera del alcance.

15. **Definir la sostenibilidad y los límites jurídicos. — 🟡 Parcial.** Se muestran límites de privacidad y el carácter de registro privado digital. La sostenibilidad y las hipótesis comerciales no se han validado; cualquier alianza, integración o efecto jurídico requiere revisión especializada.

16. **Seguir una secuencia de trabajo sugerida. — 🟡 Parcial.** Se implementó el núcleo de identidad, consulta, panel, salud/cuidados básicos y custodia. La definición formal de historias, piloto, pruebas operativas y escalamiento siguen pendientes.
    1. Definir historias de usuario, permisos, prototipos y criterios de aceptación.
    2. Construir el núcleo: API, base de datos, autenticación y alta de animales.
    3. Implementar la consulta pública y el QR con visibilidad controlada.
    4. Crear el panel, el expediente, la línea de vida y la auditoría.
    5. Añadir cuidados, programación de dosis y pruebas de notificaciones.
    6. Validar con un piloto, pruebas de seguridad, respaldos y ajustes.
    7. Evaluar el escalamiento a profesionales, refugios, biometría e integración institucional según su viabilidad.

**Objetivo de la primera versión:** identificar al animal, consultar su identidad mediante QR con privacidad, conservar su historia sanitaria y mantenerla cuando cambia de cuidador.

## Estado de implementación verificado

Las funciones marcadas ✅ o 🟡 ya tienen implementación de frontend y persistencia de servidor cuando se indica. Las rutas profesionales muestran una respuesta `501` explícita; no inventan verificación ni certificaciones. Ejecuta `npm run init:db` en `backend` antes de usar las tablas y columnas nuevas en una base existente. En producción, la shell offline se activa después de la primera carga online y nunca guarda respuestas `/api`.

**Validación realizada:** compilación de producción `vue-tsc` + Vite; 19 pruebas del backend aprobadas; verificación sintáctica de los archivos backend modificados. No se ejecutó la migración de MySQL ni una prueba de integración porque modificaría la base conectada al entorno.

**Pendientes principales:** certificación y alta profesional; administración/contacto de reportes anónimos; push al dispositivo y pruebas de la PWA en dispositivos; documentos clínicos y mayor especialización del modelo sanitario; coincidencias aproximadas y fusión revisada de identidades; pruebas de integración sobre una base de prueba; y respaldo/recuperación, piloto, biometría e interoperabilidad.
