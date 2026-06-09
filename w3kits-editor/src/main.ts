import "./style.css";
import { EditorController } from "./editor-controller";
import { openFileFromHostMessage } from "./launch-params";
import { W3KitsBridge } from "./w3kits-bridge";

const elements = {
  host: requiredElement("editor"),
  emptyState: requiredElement("empty"),
  fileName: requiredElement("file-name"),
  filePath: requiredElement("file-path"),
  status: requiredElement("status"),
  saveButton: requiredElement("save") as HTMLButtonElement,
};

const bridge = new W3KitsBridge(window);
const controller = new EditorController({ bridge, elements });

window.addEventListener("message", (event) => {
  const openFile = openFileFromHostMessage(event.data);
  if (openFile) void controller.open(openFile);
});

window.addEventListener("beforeunload", () => {
  controller.dispose();
  bridge.dispose();
});

bridge.postReady();

function requiredElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element;
}
