import { captureResetToken } from "./lib/recovery";
captureResetToken();
window.addEventListener("hashchange", captureResetToken);
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
