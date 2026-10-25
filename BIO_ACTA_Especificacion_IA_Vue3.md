---
document_id: BIO-ACTA-TECH-SPEC
language: es-MX
source_document: BIO_ACTA_Analisis_Implementacion_Vue3.pdf
status: Propuesta de trabajo; no representa un sistema implementado
title: BIO-ACTA --- Análisis funcional y especificación inicial para
  implementación con Vue 3
version: 1.1
---

# BIO-ACTA

## Análisis funcional y especificación inicial para implementación web con Vue 3

**Concepto:** Identidad y biografía de vida del animal.\
**Lema:** Su identidad lo acompaña. Su historia lo protege.

## 0. Propósito y reglas de lectura para agentes de IA

Este documento convierte el análisis funcional de BIO-ACTA en una
especificación textual estructurada para que un agente de IA pueda
leerlo, recuperar requisitos y apoyar el desarrollo sin depender de la
extracción de texto de un PDF.

### 0.1 Cómo interpretar este documento

-   Las secciones describen una **propuesta de producto y
    arquitectura**, no funciones que ya existan en producción.
-   Las rutas, entidades de datos, tecnologías y fases son propuestas de
    implementación derivadas del concepto.
-   No se afirma que exista validación jurídica, biométrica,
    institucional o técnica concluida.
-   Si falta una decisión, el agente debe marcarla como **PENDIENTE DE
    DEFINICIÓN** y preguntar o proponer opciones claramente etiquetadas.
    No debe inventar requisitos como si estuvieran aprobados.
-   Mantener el principio central: **la identidad del animal debe
    continuar aunque cambien las personas responsables**.
-   Separar siempre información pública autorizada, información privada
    de las personas y expediente profesional.
-   Distinguir los datos declarados por cuidadores de los registros
    certificados por profesionales.
-   No presentar BIO-ACTA como documento oficial gubernamental sin
    reconocimiento o convenio formal.

### 0.2 Instrucciones para agentes de desarrollo

Al implementar una función: 1. Identificar el requisito funcional
relacionado en este documento. 2. Respetar las reglas de privacidad,
autorización, trazabilidad y continuidad de la identidad. 3. Mantener
separadas la interfaz Vue 3, la API y la persistencia de datos. 4. No
exponer secretos, datos personales ni información sanitaria privada en
rutas públicas o códigos QR. 5. Añadir validaciones y pruebas de
aceptación para permisos, cambios de custodia e historial. 6. Documentar
decisiones nuevas como propuestas; no cambiar silenciosamente el alcance
aprobado. 7. Si el repositorio existente contradice esta especificación,
informar la discrepancia antes de realizar cambios destructivos.

## 1. Resumen ejecutivo

BIO-ACTA se plantea como una infraestructura digital de identidad
permanente y biografía de vida para animales domésticos y de compañía.
La identidad del animal debe mantenerse aunque cambie de cuidador,
propietario, veterinario, refugio o domicilio.

La primera versión debe demostrar que es posible: - Registrar un
animal. - Asignarle un identificador único y permanente. - Consultar
mediante QR una vista pública limitada y autorizada. - Conservar una
historia útil y protegida. - Mantener la continuidad del expediente al
cambiar la custodia.

La biometría avanzada y la integración gubernamental quedan fuera de las
prioridades iniciales.

**Principio rector:** Primero identificamos al animal; después
vinculamos a las personas que forman parte de su vida.

## 2. Objetivos funcionales

### 2.1 Identidad digital

-   Permitir el registro gratuito de un animal.
-   Generar un identificador único.
-   Guardar fotografías, características físicas, edad estimada e
    historia conocida.
-   Permitir un registro provisional cuando no se conoce al responsable.

### 2.2 Biografía sanitaria

-   Registrar vacunas, enfermedades, alergias, cirugías, tratamientos,
    medicamentos y documentos.
-   Conservar la autoría, procedencia y estado de certificación de cada
    registro.

### 2.3 Consulta pública por QR

-   Permitir abrir la Bio-Acta desde un navegador común sin exigir
    cuenta ni instalar una aplicación para consultar los datos
    autorizados.
-   Mostrar únicamente la información configurada como pública.
-   El QR debe apuntar a un identificador público aleatorio; no debe
    contener datos personales ni información sensible.

### 2.4 Animales perdidos o encontrados

-   Permitir reportes con fecha, ubicación y un mecanismo de contacto
    seguro.
-   Un reporte de animal encontrado no convierte al reportante en
    propietario ni le concede facultad para transferir la custodia
    legal.

