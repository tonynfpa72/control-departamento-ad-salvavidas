import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Dos entradas: la app del personal (index.html) y la app de
      // clientes (cliente.html, la que usa el APK de clientes).
      input: {
        main: resolve(__dirname, "index.html"),
        cliente: resolve(__dirname, "cliente.html"),
      },
    },
  },
});
