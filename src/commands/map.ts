import { getConfig, getDMMF, formatSchema } from '@prisma/internals';
import { DMMF } from '@prisma/generator-helper';
import colors from 'colors/safe';
import nodePath from 'path';
import fs from 'fs';

import { ExtendedField, ExtendedModel, Models } from '../types';
import { getModelElements } from '../functions/getModelElements';
import { program } from '../commands';
import Config from '../index';
import {
  deserializeDatasources,
  deserializeGenerators,
  deserializeModels,
  deserializeEnums
} from '../functions/deserialize';

export default () => {
  program
    .command('map')
    .description(
      'Adds the @map and @@map to the prisma schema based on prisma-mapper.json'
    )
    .action(async () => {
      const { schema, output } = program.opts();

      const prismaPath = nodePath.normalize(
        nodePath.join(Config.userDir || '', schema)
      );

      const prismaOutputPath = output
        ? nodePath.normalize(nodePath.join(Config.userDir || '', output))
        : prismaPath;

      if (!schema.endsWith('.prisma') || !fs.existsSync(prismaPath)) {
        console.log(
          colors.red(Config.logPrefix),
          'No prisma schema found at',
          colors.red(prismaPath),
          '\n'
        );
        return;
      }

      let nowTime = Date.now();
      const start = nowTime;

      console.log(
        colors.cyan(Config.logPrefix),
        'Mapping schema',
        colors.cyan(schema)
      );

      const jsonModels: Models = JSON.parse(
        fs
          .readFileSync(
            nodePath.join(Config.userDir || '', 'prisma-mapper.json')
          )
          .toString('utf8')
      );

      const datamodel = fs.readFileSync(prismaPath, 'utf-8');

      console.log(
        colors.cyan(Config.logPrefix),
        'Parsing schema indexes',
        colors.green(`+${Date.now() - nowTime}ms`)
      );
      nowTime = Date.now();
      const modelElements = await getModelElements(datamodel);

      console.log(
        colors.cyan(Config.logPrefix),
        'Parsing schema models',
        colors.green(`+${Date.now() - nowTime}ms`)
      );
      nowTime = Date.now();
      const dmmf = await getDMMF({ datamodel });

      console.log(
        colors.cyan(Config.logPrefix),
        'Parsing schema config',
        colors.green(`+${Date.now() - nowTime}ms`)
      );
      nowTime = Date.now();
      const { datasources, generators } = await getConfig({
        datamodel,
        ignoreEnvVarErrors: true
      });

      const { models, enums } = dmmf.datamodel;

      console.log(
        colors.cyan(Config.logPrefix),
        'Mapping schema models',
        colors.green(`+${Date.now() - nowTime}ms`)
      );
      nowTime = Date.now();
      const mappedModels = models.map((model: ExtendedModel) => {
        model.elements = modelElements[model.name];

        const jsonModel = jsonModels[model.dbName || model.name];
        if (!jsonModel) {
          return model;
        }

        if (!jsonModel.hasMap && !!jsonModel.name) {
          model.dbName = model.name;
          model.name = jsonModel.name;
        }

        if (model.elements) {
          model.elements = model.elements.map((element) => {
            if (element.arrayArg) {
              element.arrayArg = element.arrayArg.map((arg) => {
                const fieldData = Object.entries(jsonModel.fields).find(
                  ([key]) => arg.includes(key)
                );

                if (!fieldData?.[1]) {
                  return arg;
                }

                return arg.replace(fieldData[0], fieldData[1]);
              });
            }

            return element;
          });
        }

        model.uniqueFields = model.uniqueFields.map((fields) =>
          fields.map((field) => {
            return jsonModel.fields[field.toString()] || field;
          })
        );

        if (model.primaryKey?.fields) {
          model.primaryKey.fields = model.primaryKey.fields.map((field) => {
            return jsonModel.fields[field.toString()] || field;
          });
        }

        model.fields = (model.fields as ExtendedField[]).map((field) => {
          const { name, kind, type, relationFromFields, relationToFields } =
            field;
          const typeModel = jsonModels[type.toString()];

          if (kind === 'object' && typeModel?.name) {
            field.type = typeModel.name;
          }

          if (kind === 'enum') {
            if (!typeModel?.hasMap && typeModel?.name) {
              field.type = typeModel.name;
            }

            if (field.default) {
              field.default =
                (typeModel.fields[
                  field.default.toString()
                ] as unknown as DMMF.FieldDefault) || field.default;
            }
          }

          if (
            kind === 'object' &&
            relationFromFields &&
            relationFromFields.length > 0 &&
            relationToFields
          ) {
            field.relationFromFields = relationFromFields.map((field) => {
              return jsonModel.fields[field.toString()] || field;
            });

            field.relationToFields = relationToFields.map((field) => {
              return typeModel.fields[field.toString()] || field;
            });
          }

          if (field.name === 'updated_at') {
            field.isUpdatedAt = true;
          }

          const newName = jsonModel.fields[name.toString()];
          if (!newName) {
            return field;
          }

          field.name = newName;
          field.columnName = name;

          return field;
        });

        return model;
      });

      const mappedEnums = enums.map((enumModel) => {
        const jsonModel = jsonModels[enumModel.dbName || enumModel.name];
        if (!jsonModel) {
          return enumModel;
        }

        if (!jsonModel.hasMap && !!jsonModel.name) {
          enumModel.dbName = enumModel.name;
          enumModel.name = jsonModel.name;
        }

        enumModel.values = enumModel.values.map((value) => {
          const newName = jsonModel.fields[value.dbName || value.name];

          if (newName) {
            value.dbName = value.name;
            value.name = newName;
          }

          return value;
        });

        return enumModel;
      });

      console.log(
        colors.cyan(Config.logPrefix),
        'Deserializing schema',
        colors.green(`+${Date.now() - nowTime}ms`)
      );

      nowTime = Date.now();
      const outputSchema = await formatSchema({
        schema: (
          await Promise.all([
            deserializeGenerators(generators),
            deserializeDatasources(datasources),
            deserializeModels(mappedModels),
            deserializeEnums(mappedEnums)
          ])
        )
          .filter((e) => e)
          .join('\n\n\n')
      });

      console.log(
        colors.cyan(Config.logPrefix),
        'Saving new schema',
        colors.green(`+${Date.now() - nowTime}ms`)
      );

      nowTime = Date.now();

      fs.writeFileSync(prismaOutputPath, outputSchema);

      console.log(
        colors.green(Config.logPrefix),
        'Schema mapped using',
        colors.cyan('prisma-mapper.json'),
        'in',
        colors.green(`${Date.now() - start}ms`)
      );
    });
};