### 2.5 Continuidad de la historia

-   Vincular cuidadores, rescatistas, refugios, hogares temporales,
    veterinarios y adoptantes mediante permisos.
-   Permitir transferencias de custodia sin crear una identidad nueva ni
    borrar el historial.

### 2.6 Cuidados

-   Programar recordatorios.
-   Registrar la confirmación de dosis administradas.
-   Consultar el historial de cuidados para reducir duplicaciones.

### 2.7 Protección de datos

-   Diferenciar declaraciones de cuidadores y registros profesionales
    certificados.
-   Aplicar permisos por rol y proteger fotografías, documentos y datos
    personales.

## 3. Mapa del sitio y rutas propuestas

Las rutas siguientes son propuestas técnicas; no son rutas confirmadas
de una aplicación ya construida.

  -----------------------------------------------------------------------
  Ruta                                Responsabilidad
  ----------------------------------- -----------------------------------
  `/`                                 Inicio público, propuesta de valor
                                      y acciones principales.

  `/registrar`                        Alta gratuita de un animal.

  `/animal/:id`                       Consulta pública limitada de la
                                      Bio-Acta. `:id` representa el
                                      identificador público, no el ID
                                      interno.

  `/encontrado`                       Reportar un animal encontrado.

  `/perdido`                          Reportar un animal perdido.

  `/acceso`                           Inicio de sesión.

  `/panel`                            Resumen del cuidador, alertas y
                                      cuidados del día.

  `/panel/animales`                   Listado de animales vinculados al
                                      usuario.

  `/panel/animales/:id`               Expediente completo de un animal
                                      autorizado.

  `/panel/cuidados`                   Medicamentos, horarios y
                                      confirmación de dosis.

  `/panel/historial`                  Línea de vida y eventos.

  `/panel/compartir`                  Accesos temporales y transferencias
                                      de custodia.

  `/profesional`                      Herramientas para veterinarios,
                                      clínicas y refugios.

  `/administracion`                   Gestión de usuarios, reportes,
                                      auditoría y catálogos.
  -----------------------------------------------------------------------

La protección no debe depender únicamente de ocultar rutas en Vue
Router. La API debe comprobar la autenticación y autorización en cada
operación protegida.

## 4. Flujo de creación de una Bio-Acta

1.  **Captura:** recoger fotografías, especie, nombre si se conoce, sexo
    aparente, señas físicas, edad estimada y contexto.
2.  **Búsqueda previa:** comprobar si existen registros posiblemente
    coincidentes con los identificadores disponibles.
3.  **Resolución de coincidencias:** si existe una posible coincidencia,
    iniciar un proceso de verificación; no fusionar registros
    automáticamente sin una regla de resolución aprobada.
4.  **Registro provisional o nuevo:** si no se confirma una
    coincidencia, permitir crear una Bio-Acta provisional.
5.  **Asignación de identidad:** generar un ID interno inmutable y un
    identificador público aleatorio.
6.  **QR:** generar un código QR asociado a una vista pública
    controlada.
7.  **Evolución de la historia:** permitir añadir salud, cuidados,
    rescates, intervenciones y cambios de custodia de acuerdo con los
    permisos.

**Pendiente de definición:** proceso exacto para verificar
coincidencias, resolver duplicados, reclamar un animal y escalar
disputas de custodia.

## 5. Modelo de datos inicial propuesto

Las siguientes entidades son un modelo conceptual inicial. No
representan un esquema SQL definitivo.

### 5.1 `animals`

Identidad principal del animal.

Campos conceptuales: - ID interno. - ID público. - Especie. - Nombre, si
se conoce. - Sexo. - Edad estimada. - Descripción física. - Estado del
registro.

Reglas: - El ID interno es inmutable. - El ID público debe ser aleatorio
y no revelar información personal. - Un animal puede existir sin
propietario conocido. - La estructura debe admitir varias especies
aunque el piloto se concentre inicialmente en perros.

### 5.2 `animal_photos`

Fotografías asociadas a un animal.

Datos conceptuales: animal, referencia del archivo, tipo de imagen y
fecha. La política de visibilidad y acceso al archivo debe controlarse
por separado.

### 5.3 `animal_identifiers`

Identificadores asociados al animal.

Datos conceptuales: tipo de identificador, referencia y estado de
verificación. No asumir que todo identificador está verificado.

### 5.4 `animal_custody`

Relaciones de custodia a lo largo del tiempo.

Datos conceptuales: animal, usuario, rol, periodo y estado de custodia.
Las transferencias deben conservar el historial previo.

