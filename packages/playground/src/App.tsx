import Editor from "@monaco-editor/react";
import { generateTsRestContractFromOpenAPI } from "@openapi-to-ts-rest/core";
import { useEffect, useState } from "react";
import jsYaml from "js-yaml";

function App(): JSX.Element {
  const [value, setValue] = useState(editorDefaultValue);

  return (
    <div className="flex">
      <div className="flex-1">
        <Editor
          height="100vh"
          value={value}
          onChange={(v) => setValue(v ?? "")}
          defaultLanguage="yaml"
          theme="vs-dark"
          defaultValue={editorDefaultValue}
        />
      </div>
      <div className="flex-1">
        <Output value={value} />
      </div>
    </div>
  );
}

export default App;

function Output({ value }: { value: string }): JSX.Element {
  const [output, setOutput] = useState("");
  useEffect(() => {
    async function test(): Promise<void> {
      try {
        const specObj = jsYaml.load(value);

        const result = await generateTsRestContractFromOpenAPI({
          input: specObj as unknown as string,
        });

        setOutput(result);
      } catch (e) {
        if (e instanceof Error) {
          setOutput(e.message);
          return;
        }
        setOutput("An error occurred");
      }
    }
    void test();
  }, [value]);

  return (
    <Editor
      height="100vh"
      value={output}
      defaultLanguage="typescript"
      theme="vs-dark"
      options={{ readOnly: true }}
    />
  );
}

const editorDefaultValue = `openapi: 3.0.2
paths:
  /push-signal:
    post:
      summary: Push Signal
      tags: []
      parameters:
        - name: authorization
          in: header
          required: true
          schema:
            type: string
      requestBody:
        description: Body
        content:
          application/json:
            schema:
              type: object
              properties:
                signalType:
                  type: string
                  enum:
                    - CREATE
                    - UPDATE
                    - DELETE
                    - SEEDUPDATE
                objectId:
                  type: string
                eserviceId:
                  type: string
                signalId:
                  type: number
              required:
                - signalType
                - objectId
                - eserviceId
                - signalId
      responses:
        '200':
          description: '200'
          content:
            application/json:
              schema:
                type: object
                properties:
                  signalId:
                    type: number
                required:
                  - signalId
        '400':
          description: '400'
        '401':
          description: '401'
        '403':
          description: '403'
        '429':
          description: '429'
info:
  title: Push signal Service API
  version: '1.0'

`;
