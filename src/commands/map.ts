import { MultipleSchemaTuple } from '@prisma/internals/dist/utils/schemaFileInput';
import { getConfig, getDMMF, formatSchema } from '@prisma/internals';
import { DMMF } from '@prisma/generator-helper';
import { Command } from 'commander';
import colors from 'colors/safe';
import fs from 'fs/promises';
import nodePath from 'path';

import { getElements } from '../functions/getElements';
import { generateJson } from '../functions/generate';
import { IgnoreFileName } from '../consts';
import CLIError from '../CLIError';
import {
  deserializeDatasources,
  deserializeGenerators,
  deserializeModels,
  deserializeEnums
} from '../functions/deserialize';
import Config from '../index';
import Utils from '../Utils';
import {
  ExtendedEnum,
  ExtendedField,
  ExtendedModel,
  IgnoreType,
  Models
} from '../types';

interface ActionOptions {
  output?: string;
  schema: string;
  camel: boolean;
}

export const action = async (
  { schema, output, camel }: ActionOptions,
  disableLogs?: boolean,
  useLegacyExit?: boolean
) => {
  const isSchemaAbs = nodePath.isAbsolute(schema);
  const isOutputAbs = nodePath.isAbsolute(output || '');

  const logInfo =
    (color = colors.gray) =>
    (...args: unknown[]) => {
      if (disableLogs) {
        return;
      }

      console.log(color(Utils.terminalSymbols().info), ...args);
    };

  const logError = (...args: unknown[]) => {
    if (disableLogs) {
      return;
    }

    console.error(colors.red(Utils.terminalSymbols().error), ...args);
  };

  const logSuccess = (...args: unknown[]) => {
    if (disableLogs) {
      return;
    }

    Utils.clearPrevLine(6);
    console.log(colors.green(Utils.terminalSymbols().success), ...args);
  };

  const logSuccessStep = (part: string) => {
    if (disableLogs) {
      return;
    }

    Utils.clearPrevLine();
    console.log(
      colors.gray(Utils.terminalSymbols().success),
      colors.gray(part)
    );
  };

  const prismaPath = isSchemaAbs
    ? schema
    : nodePath.normalize(nodePath.join(Config.userDir, schema));

  const ignorePath = nodePath.normalize(
    nodePath.join(Config.userDir, IgnoreFileName)
  );

  const correctOutput = isOutputAbs
    ? output
    : nodePath.normalize(nodePath.join(Config.userDir, output || ''));
  const prismaOutputPath = output ? correctOutput : prismaPath;

  const prismaExists = await Utils.fsExists(prismaPath);
  if (!schema.endsWith('.prisma') || !prismaExists) {
    logError('No Prisma Schema found at', colors.red(prismaPath), '\n');

    if (useLegacyExit) {
      throw new CLIError('No prisma schema found');
    }

    return process.exit(1);
  }

  let nowTime = Date.now();
  const start = nowTime;

  logInfo(colors.blue)('Mapping Schema', colors.gray(schema));

  const datamodel = await fs.readFile(prismaPath, 'utf-8');
  let ignoreFileData: Record<string, string[] | IgnoreType> | null = null;
  try {
    const rawData = await fs.readFile(ignorePath, 'utf-8');
    ignoreFileData = rawData
      .split('\n')
      .reduce((acc: Record<string, string[] | IgnoreType>, current) => {
        const trimmed = current.trim();
        if (!trimmed) {
          return acc;
        }

        const [model, field] = trimmed.split('.');
        let modelAcc: string[] | IgnoreType = acc[model.toString()] || [];

        if (!field) {
          modelAcc = IgnoreType.Model;
        } else if (field === '*') {
          modelAcc = IgnoreType.Fields;
        } else if (Array.isArray(modelAcc)) {
          modelAcc = [...modelAcc, field];
        }

        return {
          ...acc,
          [model]: modelAcc
        };
      }, {});
  } catch {}

  logInfo()(colors.gray('Parsing Schema Indexes'));
  nowTime = Date.now();
  const modelElements = await getElements(datamodel, 'model');
  const enumElements = await getElements(datamodel, 'enum');
  logSuccessStep(`Schema Indexes Parsed ${Date.now() - nowTime}ms`);

  logInfo()(colors.gray('Parsing Schema Models'));
  nowTime = Date.now();
  const dmmf = await getDMMF({ datamodel });

  const readJSONMapper = async (path: string): Promise<string> => {
    const exists = await Utils.fsExists(path);
    if (!exists) {
      logError('No JSON Mapper found at', colors.red(path), '\n');

      if (useLegacyExit) {
        throw new CLIError('No prisma schema found');
      }

      return process.exit(1);
    }

    return fs.readFile(path, 'utf8');
  };

  const jsonModels: Models = !camel
    ? JSON.parse(
        await readJSONMapper(
          nodePath.join(Config.userDir, 'prisma-mapper.json')
        )
      )
    : await generateJson(dmmf, {}, true);

  logSuccessStep(`Schema Models Parsed ${Date.now() - nowTime}ms`);

  logInfo()(colors.gray('Parsing Schema Config'));
  nowTime = Date.now();
  const { datasources, generators } = await getConfig({
    datamodel,
    ignoreEnvVarErrors: true
  });

  const { models, enums } = dmmf.datamodel;

  logSuccessStep(`Schema Config Parsed ${Date.now() - nowTime}ms`);

  logInfo()(colors.gray('Mapping Schema Models'));
  nowTime = Date.now();
  const mappedModels = (models as ExtendedModel[]).map(
    (model: ExtendedModel) => {
      const ignoreData = ignoreFileData?.[model.name.toString()];
      model.elementsParent = modelElements[model.name];

      const jsonModel = jsonModels[model.dbName || model.name];
      if (!jsonModel) {
        return model;
      }

      if (
        ignoreData !== IgnoreType.Model &&
        !jsonModel.hasMap &&
        !!jsonModel.name
      ) {
        model.dbName = model.name;
        model.name = jsonModel.name;
      }

      if (model.elementsParent) {
        model.elementsParent.elements = model.elementsParent.elements.map(
          (element) => {
            if (element.arrayArg) {
              element.arrayArg = element.arrayArg.map((arg) => {
                const fieldData = Object.entries(jsonModel.fields).find(
                  ([key]) => arg === key || arg.includes(`${key}(`)
                );

                if (!fieldData?.[1]) {
                  return arg;
                }

                return arg.replace(fieldData[0], fieldData[1]);
              });
            }

            return element;
          }
        );
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

      const ignoreFields: Record<string, 1> = Array.isArray(ignoreData)
        ? ignoreData.reduce((acc, field) => ({ ...acc, [field]: 1 }), {})
        : {};

      model.fields = (model.fields as ExtendedField[]).map(
        (field: ExtendedField) => {
          const { name, kind, type, relationFromFields, relationToFields } =
            field;
          const typeModel = jsonModels[type.toString()];
          const ignoreField =
            ignoreData === IgnoreType.Model ||
            ignoreData === IgnoreType.Fields ||
            ignoreFields[field.columnName || field.name];

          if (kind === 'object' && typeModel?.name) {
            field.type = typeModel.name;
          }

          if (kind === 'enum') {
            if (!typeModel?.hasMap && typeModel?.name) {
              field.type = typeModel.name;
            }

            if (field.default) {
              (field.default as unknown) =
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

          if (field.name === 'updated_at' || field.name === 'updatedAt') {
            field.isUpdatedAt = true;
          }

          const newName = jsonModel.fields[name.toString()];
          if (!newName) {
            const relationalName = jsonModel.relationFields?.[name.toString()];
            if (relationalName) {
              field.name = relationalName;
              field.columnName = name;
            }

            return field;
          }

          if (!ignoreField) {
            field.name = newName;
            field.columnName = name;
          }

          return field;
        }
      );

      return model;
    }
  );

  const mappedEnums = (enums as ExtendedEnum[]).map(
    (enumModel): ExtendedEnum => {
      const ignoreData = ignoreFileData?.[enumModel.dbName || enumModel.name];

      const jsonModel = jsonModels[enumModel.dbName || enumModel.name];
      const elementsParent = enumElements[enumModel.name];

      if (!jsonModel || ignoreData === IgnoreType.Model) {
        return {
          ...enumModel,
          elementsParent
        };
      }

      if (!jsonModel.hasMap && !!jsonModel.name) {
        enumModel.dbName = enumModel.name;
        enumModel.name = jsonModel.name;
      }

      if (ignoreData !== IgnoreType.Fields) {
        const ignoreFields: Record<string, 1> = Array.isArray(ignoreData)
          ? ignoreData.reduce((acc, field) => ({ ...acc, [field]: 1 }), {})
          : {};
        enumModel.values = enumModel.values.map((value) => {
          if (ignoreFields[value.dbName || value.name]) {
            return value;
          }

          const newName = jsonModel.fields[value.dbName || value.name];
          if (newName) {
            value.dbName = value.name;
            value.name = newName;
          }

          return value;
        });
      }

      return {
        ...enumModel,
        elementsParent
      };
    }
  );

  logSuccessStep(`Schema Models Mapped ${Date.now() - nowTime}ms`);

  logInfo()(colors.gray('Deserializing Schema'));

  nowTime = Date.now();

  const schemaTuple: MultipleSchemaTuple = [
    '',
    (
      await Promise.all([
        deserializeGenerators(generators),
        deserializeDatasources(datasources),
        deserializeModels(mappedModels),
        deserializeEnums(mappedEnums)
      ])
    )
      .filter((e) => e)
      .join('\n\n\n')
  ];

  const outputSchema = await formatSchema({
    schemas: [schemaTuple]
  });

  logSuccessStep(`Schema Deserialized ${Date.now() - nowTime}ms`);

  logInfo()(colors.gray('Saving new Schema'));

  nowTime = Date.now();

  await fs.writeFile(prismaOutputPath as string, outputSchema[0][1]);

  logSuccessStep(`Schema Saved ${Date.now() - nowTime}ms`);

  const timeTilCompletion = Date.now() - start;
  const timeColor = timeTilCompletion > 60 ? colors.red : colors.green;

  logSuccess('Schema mapped in', timeColor(`${timeTilCompletion}ms`));
};

export default (program: Command) => {
  program
    .command('map')
    .description(
      'Adds the @map and @@map to the prisma schema based on prisma-mapper.json or camelCase'
    )
    .action(() => action(program.opts()));
};
