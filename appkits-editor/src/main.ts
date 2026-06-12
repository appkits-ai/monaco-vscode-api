import "./style.css";
import { EditorController } from "./editor-controller";
import { openFileFromHostMessage, openFileFromLaunchParams } from "./launch-params";
import { AppKitsBridge } from "./appkits-bridge";
import { WorkspaceBrowser } from "./workspace-browser";

const elements = {
  host: requiredElement("editor"),
  emptyState: requiredElement("empty"),
  fileName: requiredElement("file-name"),
  filePath: requiredElement("file-path"),
  status: requiredElement("status"),
  saveButton: requiredElement("save") as HTMLButtonElement,
  filesButton: requiredElement("files") as HTMLButtonElement,
  drawer: requiredElement("file-drawer"),
  drawerBackdrop: requiredElement("drawer-backdrop"),
  tree: requiredElement("file-tree"),
};

const bridge = new AppKitsBridge();
const controller = new EditorController({ bridge, elements });
const browser = new WorkspaceBrowser({
  bridge,
  elements: {
    filesButton: elements.filesButton,
    drawer: elements.drawer,
    backdrop: elements.drawerBackdrop,
    tree: elements.tree,
  },
  onOpenFile: (file) => void controller.open(file),
});

window.addEventListener("message", (event) => {
  const openFile = openFileFromHostMessage(event.data);
  if (openFile) {
    browser.select(openFile.path);
    void controller.open(openFile);
  }
});

window.addEventListener("beforeunload", () => {
  controller.dispose();
  bridge.dispose();
});

bridge.postReady();
void bootstrap();

async function bootstrap(): Promise<void> {
  const openFile = openFileFromLaunchParams(await bridge.launchParams().catch(() => ({})));
  if (openFile) {
    browser.select(openFile.path);
    await controller.open(openFile);
    return;
  }
  await browser.open();
}

function requiredElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element;
}
