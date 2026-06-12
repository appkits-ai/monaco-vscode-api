import "./style.css";
import { startAppKitsWorkbench } from "./appkits-workbench";

const container = document.getElementById("workbench");
if (!container) throw new Error("Missing #workbench");

void startAppKitsWorkbench(container).catch((error) => {
  document.body.dataset.failed = "true";
  container.textContent =
    error instanceof Error ? error.message : "Unable to start VS Code.";
});
