# Escarapelas

Generador profesional de escarapelas para eventos 

**Instructor:** Jorge Walter Salazar A.

---

## Qué hace

| Función | Detalle |
|---|---|
| Acceso con usuarios | Administrador inicial (obliga a cambiarla al primer ingreso). El administrador crea administradores o usuarios normales y les asigna contraseña. |
| Encabezado editable | Dos campos con sugerencia (no texto fijo): *Centro de Automatización Industrial* y *Regional Caldas*. |
| Logo del evento | Se carga desde el panel y se ubica a la izquierda, centro o derecha, con tamaño ajustable. |
| Título del evento | Tres líneas: texto mediano (*Bootcamp*), principal (*de Ciberseguridad*) y frase motivadora. |
| Tipografía por campo | Cada campo tiene lista de 20 tipos de letra, tamaño (6–72 pt), negrita, cursiva y mayúsculas. |
| Colores inteligentes | Eliges un color y la app genera 5 paletas armónicas (monocromática, análoga, complementaria, triádica, complementaria dividida), con control automático de contraste para que el texto siempre se lea. Estilo oscuro o claro y patrones decorativos. |
| Fondo | Imagen de fondo detrás de todo, con control de intensidad del color encima. |
| Imágenes inferiores | Tres espacios: izquierda, centro y derecha. |
| Participantes | Cantidad de escarapelas, nombres uno a uno, pegados separados por coma o **importados desde Excel** (.xlsx, .xls, .ods, .csv) con detección automática de columnas *Nombres / Apellidos / Rol*. |
| Rango | General (Aprendiz, Participante, Instructor, Coordinador o el que escribas) o individual por persona. |
| Vista previa en vivo | Cada cambio se ve al instante a la derecha. Nombres largos se ajustan solos para no salirse del recuadro. |
| Impresión | **4 escarapelas por hoja** (2 × 2) en Carta, Legal u Oficio, con vista previa de todas las hojas y guías de corte. |
| Formato digital | PNG a 300 ppp de la escarapela actual o ZIP con todas. |
| Plantillas | Exportar / importar el diseño completo de cada evento en un archivo `.json`. |
| Fondo del panel | El administrador carga 1 o 2 imágenes de fondo para el panel (con dos, se alternan). |
| **Carnet de asistencia** | Carnet tamaño tarjeta (8,56 × 5,4 cm) por participante con datos del evento (título, fecha, lugar), nombre, rango y **código QR personal**. |
| **Asistencia por QR** | Al escanear el QR con la cámara de cualquier celular se registra la asistencia con fecha y hora (una vez por día). Base de datos en Google Sheets. |
| **Control de asistencia** | Desde el panel: habilitar / inhabilitar el escaneo con un botón, consultar, filtrar por participante, día y rango, y **exportar a Excel**. |
| **Modos de impresión** | Solo escarapelas (4 por hoja), solo carnets (8 por hoja carta, 10 oficio, 12 legal) o escarapela + carnet de cada persona (2 personas por hoja). |

### Tamaño exacto

La escarapela se dibuja en milímetros reales. Por defecto mide **10 × 13 cm**. Solo un administrador puede cambiarla (sección 7). El máximo permitido para que quepan 4 por hoja carta con márgenes de impresora es **10,19 × 13,37 cm**; la app rechaza medidas mayores.

---

## Estructura del proyecto

```
escarapelas-sena/
├── index.html          ← página principal (login + panel)
├── .nojekyll           ← le indica a GitHub Pages que publique tal cual
├── README.md
├── css/styles.css      ← estilos de la app, de la escarapela (mm/pt) y de impresión
├── js/
│   ├── sha256.js       ← cifrado de contraseñas (funciona incluso sin https)
│   ├── auth.js         ← usuarios, sesiones, bloqueo por intentos fallidos
│   ├── badge.js        ← colores, paletas, tipografías y dibujo de la escarapela
│   ├── app.js          ← panel de control, Excel, vista previa, impresión, PNG/ZIP
│   ├── carnet.js       ← diseño del carnet y generación del código QR
│   ├── attendance.js   ← módulo de control de asistencia (consulta, filtros, Excel)
│   └── vendor/         ← librerías incluidas (no dependen de internet)
│       ├── xlsx.full.min.js     (SheetJS – lectura de Excel)
│       ├── html2canvas.min.js   (exportar PNG)
│       ├── jszip.min.js         (exportar ZIP)
│       └── qrcode.js            (generar códigos QR)
├── gas/
│   └── Code.gs         ← servicio de asistencia (se pega en Google Apps Script)
└── docs/referencia.png ← imagen de referencia del diseño
```