### 5.5 `health_records`

Registros de salud.

Datos conceptuales: tipo, descripción, fecha, autor y estado de
certificación. Debe poder distinguirse un dato declarado por un cuidador
de uno certificado por un profesional.

### 5.6 `vaccinations`

Vacunaciones.

Datos conceptuales: vacuna, fecha, próxima fecha y profesional
responsable cuando corresponda.

### 5.7 `medications`

Medicamentos o tratamientos registrados.

Datos conceptuales: medicamento, dosis, unidad, frecuencia e
instrucciones.

### 5.8 `care_schedules`

Programaciones de cuidados.

Datos conceptuales: cuidado o medicamento relacionado, recurrencia,
horario y zona horaria.

### 5.9 `care_logs`

Registro de cuidados realizados.

Datos conceptuales: dosis prevista, fecha y hora real, resultado y
usuario que confirma. Debe permitir distinguir una dosis programada de
una dosis confirmada como administrada.

### 5.10 `animal_events`

Eventos de la biografía del animal.

Datos conceptuales: tipo de evento, fecha, descripción y ubicación
autorizada.

### 5.11 `lost_found_reports`

Reportes de animales perdidos o encontrados.

Datos conceptuales: animal o registro provisional, tipo de reporte,
ubicación, fecha y estado.

### 5.12 `access_grants`

Permisos concedidos a otros usuarios.

Datos conceptuales: usuario autorizado, animal, permisos, expiración y
revocación. Deben poder concederse accesos limitados y temporales.

### 5.13 `audit_logs`

Trazabilidad de acciones.

Datos conceptuales: actor, acción, registro afectado, fecha y cambios
relevantes. El acceso a estos registros debe limitarse a roles
autorizados.

### 5.14 Reglas generales del modelo

-   Separar los datos públicos de los datos personales y del expediente
    profesional.
-   Conservar autoría y procedencia de cada dato relevante.
-   No borrar la historia por una transferencia de custodia.
-   Definir restricciones de integridad, relaciones, índices, retención
    y borrado antes de cerrar el esquema SQL.
-   No guardar secretos ni credenciales en estos registros.
-   La lista de campos es conceptual: tipos, nulabilidad, claves e
    índices quedan pendientes de diseño técnico.

## 6. Arquitectura recomendada

### 6.1 Frontend

-   Vue 3.
-   Composition API.
-   Vite.
-   Vue Router para navegación pública, privada y profesional.
-   Pinia para estado compartido de autenticación, animales, salud y
    cuidados.
-   CSS propio, diseño responsive, formularios accesibles y componentes
    reutilizables.

### 6.2 Backend

-   API REST con Node.js y Express.
-   Validación de entradas en el servidor.
-   Autenticación y autorización por operación.
-   Manejo centralizado de errores.
-   Registro de auditoría para operaciones relevantes.

### 6.3 Base de datos

-   MySQL.
-   Relaciones e índices apropiados.
-   Restricciones de integridad y transacciones para operaciones
    críticas, como transferencias de custodia.
-   Estrategia documentada de respaldos y recuperación.

### 6.4 Archivos

-   Almacenamiento de fotografías y documentos con acceso protegido.
-   Validación de tipo y tamaño de archivo.
-   Evitar que una URL pública permanente exponga documentos privados.
-   Aplicar autorización en las descargas privadas.

### 6.5 QR

-   El QR apunta a la ruta pública de la Bio-Acta.
-   Utiliza un identificador público no predecible.
-   La vista pública solo entrega los campos autorizados.
-   El QR no debe funcionar como autorización para acceder al expediente
    privado.

### 6.6 Notificaciones

-   Evaluar PWA y capacidades compatibles con los dispositivos objetivo.
-   Probar explícitamente en iOS y Android.
-   No prometer avisos fiables cuando el navegador está cerrado sin
    validar el comportamiento real en los dispositivos.
-   Las alarmas críticas pueden requerir una solución móvil adicional.

### 6.7 Organización sugerida de `src/`

``` text
src/
├── components/
│   ├── animal/
│   ├── health/
│   ├── care/
│   └── common/
├── layouts/
│   ├── PublicLayout.vue
│   ├── CaregiverLayout.vue
│   └── ProfessionalLayout.vue
├── views/
│   ├── HomeView.vue
│   ├── RegisterAnimalView.vue
│   ├── PublicBioActaView.vue
│   ├── DashboardView.vue
│   └── CareView.vue
├── stores/
│   ├── auth.ts
│   ├── animals.ts
│   ├── health.ts
│   └── care.ts
├── services/
│   ├── api.ts
│   ├── animals.ts
│   ├── health.ts
│   └── care.ts
├── router/
├── App.vue
└── main.ts
```

