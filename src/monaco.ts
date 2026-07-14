import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";

type MonacoGlobal = typeof globalThis & {
  MonacoEnvironment: {
    getWorker: (_moduleId: string, label: string) => Worker;
  };
};

(self as MonacoGlobal).MonacoEnvironment = {
  getWorker: (_moduleId, label) =>
    label === "json" ? new JsonWorker() : new EditorWorker(),
};

loader.config({ monaco });
