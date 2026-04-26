# Cómo instalar el Add-in "Árbol de Decisión" en Excel

**Quintana Energy — Add-in para análisis de decisión**

---

## Qué necesitás

- Excel de escritorio (Windows o Mac), versión 2019 o superior, o Microsoft 365.
- Conexión a internet la primera vez (para que Excel descargue el add-in).
- 5 minutos.

No hace falta ser administrador de tu computadora. No se instala ningún programa nuevo.

---

## Pasos

### 1. Descargar el archivo de instalación

Hacer click en este link y guardarlo en tu computadora:

**https://github.com/jleal-quintana/addin-decision-tree/raw/main/manifest.prod.xml**

Si tu navegador abre el archivo en lugar de descargarlo, hacer click derecho → **"Guardar enlace como..."** y elegir una carpeta cualquiera (por ejemplo, **Descargas**).

El archivo se llama `manifest.prod.xml`. **No abrir, no editar.** Solo guardarlo.

### 2. Abrir Excel

Cualquier libro nuevo o existente sirve.

### 3. Cargar el complemento

En la cinta superior de Excel:

1. Ir a la pestaña **Insertar**.
2. Click en **Complementos** (o **Mis complementos**).
3. En la ventana que abre, arriba a la derecha hay un link **"Cargar mi complemento"** (o **"Upload My Add-in"**).
4. Click en **Examinar...** y seleccionar el archivo `manifest.prod.xml` que descargaste en el paso 1.
5. Click en **Cargar**.

### 4. Confirmar que apareció

En la pestaña **Inicio** de Excel, al final de la cinta, vas a ver un grupo nuevo **"Quintana Energy"** con un botón **"Abrir árbol"**.

Click en ese botón abre el panel del add-in en la parte derecha de Excel.

---

## Listo

Una vez instalado, el complemento queda disponible cada vez que abrís Excel. **No hay que reinstalar.**

Cuando publiquemos actualizaciones, las recibís automáticamente la próxima vez que abras Excel — no tenés que descargar nada nuevo.

---

## Si algo sale mal

**"El complemento no se carga / da error de manifest."**
Asegurate de haber descargado el archivo entero. A veces algunos navegadores guardan solo HTML en lugar del XML. Volvé a descargar haciendo click derecho → "Guardar enlace como...".

**"No veo el botón en la cinta."**
Reiniciá Excel completamente (cerrá todas las ventanas, volvé a abrir). El complemento solo aparece después de que Excel se reinicie.

**"Excel pide credenciales o pide aprobación de admin."**
Tu organización puede tener restringida la instalación de complementos personalizados. En ese caso, escribinos a Juan Leal (jleal@quintanaep.com) para coordinar el deployment vía IT.

**Cualquier otra cosa.**
Mandar mail a jleal@quintanaep.com con captura de pantalla del error.

---

## Cómo desinstalar (si hace falta)

Excel → **Insertar** → **Complementos** → **Mis complementos** → buscar **"Árbol de Decisión"** → click en los tres puntos (`...`) → **Quitar**.

---

*Quintana Energy — Análisis de decisión para ingeniería de campo*