Esta estructura es orientativa. Los nombres y el uso de TypeScript deben
adaptarse al repositorio real; no asumir que ya existen estos archivos.

## 7. Alcance recomendado por prioridad

### P0 --- MVP imprescindible

-   Registro e identidad del animal.
-   Identificador público y QR.
-   Vista pública limitada.
-   Panel del cuidador.
-   Expediente e historial.
-   Permisos básicos.
-   Protección de información privada.
-   Pruebas de aceptación del flujo principal.

### P1 --- Siguiente etapa

-   Medicamentos y recordatorios.
-   Registro de dosis.
-   Reportes de animales perdidos y encontrados.
-   Transferencias de custodia.

### P2 --- Funciones profesionales

-   Roles de veterinarios y refugios.
-   Registros certificados.
-   Gestión de documentos.
-   Gestión de múltiples animales.

### P3 --- Investigación e integración

-   Búsqueda biométrica 1:N.
-   Interoperabilidad con sistemas externos.
-   Acuerdos institucionales.

El piloto debe validar el uso real con un grupo pequeño de animales
antes de escalar.

## 8. Seguridad y criterios de aceptación

La implementación no se considera validada hasta probar, como mínimo,
los siguientes escenarios:

1.  Un usuario puede crear un registro y obtener una identidad única.
2.  Puede registrarse provisionalmente un animal cuyo propietario o
    responsable sea desconocido.
3.  Escanear el QR muestra solo información autorizada.
4.  Un usuario sin permisos no puede leer ni modificar el expediente
    privado, aunque invoque directamente la API.
5.  El sistema distingue registros declarados de registros certificados.
6.  Se identifica al profesional autor cuando exista una certificación.
7.  El historial se conserva después de una transferencia de custodia.
8.  Los accesos temporales pueden expirar y revocarse.
9.  El registro de dosis permite identificar quién confirmó una
    administración y cuándo.
10. Fotografías y documentos privados no quedan accesibles sin
    autorización.
11. Las operaciones relevantes generan registros de auditoría.
12. Se comprueba la restauración de respaldos, no solo su creación.
13. Los datos de contacto y domicilio del responsable no se exponen en
    la vista pública.
14. Las rutas públicas y privadas se prueban con y sin sesión y con
    distintos roles.

### 8.1 Limitaciones que deben mantenerse explícitas

**Notificaciones:** una página web no garantiza avisos fiables cuando el
navegador está cerrado. La PWA debe probarse en dispositivos reales;
puede requerirse una solución móvil adicional para alertas críticas.

**Biometría:** buscar un animal entre todos los registros requiere una
tecnología de reconocimiento validada. La similitud entre nombres o
fotografías no equivale a identificación biométrica fiable.

## 9. Modelo de sostenibilidad propuesto

### 9.1 Capa social gratuita

-   Identidad esencial.
-   QR.
-   Consulta pública autorizada.
-   Reportes de animales perdidos o encontrados.
-   Continuidad de la historia.

### 9.2 Capa profesional

-   Gestión para veterinarios, clínicas y refugios.
-   Expedientes certificados.
-   Herramientas administrativas.

La suscripción profesional es una hipótesis comercial que debe
validarse; no es un modelo de ingresos confirmado.

### 9.3 Capa comercial

-   Patrocinadores.
-   Campañas.
-   Beneficios.
-   Servicios voluntarios.

Toda actividad comercial debe respetar la privacidad y la independencia
del registro.

### 9.4 Diferenciación

La propuesta no consiste únicamente en ofrecer QR, historial y
recordatorios. Busca preservar la identidad del propio animal incluso
antes de que tenga un responsable conocido, y mantener su biografía
cuando cambien las personas a su alrededor.

## 10. Límites jurídicos y de representación

-   Un reporte de animal encontrado no convierte al reportante en
    propietario ni le permite transferir la custodia legal.
-   Una coincidencia biométrica puede ayudar a evaluar si se trata del
    mismo animal, pero no determina por sí sola la propiedad.
-   No revelar domicilio ni datos de contacto del responsable en la
    vista pública.
-   Definir consentimiento, aviso de privacidad, finalidades, medidas de
    seguridad y mecanismos para ejercer derechos sobre datos personales.
