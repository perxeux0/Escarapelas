# Escarapelas y Asistencia SENA · Versión 4.1

Generador de escarapelas y carnets con control de asistencia por QR para los bootcamps y eventos del **SENA – Centro de Automatización Industrial, Regional Caldas**.

**Instructor:** Jorge Walter Salazar A.

---

## Novedades de la versión 4

| Mejora | Detalle |
|---|---|
| **Proyectos con nombre** | Cada evento se guarda como proyecto (diseño de escarapelas y carnets + participantes). Al guardar por primera vez se pide el nombre. Se listan en **📁 Proyectos** y se cargan con un clic. |
| **Compartidos entre usuarios y computadores** | Usuarios, proyectos y asistencia viven en el servidor (Google Apps Script + Sheets + Drive). Lo que guarda un usuario lo ven y cargan todos los demás, desde cualquier equipo. |
| **QR permanentes** | Los QR de los carnets registran asistencia indefinidamente mientras el proyecto exista y su escaneo esté **habilitado**. |
| **Asistencia de cualquier proyecto** | En **📋 Asistencia** se elige cualquier proyecto de la lista y se ve, filtra y exporta a Excel su asistencia. |
| **Solo el administrador borra** | Eliminar un proyecto (con sus escarapelas, carnets, participantes y asistencia) o **borrar todo** es exclusivo de los administradores. El servidor lo verifica en cada petición. |
| **Backup y restauración** | El administrador descarga un backup completo (usuarios, proyectos con imágenes, participantes, asistencia y ajustes) y puede restaurarlo: primero se limpia todo y luego se carga y **verifica** el backup completo. |
| **Logo SENA** | Segundo logo en la parte superior (“Aquí se agrega el logo SENA”), con posición izquierda/centro/derecha y barra de tamaño, independiente para la escarapela y para el carnet. |
| **Imágenes inferiores ajustables** | Cada imagen inferior tiene su propia barra de tamaño, además de la altura de la franja. |
| **Control de cambios** | Indicador “● Cambios sin guardar”, **Ctrl + S** para guardar, aviso si otro usuario modificó el proyecto mientras lo editabas y borrador local por si se cierra el navegador. |

### Permisos

| Acción | Usuario | Administrador |
|---|:---:|:---:|
| Crear, cargar y guardar proyectos; “Guardar como” | ✅ | ✅ |
| Ver y exportar la asistencia de cualquier proyecto | ✅ | ✅ |
| Habilitar / inhabilitar el escaneo de QR | ✅ | ✅ |
| Imprimir escarapelas y carnets, PNG/ZIP | ✅ | ✅ |
| Cambiar el tamaño de la escarapela | — | ✅ |
| Crear usuarios, asignar contraseñas y roles | — | ✅ |
| Eliminar proyectos / borrar todo | — | ✅ |
| Backup y restauración | — | ✅ |
| Fondo del panel | — | ✅ |

---

## Estructura

```
├── index.html            ← página (ingreso + panel)
├── .nojekyll
├── css/styles.css
├── js/
│   ├── config.js         ← ⚠️ aquí va la URL del servidor (una sola vez)
│   ├── api.js            ← comunicación con el servidor
│   ├── auth.js           ← ingreso y usuarios (en el servidor)
│   ├── projects.js       ← proyectos, eliminar, borrar todo, backup y restauración
│   ├── attendance.js     ← panel de asistencia
│   ├── badge.js          ← diseño de la escarapela
│   ├── carnet.js         ← diseño del carnet y QR
│   ├── app.js            ← editor, vista previa e impresión
│   └── vendor/           ← librerías incluidas (Excel, PNG, ZIP, QR)
├── gas/Code.gs           ← servidor (se pega en Google Apps Script)
└── docs/referencia.png
```

---

## Actualizar de la versión 3 a la 4 (paso a paso)

### 1. Servidor (Apps Script)

