import "./style.css";
import { EditorController } from "./editor-controller";
import { AppKitsBridge } from "./appkits-bridge";

const elements = {
  host: requiredElement("editor"),
  tree: requiredElement("file-tree"),
  fileName: requiredElement("file-name"),
  filePath: requiredElement("file-path"),
  workspacePath: requiredElement("workspace-path"),
  status: requiredElement("status"),
  saveButton: requiredElement("save") as HTMLButtonElement,
  refreshButton: requiredElement("refresh") as HTMLButtonElement,
};

const bridge = new AppKitsBridge(window);
const controller = new EditorController({ bridge, elements });

void controller.initialize();

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