-   Diferenciar registros declarados de actos veterinarios certificados.
-   Hasta contar con reconocimiento o convenio formal, describir
    BIO-ACTA como un registro privado digital, no como documento oficial
    gubernamental.
-   Antes de acuerdos institucionales o integraciones públicas, revisar
    el marco legal, la interoperabilidad y los requisitos
    correspondientes con especialistas.

Este documento no constituye asesoría jurídica ni certifica el
cumplimiento normativo.

## 11. Secuencia de trabajo sugerida

### Fase 1 --- Definición

Entregables: - Historias de usuario. - Matriz de roles y permisos. -
Prototipos. - Criterios de aceptación. - Decisiones pendientes
priorizadas.

### Fase 2 --- Núcleo

Entregables: - API. - Base de datos. - Autenticación. - Alta de
animales. - Identificadores únicos.

### Fase 3 --- Consulta pública

Entregables: - Bio-Acta pública. - Generación de QR. - Reglas de
visibilidad y pruebas de privacidad.

### Fase 4 --- Panel

Entregables: - Listado de animales. - Expediente. - Línea de vida. -
Auditoría.

### Fase 5 --- Cuidados

Entregables: - Programaciones. - Registro de dosis. - Pruebas de
notificaciones en dispositivos objetivo.

### Fase 6 --- Validación

Entregables: - Piloto. - Pruebas de seguridad. - Pruebas de respaldos y
restauración. - Ajustes basados en resultados.

### Fase 7 --- Escalamiento

Entregables potenciales: - Funciones para profesionales y refugios. -
Investigación biométrica. - Integración institucional, condicionada a
viabilidad técnica, jurídica y operativa.

## 12. Decisiones pendientes antes de implementar

No están especificadas por completo en el documento base y deben
resolverse sin asumir respuestas:

1.  Métodos de registro e inicio de sesión.
2.  Roles definitivos y matriz exacta de permisos.
3.  Campos concretos que aparecerán en la Bio-Acta pública.
4.  Método para verificar identidad, resolver duplicados y gestionar
    reclamaciones.
5.  Procedimiento de transferencia, disputa y revocación de custodia.
6.  Tipos de certificación profesional y mecanismo de validación.
7.  Reglas de retención, corrección y eliminación de datos.
8.  Proveedor y política de almacenamiento de fotografías y documentos.
9.  Canales de notificación y dispositivos oficialmente soportados.
10. Esquema SQL definitivo, índices y estrategia de migraciones.
11. Requisitos de despliegue, monitoreo, respaldos y recuperación.
12. Modelo comercial y precios, sujetos a validación.

## 13. Glosario

-   **Bio-Acta:** registro digital de identidad e historia del animal.
-   **ID interno:** identificador técnico del registro; no debe cambiar.
-   **ID público:** identificador aleatorio utilizado para localizar la
    vista pública.
-   **Custodia:** relación registrada entre un animal y una persona u
    organización responsable; no equivale automáticamente a una
    determinación legal de propiedad.
-   **Registro provisional:** registro creado cuando la identidad o el
    responsable aún no se han confirmado.
-   **Registro declarado:** dato ingresado por un cuidador u otro
    usuario sin certificación profesional.
-   **Registro certificado:** dato validado y atribuido a un profesional
    mediante un proceso que aún debe definirse.
-   **Acceso temporal:** permiso limitado por alcance y duración, que
    puede expirar o revocarse.
-   **PWA:** aplicación web progresiva; sus capacidades dependen del
    navegador y del sistema operativo.
-   **Biometría 1:N:** búsqueda de una muestra contra múltiples
    registros para proponer posibles coincidencias; requiere validación
    especializada.

## 14. Conclusión

La primera versión web debe resolver de forma fiable cuatro necesidades:
identificar al animal, consultar su identidad mediante QR con
privacidad, conservar su historia sanitaria y mantenerla cuando cambie
de cuidador.

Vue 3, una API REST y MySQL permiten construir la solución de manera
modular sin asumir desde el inicio el coste y la complejidad de una
infraestructura biométrica nacional.

**Primero identificamos al animal. Después vinculamos a las personas que
forman parte de su vida.**

## 15. Procedencia y estado del documento

Este documento es una reorganización textual del archivo
`BIO_ACTA_Analisis_Implementacion_Vue3.pdf`, que sintetiza el concepto
de un documento original identificado como `Pet social.pdf`.

La arquitectura, las rutas, las entidades, las prioridades y las fases
se presentan como propuestas derivadas del concepto. No demuestran que
el sistema esté construido ni que se hayan completado validaciones
técnicas, biométricas, jurídicas o institucionales.
