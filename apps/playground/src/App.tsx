import { OpenAPITsRestEditor } from "@/components/open-api-ts-rest-editor";

import { ModeToggle } from "./components/mode-toggle";

function App(): JSX.Element {
  return (
    <>
      <header className="px-8 my-4 flex justify-between items-center">
        <h1 className="text-xl">OpenAPI to Ts Rest Contract</h1>
        <ModeToggle />
      </header>
      <OpenAPITsRestEditor />;
    </>
  );
}

export default App;
