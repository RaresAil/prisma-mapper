# prisma-mapper

[![CodeQL](https://github.com/RaresAil/prisma-mapper/actions/workflows/codeql.yml/badge.svg?branch=master)](https://github.com/RaresAil/prisma-mapper/actions/workflows/codeql.yml)
[![Node.js CI](https://github.com/RaresAil/prisma-mapper/actions/workflows/node.js.yml/badge.svg)](https://github.com/RaresAil/prisma-mapper/actions/workflows/node.js.yml)
[![Yarn Audit CI](https://github.com/RaresAil/prisma-mapper/actions/workflows/audit.yml/badge.svg)](https://github.com/RaresAil/prisma-mapper/actions/workflows/audit.yml)

![NPM Package Downloads](https://badgen.net/npm/dm/prisma-mapper)

A CLI that adds @map and @@map based on a json

### Features

- Adds `@map` and `@@map`
- Keeps the `@db.` attributes for fields
- Adds the `@updatedAt` for fields with the name `updated_at` or `updatedAt`
- The prisma schema is formatted by the `@prisma/internals` after generation
- The cli does not modify the current schema and generates a new one with the information from the current one

### Node Versions

| Version  | Supported |
| -------- | --------- |
| ^14.15.0 | ✅        |
| 15.x     | ❌        |
| ^16.10.0 | ✅        |
| 17.x     | ❌        |
| 18.x     | ✅        |
| 19.x     | ✅        |
| 20.x     | ✅        |

### Getting Started

If the prisma schema is often pulled you can use the cli like

```bash
yarn prisma db pull --force
  && yarn prisma-mapper generate
  && yarn prisma-mapper map
  && yarn prisma generate
```

or for `camelCase` by default

```bash
yarn prisma db pull --force
  && yarn prisma-mapper map --camel
  && yarn prisma generate
```

With db pull force you get the latest schema updates and
force overwrites the file.

The generate command creates a json called `prisma-mapper.json` in the root,
if the json already exists it adds in it any new fields/models. **`(NOT FOR --camel option)`**

```bash
yarn prisma-mapper generate
```

The json looks like the following:

- The hasMap is added by generate if the prisma model has already a `@@map`
- The name is to add `@@map` for a model name
- In the fields object is to add `@map` for each field

```json
{
  "model": {
    "hasMap": false,
    "name": null,
    "fields": {
      "field_name_1": null,
      "field_name_2": null
    }
  }
}
```

The map command modifies the `schema.prisma` file and adds the `@map` and `@@map`
for each field and model, if the field/model-name is in the json file, the
field/model will be renamed to the new name.

```bash
yarn prisma-mapper map
```

### Options

Both 2 commands have an option `--schema "new schema path` to use the schema from a different location

#### For both commands

- `--schema "new schema path`
  - is to use the schema from a different location
- `--camel`
  - for map it does the mapping without a json file
  - for generate it defaults the namings to camel case in the generated json

#### Map options

- `-o --output "output schema path"`
  - after mapping save the schema to another location
