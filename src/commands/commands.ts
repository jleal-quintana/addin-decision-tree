Office.onReady(() => {
  // Commands registration
});

function showTaskpane(event: Office.AddinCommands.Event) {
  Office.addin.showAsTaskpane();
  event.completed();
}

(globalThis as any).showTaskpane = showTaskpane;
