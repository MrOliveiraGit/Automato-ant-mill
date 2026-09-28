/// <reference types="vite/client" />
import { marked } from "marked";
import markedKatex from "marked-katex-extension";
import "katex/dist/katex.min.css";
import source from "../REPORT.md?raw";

// nonStandard: aceita $…$ colado a pontuação, como em "($g=0$)"
marked.use(markedKatex({ throwOnError: false, nonStandard: true }));

document.getElementById("report")!.innerHTML = marked.parse(source, {
  async: false,
});
