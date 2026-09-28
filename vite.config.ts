import { defineConfig } from "vite";

export default defineConfig({
  // caminhos relativos: o site funciona tanto em / quanto no subdiretório do GitHub Pages
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        report: "report.html",
      },
    },
  },
});
