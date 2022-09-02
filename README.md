# prisma-mapper

A CLI that adds @map and @@map based on a json

### Getting Started

If the prisma schema is often pulled you can use the cli like

```bash
yarn prisma db pull --force
  && yarn prisma-mapper generate
  && yarn prisma-mapper map
  && yarn prisma generate
```

With db pull force you get the latest schema updates and
force overwrites the file.

The generate command creates a json called `prisma-mapper.json` in the root,
if the json already exists it adds in it any new fields/models.

```bash
yarn prisma-mapper generate
```

The json looks like the following:

- The hasMap is added by generate if the prisma model has already a `@@map`
- The name is to add @@map for a model name
- In the fields object is to add @map for each field

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

Both 2 commands have an option `--schema "new schema path" to use the schema from a different location