Las escarapelas no requieren servidor. El **registro de asistencia** sí necesita una base de datos compartida (el celular que escanea y el panel deben ver los mismos datos): para eso se usa Google Apps Script + Google Sheets, gratis y sin servidor propio (ver siguiente sección).

---

## Subir a GitHub y publicarla (paso a paso)

### Opción A — Solo con el navegador (recomendada, sin instalar nada)

1. **Crea una cuenta** en <https://github.com> (si no la tienes) y entra.
2. Arriba a la derecha pulsa **+ → New repository**.
   - *Repository name:* `escarapelas-sena`
   - Marca **Public** (GitHub Pages gratis requiere repositorio público).
   - **No** marques “Add a README” (ya viene uno).
   - Pulsa **Create repository**.
3. En la página del repositorio vacío pulsa el enlace **uploading an existing file**.
4. Descomprime el ZIP del proyecto en tu computador. Abre la carpeta `escarapelas-sena` y **arrastra todo su contenido** (las carpetas `css`, `js`, `docs` y los archivos `index.html`, `README.md`, `.nojekyll`) a la ventana de GitHub.
   - Importante: arrastra el *contenido*, no la carpeta contenedora; `index.html` debe quedar en la raíz.
   - El archivo `.nojekyll` está oculto en Windows/Mac. Si no lo ves, no pasa nada: la app funciona sin él. (En Windows: Explorador → Vista → Mostrar → Elementos ocultos.)
5. Abajo escribe un mensaje como `Primera versión` y pulsa **Commit changes**.
6. Ve a **Settings → Pages** (menú izquierdo).
   - *Source:* **Deploy from a branch**
   - *Branch:* **main** y carpeta **/ (root)** → **Save**.
7. Espera 1–2 minutos y recarga. Aparecerá: *Your site is live at* `https://TU-USUARIO.github.io/escarapelas-sena/`
8. Abre ese enlace desde cualquier computador o celular, entra con **Walter / 123456** y define tu nueva contraseña.

### Opción B — Con Git desde la terminal

```bash
# 1. Entra a la carpeta del proyecto
cd escarapelas

# 2. Inicializa el repositorio y haz el primer commit
git init
git add .
git commit -m "Primera versión: generador de escarapelas"
git branch -M main

# 3. Conecta con el repositorio creado en GitHub (paso 2 de la opción A)
git remote add origin https://github.com/TU-USUARIO/escarapelas.git
git push -u origin main
```

GitHub pedirá autenticación: usa un **Personal Access Token** (Settings → Developer settings → Personal access tokens → *Fine-grained*, permiso *Contents: Read and write* sobre ese repositorio) en lugar de tu contraseña, o instala **GitHub Desktop** / **GitHub CLI** (`gh auth login`). Luego activa Pages igual que en el paso 6.

### Actualizar la aplicación más adelante

- **Navegador:** entra al repositorio → abre el archivo → ícono de lápiz para editar, o **Add file → Upload files** para reemplazar archivos → **Commit changes**.
- **Terminal:** `git add . && git commit -m "Descripción del cambio" && git push`.

GitHub Pages se actualiza solo en 1–2 minutos. Si no ves el cambio, recarga con **Ctrl + F5**.

---

## Servicio de asistencia (Google Apps Script) — paso a paso

Hazlo una sola vez. Se recomienda una cuenta **Gmail personal o institucional que permita compartir con “Cualquier usuario”** (algunas cuentas de dominio como @universidad.edu.co bloquean esa opción; si no aparece, usa un Gmail).