1. Abre tu proyecto de Apps Script.
2. Reemplaza **todo** el contenido de `Código.gs` por el nuevo `gas/Code.gs` y guarda. **Ya no hay `CLAVE_ADMIN`**: la seguridad ahora son los usuarios y contraseñas.
3. Elige la función **instalar** → **▶ Ejecutar**. Google pedirá permisos de nuevo, porque v4 usa **Google Drive** para guardar los diseños: *Revisar permisos → tu cuenta → Configuración avanzada → Ir a (proyecto) → Permitir*.
4. En el registro aparecerán la hoja de datos y la carpeta **“Escarapelas SENA - Proyectos (no borrar)”** en tu Drive.
5. **Implementar → Administrar implementaciones → ✏ (editar) → Versión: Nueva versión → Implementar**. Así la URL `/exec` no cambia y los carnets ya impresos siguen funcionando.

Si es tu primera instalación: crea una hoja de Google o un proyecto en script.google.com, pega el código, ejecuta **instalar** y haz **Implementar → Nueva implementación → Aplicación web** (*Ejecutar como: Yo* · *Quién tiene acceso: Cualquier usuario*).

> El usuario inicial del servidor es **Walter / 123456**; al entrar pide cambiar la contraseña. Los usuarios de v3 vivían en cada navegador y no se trasladan: créalos de nuevo en **👥 Usuarios**. Los eventos que ya tenían participantes en v3 aparecen como proyectos “(v3 …)”, con sus participantes, su asistencia y sus QR funcionando.

### 2. Página (GitHub)

1. Abre `js/config.js` y pega la URL de tu aplicación web:
   ```js
   window.APP_CONFIG = {
     serviceUrl: 'https://script.google.com/macros/s/TU-ID/exec',
     version: '4.0'
   };
   ```
   Así todos los computadores se conectan solos. Si la dejas vacía, la pantalla de ingreso pide la URL en **⚙ Servidor** y la recuerda solo en ese navegador. La URL no es secreta: va impresa en cada QR.
2. Copia los archivos nuevos dentro de tu carpeta del repositorio, reemplazando los anteriores. **No reemplaces la carpeta completa**, porque se borra la carpeta oculta `.git`. Borra `js/sha256.js`, que ya no se usa.
3. Sube los cambios:
   ```bash
   git pull
   git add -A
   git commit -m "Versión 4: proyectos compartidos, backups y logo SENA"
   git push
   ```
   `git add -A` también registra los archivos borrados, como `sha256.js`.
4. Espera 1–2 minutos y abre la página con **Ctrl + F5**.

---

## Uso

### Flujo de un evento
1. **＋ Nuevo** → diseña la escarapela y el carnet → carga los participantes (uno a uno, separados por coma o desde Excel).
2. **💾 Guardar** → escribe el nombre del proyecto (ej. “Bootcamp Ciberseguridad – Octubre 2026”).
3. Imprime: solo escarapelas, solo carnets o ambos. Si hay cambios sin guardar, la app pide guardar antes de imprimir carnets, para que todos los QR queden registrados.
4. **📋 Asistencia** → elige el proyecto → **▶ Habilitar escaneo** durante la jornada → **⏸ Inhabilitar** al terminar.
5. Consulta, filtra y **⬇ Exportar a Excel** cuando quieras, desde cualquier usuario.

### Guardar y Guardar como
- **Guardar** actualiza el proyecto abierto. Los participantes nuevos quedan habilitados para registrar asistencia.
- **Guardar como** crea una **copia independiente** con QR nuevos. Sirve para reutilizar un diseño en otro evento.
- Si otro usuario modificó el proyecto después de que lo abriste, la app avisa antes de reemplazar sus cambios.

### Backup (administrador)
**📁 Proyectos → ⬇ Backup completo** descarga un archivo `.json` con todo: usuarios (contraseñas cifradas), proyectos con imágenes, participantes, asistencia y fondo del panel. Lleva una suma de verificación SHA-256. Guárdalo en un lugar seguro.

### Restaurar (administrador)
**📁 Proyectos → ⬆ Restaurar backup** → elige el archivo → escribe **RESTAURAR**.
- Antes de tocar nada, la app revisa que el archivo esté completo y no haya sido modificado. Si falla, no borra nada.
- Luego **borra toda la información actual**, carga el backup por partes y al final **verifica** que los totales del servidor coincidan con los del backup.
- Al terminar hay que ingresar de nuevo con un usuario que esté en el backup.

