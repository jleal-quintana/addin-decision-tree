# Arbol de Decision Add-in

Add-in de Excel para construir, analizar y dibujar arboles de decision con salida optimizada para Excel Desktop.

## Comandos

```bash
npm run dev
npm run build
npm run test
npm run validate
npm run start:desktop
npm run stop:desktop
```

## Flujo de desarrollo

1. `npm run validate`
2. `npm run test`
3. `npm run start:desktop`

## Modo debug

- Query param: `?debug=1`
- O en consola del taskpane:

```js
localStorage.setItem("dt-debug", "1");
location.reload();
```

El modo debug registra eventos en:

- consola
- panel "Diagnostico" dentro del taskpane
- hoja oculta `DT_DebugLog`

## Hojas usadas por el add-in

- Visible: `Arbol_Decision`
- Oculta: `DT_Calculos`
- Muy oculta: `DT_Data`
- Oculta en debug: `DT_DebugLog`
