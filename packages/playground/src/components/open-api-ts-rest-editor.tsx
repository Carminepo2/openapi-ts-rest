import Editor from "@monaco-editor/react";
import { useState } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "./ui/resizable";
import { useTheme } from "./theme-provider";
import { editorDefaultValue } from "@/lib/constants";
import { getThemeFromSystem } from "@/lib/utils";
import { useOpenAPITsRest } from "@/hooks/useOpenAPITsRest";

type VsCodeTheme = "vs-dark" | "light";

function getVsCodeTheme(theme: string): VsCodeTheme {
  const actualTheme = theme === "system" ? getThemeFromSystem() : theme;
  return actualTheme === "dark" ? "vs-dark" : "light";
}

export function OpenAPITsRestEditor(): JSX.Element {
  const [value, setValue] = useState(editorDefaultValue);
  const { theme } = useTheme();

  const vsTheme = getVsCodeTheme(theme);

  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel>
        <OpenAPIDocumentInput theme={vsTheme} value={value} onChange={setValue} />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel>
        <TsRestContractOutput theme={vsTheme} openAPIDoc={value} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function OpenAPIDocumentInput({
  value,
  onChange,
  theme,
}: {
  value: string;
  onChange: (v: string) => void;
  theme: VsCodeTheme;
}): JSX.Element {
  return (
    <Editor
      height="100vh"
      value={value}
      onChange={(v) => onChange(v ?? "")}
      defaultLanguage="yaml"
      theme={theme}
      defaultValue={editorDefaultValue}
    />
  );
}

function TsRestContractOutput({
  openAPIDoc,
  theme,
}: {
  openAPIDoc: string;
  theme: VsCodeTheme;
}): JSX.Element {
  const { data, error } = useOpenAPITsRest(openAPIDoc);

  const value = error ? error?.message : data;
  const language = error ? "text" : "typescript";

  return (
    <Editor
      height="100vh"
      value={value}
      language={language}
      theme={theme}
      options={{ readOnly: true }}
    />
  );
}