### Eliminar y borrar todo (administrador)
- 🗑 en un proyecto → escribir **ELIMINAR**: borra su diseño, participantes y asistencia; sus QR dejan de funcionar.
- **🗑 Borrar todo** → escribir **BORRAR TODO**: vacía todos los proyectos, carnets y asistencia. Los usuarios y el fondo del panel se conservan.
- Los archivos de diseño van a la **papelera de Google Drive** del dueño del script, que la vacía sola a los 30 días; puedes vaciarla antes si lo prefieres. Los datos de asistencia se borran de inmediato de la hoja.

### Al imprimir
En el cuadro de impresión de Chrome o Edge usa **Escala 100 %**, **Márgenes: ninguno** y **Gráficos de fondo** activado. Desactiva encabezados y pies.

---

## Seguridad

- Contraseñas cifradas en el servidor (SHA-256 con sal y 1.000 iteraciones). Mínimo **8 caracteres con letras y números**. Contraseña temporal obligatoria de cambiar.
- Sesiones de 6 horas. Bloqueo de 5 minutos tras 5 intentos fallidos. Al cambiar o asignar una contraseña, y al restaurar un backup, **se cierran las sesiones abiertas** con la clave anterior.
- Las imágenes se validan de forma estricta (solo PNG/JPEG/GIF/WEBP en base64), tanto en el navegador como en el servidor. La página aplica una **política de seguridad de contenido (CSP)** que solo permite ejecutar los scripts propios, y no se deja mostrar dentro de otra página (anti-clickjacking).
- **Auditoría**: la pestaña *Auditoria* de la hoja de datos registra quién y cuándo creó usuarios, asignó claves, cambió roles, eliminó proyectos, borró todo, hizo backups o restauró. No se borra con “Borrar todo” ni con la restauración.
- Al escanear un QR que no es válido, el servidor no revela si el evento existe ni si su registro está abierto.
- El rol se verifica en el servidor en **cada** petición. Un usuario normal no puede borrar aunque manipule la página, y si un administrador elimina a un usuario, su sesión deja de valer al instante.
- Cada QR lleva un token secreto de 20 caracteres: cambiar el ID en la URL no permite registrar a otra persona. Lo que un QR no puede impedir es que alguien escanee el carnet o una foto del carnet de un compañero. Por eso conviene habilitar el escaneo solo durante la jornada y que el instructor o un monitor escanee al ingreso.
- El backup contiene datos personales (nombres) y los usuarios con sus contraseñas cifradas. Trátalo como información reservada (Ley 1581 de 2012).

---

## Solución de problemas

| Problema | Solución |
|---|---|
| “La URL responde, pero no es el servidor v4” | Pega el nuevo `Code.gs` y crea una **Nueva versión** de la implementación. |
| “Respuesta inesperada del servidor” | La implementación debe tener acceso **Cualquier usuario**. |
| Pide permisos de Drive al ejecutar `instalar` | Es normal en v4: autorízalos. |
| Al escanear: “Registro cerrado” | Habilita el escaneo de ese proyecto en **📋 Asistencia**. |
| Al escanear: “Carnet no registrado” | Ese participante se agregó sin guardar: abre el proyecto y pulsa **💾 Guardar**. |
| Al escanear: “Evento no disponible” | El proyecto fue eliminado. Restaura un backup o vuelve a guardarlo con **Guardar como**. |
| “Tu sesión expiró” | Ingresa de nuevo. Lo que tenías en pantalla queda como borrador en ese navegador. |
| Olvidé la contraseña | Otro administrador asigna una nueva en **👥 Usuarios**. Si no hay otro administrador, en la hoja de datos, pestaña **Usuarios**, borra todas las filas de administradores y luego ingresa: el servidor recrea **Walter / 123456**. |
| Cambié archivos en GitHub y no se ven | Espera 2 minutos y recarga con **Ctrl + F5**. |

---

Desarrollado para el SENA – Centro de Automatización Industrial, Regional Caldas · Instructor: **Jorge Walter Salazar A.**
