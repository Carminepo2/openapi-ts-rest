# openapi-ts-rest

![NPM Version](https://img.shields.io/npm/v/%40openapi-ts-rest%2Fcore)
[![CI](https://github.com/Carminepo2/openapi-ts-rest/actions/workflows/ci.yml/badge.svg)](https://github.com/Carminepo2/openapi-ts-rest/actions/workflows/ci.yml)

> [!WARNING]  
> This project is still in development and is not ready for production use, there may be bugs, missing features and breaking changes.
> Use at your own risk.

<p align="center">
  <img src="./assets/images/openapi-ts-rest-avatar-light.png" />
</p>

A simple tool to generate a [ts-rest](https://github.com/ts-rest/ts-rest) contract (with zod validation) from an OpenAPI 3.0/3.1 specification.

## Installation 📦

You can use `openapi-ts-rest` in two ways: as a CLI tool or as a core library within your code.

### CLI Installation

```sh
pnpm add @openapi-ts-rest/cli
```

### Core Library Installation

```sh
pnpm add @openapi-ts-rest/core
```

## Usage 🚀

### CLI Usage

```sh
# If installed globally
openapi-ts-rest path/to/openapi-spec.yaml -o path/to/output/dir
# If installed in a project
npx openapi-ts-rest path/to/openapi-spec.yaml -o path/to/output/dir
```

- `-o`, `--output`: Directory where the generated TypeScript files will be saved.

### Core Library Usage

If you prefer to integrate the functionality directly into your code, you can do so with the core library:

```typescript
import { generateContract, GenerateContractOptions } from "@openapi-ts-rest/core";
import fs from "fs";

const result = await generateContract({ openApi: "path/to/openapi-spec.yaml" });
fs.writeFileSync("path/to/output/dir", result);
```

## Features ✨

- **OpenAPI 3.0/3.1 Support**: Full support for the latest OpenAPI specifications.
- **Flexible Usage**: Use the CLI for quick operations or the core library for deeper integration.
- **Zod Schema Generation**: Automatically generate Zod schemas for runtime validation.

## Contributing 🤝

Contributions are welcome! Please open an issue or submit a pull request on GitHub.

## Special Thanks 🙏

This project is heavily inspired by [openapi-zod-client](https://github.com/astahmer/openapi-zod-client).
Special thanks to the author for their work!