1. Entra a <https://sheets.google.com> y crea una hoja nueva. Llámala, por ejemplo, **Asistencia Escarapelas**.
2. En la hoja: **Extensiones → Apps Script**.
3. Borra el contenido de `Código.gs` y **pega todo el archivo `gas/Code.gs`** del proyecto.
4. En la línea `var CLAVE_ADMIN = 'CAMBIA-ESTA-CLAVE';` escribe una clave secreta **de 12 o más caracteres** (ej. `Bootcamp-CAI-2026*xq`). Guarda (💾).
5. Arriba elige la función **instalar** y pulsa **▶ Ejecutar**. Google pedirá permisos: *Revisar permisos → tu cuenta → Configuración avanzada → Ir a (proyecto) → Permitir*. Se crean las pestañas **Participantes** y **Asistencia**.
6. **Implementar → Nueva implementación** → ⚙ tipo **Aplicación web**:
   - *Ejecutar como:* **Yo**
   - *Quién tiene acceso:* **Cualquier usuario** (necesario para que el celular registre sin iniciar sesión)
   - **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`).
7. En el panel: **📋 Asistencia → ⚙ Configuración** → pega la URL y la misma clave → **Guardar y probar conexión**.

> Si cambias el código de Apps Script más adelante: **Implementar → Administrar implementaciones → ✏ → Versión: Nueva versión → Implementar**. Así la URL no cambia y los carnets ya impresos siguen funcionando.

### Flujo de un evento

1. Diseña la escarapela y llena en la sección **9** la fecha y el lugar del evento.
2. Carga los participantes.
3. **📋 Asistencia → ⇅ Sincronizar participantes** (al imprimir carnets también se sincroniza solo).
4. Imprime en el modo que necesites: solo escarapelas, solo carnets o ambos.
5. Al iniciar cada jornada: **▶ Habilitar escaneo**. Los participantes (o tú) escanean el QR con la cámara del celular → aparece *¡Asistencia registrada!* con fecha y hora.
6. Al terminar la jornada: **⏸ Inhabilitar escaneo** (evita registros fuera de horario).
7. Consulta, filtra y **⬇ Exportar a Excel** (pestañas *Resumen*, *Registros* e *Información*). Los datos también quedan en la hoja de Google.

Reglas del registro: una asistencia por persona por día (si escanea de nuevo, se le informa la hora en que ya quedó registrado). Cada evento tiene un **código** propio (sección 9); *↻ Nuevo código* crea un evento nuevo con QR nuevos.

## Uso rápido

1. **Encabezado y logo:** escribe los dos textos institucionales, carga el logo y elige su ubicación.
2. **Título:** escribe las tres líneas del evento y ajusta tipo de letra y tamaño de cada una.
3. **Colores:** elige el color base del evento → pulsa la paleta que más te guste → ajusta si quieres. 🎲 genera una combinación al azar.
4. **Fondo e imágenes inferiores:** opcionales.
5. **Participantes:** fija la cantidad y escribe los nombres, pégalos separados por coma o importa el Excel.
6. **Vista previa de impresión:** elige papel, revisa las hojas y pulsa **Imprimir**.

### Al imprimir (clave para el tamaño exacto)

En el cuadro de impresión del navegador (se recomienda **Google Chrome** o **Edge**):

- **Escala:** 100 % / *Tamaño real* (nunca “Ajustar a la página”).
- **Márgenes:** Ninguno.
- **Opciones → Gráficos de fondo:** activado (si no, los colores salen en blanco).
- **Encabezados y pies de página:** desactivado.
- Para PDF: destino **Guardar como PDF**.

Verifica la primera hoja con una regla: la escarapela debe medir exactamente lo que indica la app.

### Formato de Excel recomendado

| Tipo documento | Número | Nombres | Primer apellido | Segundo apellido | Rol |
|---|---|---|---|---|---|
| CC | 1001 | Ana María | Pérez | Gómez | Aprendiz |

También funciona con una sola columna *Nombre completo*, sin encabezados, o con columnas en otro orden: antes de importar puedes corregir qué columna es cada dato y ver una muestra del resultado.

---

## Seguridad: lo que debes saber

- Las contraseñas se guardan **cifradas** (SHA-256 con sal aleatoria y 4.000 iteraciones), nunca en texto plano. Tras 5 intentos fallidos el acceso se bloquea 30 segundos. La sesión se cierra al cerrar la pestaña.
- GitHub Pages solo publica archivos estáticos, por eso **usuarios, diseños y participantes se guardan en el navegador de cada equipo** (localStorage). Consecuencias:
  - Un usuario creado en tu portátil no existe en otro computador. Usa **Usuarios → Exportar usuarios** y luego **Importar usuarios** en el otro equipo. Igual con los diseños: **Exportar / Importar plantilla**.
  - Si se borran los datos del navegador, se pierden usuarios y diseños y vuelve a existir **Walter / 123456**. Guarda copias de los archivos exportados.
  - El login protege el uso cotidiano, pero no es una barrera para alguien técnico con acceso al mismo navegador: el código es público. **No guardes datos sensibles** (documentos de identidad, etc.) en la app; solo nombres y rango.
- **QR de asistencia:** cada QR lleva un token aleatorio de 20 caracteres; cambiar el ID en la URL no sirve para registrar a otra persona. Lo que no puede evitar un QR es que alguien escanee el carnet de un compañero o una foto de él: por eso existe el botón para **habilitar el escaneo solo durante la jornada**, y conviene que el instructor o un monitor sea quien escanee al ingreso.
- La **clave de administrador** del servicio queda guardada en el navegador donde se configuró. Úsala solo en equipos de confianza y cámbiala (Apps Script + nueva versión de la implementación) si se compromete.
- El servicio guarda solo nombre, rango, ID del carnet y fecha/hora: no se recogen datos sensibles. Aun así, al ser datos personales de aprendices (Ley 1581 de 2012), informa a los participantes la finalidad del registro.
- Si más adelante necesitas usuarios compartidos entre todos los equipos, el siguiente paso es conectar un servicio con autenticación real (por ejemplo Firebase Authentication o Supabase); la estructura de `auth.js` está aislada para facilitar ese cambio.
- La librería de Excel incluida es SheetJS 0.18.5 (última publicada en npm). Tiene vulnerabilidades conocidas solo explotables abriendo archivos manipulados; como aquí solo se abren listas propias y todo ocurre en tu navegador, el riesgo es bajo. Si quieres la versión más reciente, descarga `xlsx.full.min.js` desde <https://cdn.sheetjs.com> y reemplaza el archivo en `js/vendor/`.

---

## Solución de problemas

| Problema | Solución |
|---|---|
| Sale una hoja en blanco extra o las escarapelas se ven más pequeñas | Escala 100 % y márgenes *Ninguno* en el cuadro de impresión. |
| Los colores no se imprimen | Activa *Gráficos de fondo*. |
| “No se pudo guardar automáticamente” | Las imágenes son muy pesadas. Usa imágenes más livianas o exporta la plantilla. |
| Olvidé la contraseña de Walter | Otro administrador le asigna una nueva. Si no hay otro, borra los datos del sitio en el navegador (se pierde todo lo guardado ahí) y vuelve a entrar con Walter / 123456. |
| Los tipos de letra se ven distintos | Se descargan de Google Fonts: requiere internet la primera vez. |
| Cambié archivos en GitHub y no se ven | Espera 2 minutos y recarga con Ctrl + F5. |
| “No se pudo conectar con el servicio de asistencia” | Revisa que la URL termine en `/exec` y que la implementación tenga acceso **Cualquier usuario**. |
| “Clave de administrador incorrecta” | La clave del panel debe ser idéntica a `CLAVE_ADMIN` en Apps Script (y haber implementado una nueva versión tras cambiarla). |
| Al escanear sale “Carnet no registrado” | Falta sincronizar: **📋 Asistencia → ⇅ Sincronizar participantes**. |
| Al escanear sale “Registro cerrado” | Pulsa **▶ Habilitar escaneo** en el panel. |
| No puedo imprimir carnets | Configura primero el servicio de asistencia: sin él los QR no tendrían a dónde registrar. |

---

Desarrollado para el SENA – Centro de Automatización Industrial, Regional Caldas · Instructor: **Jorge Walter Salazar A.**
