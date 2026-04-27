# Cómo instalar el Add-in "Árbol de Decisión" en Excel

**Quintana Energy — Add-in para análisis de decisión**

---

## Qué necesitás

- Windows 10 u 11.
- Excel de escritorio, Microsoft 365 (versión 2019 o superior).
- Conexión a internet (la primera vez para descargar la configuración, y siempre que uses el complemento porque carga desde GitHub Pages).
- 5 minutos.

No hace falta ser administrador de tu computadora. No se instala ningún programa nuevo.

---

## Cómo funciona (en una línea)

El complemento corre en una página web hosteada en GitHub Pages. Lo que vamos a "instalar" en tu Excel es un archivo de configuración (`manifest.prod.xml`) que le dice a Excel dónde encontrar esa página y cómo mostrarla como un panel.

---

## Instalación

### 1. Descargar el instalador

Bajar este archivo:

**[`instalar.bat`](https://github.com/jleal-quintana/addin-decision-tree/raw/main/tutorial/instalar.bat)**

Si tu navegador abre el archivo en lugar de descargarlo, hacer click derecho → **"Guardar enlace como..."** y elegir cualquier carpeta (por ejemplo, **Descargas**).

### 2. Ejecutar el instalador

**Cerrá Excel** primero si lo tenés abierto.

Doble click en `instalar.bat`.

Windows va a mostrar una advertencia azul tipo "Windows protegió tu equipo / SmartScreen". Es porque el archivo no está firmado por Microsoft. **No es un virus.** Para continuar:

- Click en **"Más información"** (More info)
- Click en **"Ejecutar de todas formas"** (Run anyway)

Vas a ver una ventana negra con tres pasos:

```
[1/3] Preparando carpeta de complementos...
[2/3] Descargando configuracion (manifest)...
[3/3] Registrando complemento en Excel...

LISTO - Instalacion completada
```

Si todo dice OK, presioná cualquier tecla para cerrar.

### 3. Cargar el complemento por primera vez en Excel

Abrir Excel con un libro nuevo o existente.

1. Pestaña **Inicio** (Home).
2. Al final de la cinta, click en el botón **Complementos** (Add-ins).
3. En el menú desplegable, abajo de todo, click en **"Más complementos"** (More Add-ins).
4. En la ventana que abre, vas a ver una sección **"Developer Add-ins"** — ahí aparece **"Árbol de Decisión"**.
5. Click en él. El panel se abre a la derecha de Excel.

**Listo.** Ya podés usar el complemento.

---

## Cómo dejarlo "fijo" para no repetir el paso 3 cada vez

Excel desktop no permite que un complemento sideloadeado quede pinneado a la cinta entre sesiones (es una limitación de Microsoft, no del add-in). Pero hay un truco simple:

1. Con el panel "Árbol de Decisión" abierto, hacé **Archivo → Guardar como** (File → Save As).
2. Guardalo como **`Plantilla_Decision.xlsx`** en tu Escritorio.
3. Cerrá Excel.

A partir de ahora, cuando quieras usar el complemento, **abrí ese archivo** (doble click) en lugar de abrir Excel directo. El panel se carga solo, sin pasar por el menú de Add-ins.

Tip: anclá el archivo a la barra de tareas o al menú Inicio para tenerlo a un click.

---

## Si algo sale mal

**"El instalador no se ejecuta / Windows lo bloquea"**
Click derecho en `instalar.bat` → **Propiedades** → al final, marcar **"Desbloquear"** (Unblock) → Aceptar. Volver a doble-click.

**"Falla al descargar el manifest"**
Verificá conexión a internet. Si estás en una red corporativa con proxy, puede bloquear la descarga desde GitHub. Probá desde otra red o avisá a IT.

**"No veo Árbol de Decisión en Developer Add-ins"**
Cerrá Excel completamente (todas las ventanas) y reabrí. Si seguís sin verlo, ejecutá `instalar.bat` de nuevo.

**"Cuando abro el panel queda en blanco o tira error"**
Probablemente es un tema de cache. Cerrá Excel, abrí PowerShell y ejecutá:
```
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Microsoft\Office\16.0\Wef"
```
Después reabrir Excel.

**"Mi organización me bloquea complementos personalizados"**
En ese caso necesitás que IT lo deploye desde el Microsoft 365 admin center. Escribí a Juan Leal (jleal@quintanaep.com) para coordinar.

**Cualquier otra cosa**
Mandar mail a jleal@quintanaep.com con captura de pantalla del error.

---

## Actualizaciones

El código del complemento (lo que ves en el panel) se actualiza automáticamente — está en GitHub Pages y cada vez que abrís el panel descarga la última versión.

**Solo si te aviso explícitamente** que cambió la configuración (por ejemplo, agregamos un botón nuevo a la cinta), vas a tener que volver a ejecutar `instalar.bat` para refrescar el manifest. En general no hace falta.

---

## Cómo desinstalar

Bajar y ejecutar **[`desinstalar.bat`](https://github.com/jleal-quintana/addin-decision-tree/raw/main/tutorial/desinstalar.bat)**.

Eso quita la entrada del registro y borra el archivo de configuración. Cerrar y reabrir Excel para que tome efecto.

---

*Quintana Energy — Análisis de decisión para ingeniería de campo*
