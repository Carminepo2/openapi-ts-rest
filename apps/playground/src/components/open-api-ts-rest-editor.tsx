import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useOpenAPITsRest } from "@/hooks/useOpenAPITsRest";
import { editorDefaultValue } from "@/lib/constants";
import { getThemeFromSystem } from "@/lib/utils";
import Editor from "@monaco-editor/react";

import { useTheme } from "./theme-provider";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./ui/resizable";

type VsCodeTheme = "light" | "vs-dark";

function getVsCodeTheme(theme: string): VsCodeTheme {
  const actualTheme = theme === "system" ? getThemeFromSystem() : theme;
  return actualTheme === "dark" ? "vs-dark" : "light";
}

export function OpenAPITsRestEditor(): JSX.Element {
  const [value, setValue] = useLocalStorage("open-api-doc", editorDefaultValue);
  const vsTheme = getVsCodeTheme(useTheme().theme);

  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel>
        <OpenAPIDocumentInput onChange={setValue} theme={vsTheme} value={value} />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel>
        <TsRestContractOutput openAPIDoc={value} theme={vsTheme} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function OpenAPIDocumentInput({
  onChange,
  theme,
  value,
}: {
  onChange: (v: string) => void;
  theme: VsCodeTheme;
  value: string;
}): JSX.Element {
  return (
    <>
      <div aria-hidden="true" className="hidden" data-cy="input">
        {value}
      </div>
      <Editor
        defaultLanguage="yaml"
        height="100vh"
        onChange={(v) => onChange(v ?? "")}
        theme={theme}
        value={value}
      />
    </>
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

  const value = error ? JSON.stringify({ error: error?.message }, null, 2) : data;
  const language = error ? "json" : "typescript";

  return (
    <>
      <div aria-hidden="true" className="hidden" data-cy="output">
        {value}
      </div>
      <Editor
        height="100vh"
        language={language}
        options={{ readOnly: true }}
        theme={theme}
        value={value}
      />
    </>
  );
}
