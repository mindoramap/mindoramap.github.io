import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import { initializeTheme } from "./lib/theme";
import "./styles.css";

initializeTheme();

const router = getRouter();
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
