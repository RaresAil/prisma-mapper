import { printGeneratorConfig } from '@prisma/engine-core';
import {
  GeneratorConfig,
  ConnectorType,
  DataSource,
  EnvValue,
  DMMF
} from '@prisma/generator-helper';

import { ExtendedModel, Element } from '../types';

type Attribute = Omit<
  DMMF.Field,
  'name' | 'kind' | 'type' | 'isRequired' | 'isList'
>;

// ? MODELS

const handlers = (
  type: string,
  kind: DMMF.FieldKind
): Record<string, { (value: Attribute): string | void }> => {
  return {
    default: (value: Attribute) => {
      if (kind === 'enum') {
        return `@default(${value})`;
      }

      if (type === 'Boolean') {
        return `@default(${value})`;
      }

      if (!value) {
        return '';
      }

      if (typeof value === 'object') {
        return `@default(${value.name}(${value.args
          .map((arg: string) => `"${arg}"`)
          .join(', ')}))`;
      }

      if (typeof value === 'number') {
        return `@default(${value})`;
      }

      if (typeof value === 'string') {
        return `@default("${value}")`;
      }

      throw new Error(`Unsupported field attribute ${value}`);
    },
    isId: (value: Attribute) => (value ? '@id' : ''),
    isUnique: (value: Attribute) => (value ? '@unique' : ''),
    isUpdatedAt: (value: Attribute) => (value ? '@updatedAt' : ''),
    columnName: (value: Attribute) => (value ? `@map("${value}")` : '')
  };
};

function handleAttributes(
  attributes: Attribute,
  kind: DMMF.FieldKind,
  type: string,
  modelName: string
) {
  const { relationFromFields, relationToFields, relationName } = attributes;
  if (kind === 'scalar') {
    return `${Object.keys(attributes)
      .map((each) => {
        const handler = handlers(type, kind)[each.toString()];
        if (!handler) {
          return '';
        }

        return handler(attributes[each.toString()]);
      })
      .join(' ')}`;
  }

  if (kind === 'object' && relationFromFields) {
    const includeRelationName = type === modelName;

    const relName = includeRelationName ? `name: "${relationName}", ` : '';

    if (relationFromFields.length > 0) {
      return `@relation(${relName}fields: [${relationFromFields}], references: [${relationToFields}])`;
    }

    return `@relation(${relName})`;
  }

  if (kind === 'enum') {
    return `${Object.keys(attributes)
      .map((each) => {
        const handler = handlers(type, kind)[each.toString()];
        if (!handler) {
          return '';
        }

        return handler(attributes[each.toString()]);
      })
      .join(' ')}`;
  }

  return '';
}

function handleFields(modelName: string, fields: DMMF.Field[]) {
  return fields
    .map((field) => {
      const { name, kind, type, isRequired, isList, ...attributes } = field;
      if (kind === 'scalar') {
        return `  ${name} ${type}${isRequired ? '' : '?'} ${handleAttributes(
          attributes,
          kind,
          type,
          modelName
        )}`;
      }

      if (kind === 'object') {
        return `  ${name} ${type}${
          isList ? '[]' : isRequired ? '' : '?'
        } ${handleAttributes(attributes, kind, type, modelName)}`;
      }

      if (kind === 'enum') {
        return `  ${name} ${type}${
          isList ? '[]' : isRequired ? '' : '?'
        } ${handleAttributes(attributes, kind, type, modelName)}`;
      }

      throw new Error(`Unsupported field kind "${kind}"`);
    })
    .join('\n');
}

function handleDbName(dbName: string | null) {
  return dbName ? `\n@@map("${dbName}")` : '';
}

function handleModelElements(elements?: Element[]) {
  if (!elements) {
    return '';
  }

  return `\n${elements
    .map((element) => {
      let params: string[] = [];

      if (element.arrayArg) {
        params = [...params, `[${element.arrayArg.join(', ')}]`];
      }

      if (element.params) {
        params = [
          ...params,
          ...Object.entries(element.params).map(
            ([key, value]) => `${key}: ${value}`
          )
        ];
      }

      const stringParams = params.length ? `(${params.join(', ')})` : '';

      return `${element.name}${stringParams}`;
    })
    .join('\n')}`;
}

function deserializeModel(model: ExtendedModel) {
  const { name, dbName, fields, elements } = model;

  const output = `
model ${name} {
${handleFields(name, fields)}
${handleDbName(dbName)}${handleModelElements(elements)}
}`;

  return output;
}

// ? ENUMS

function deserializeEnum({ name, values, dbName }: DMMF.DatamodelEnum) {
  const outputValues = values.map(({ name, dbName }) => {
    let result = name;
    if (name !== dbName && dbName) result += `@map("${dbName}")`;
    return result;
  });
  return `
enum ${name} {
  ${outputValues.join('\n\t')}
  ${handleDbName(dbName || null)}
}`;
}

// ? DATA SOURCE

function handleUrl(envValue: EnvValue) {
  const value = envValue.fromEnvVar
    ? `env("${envValue.fromEnvVar}")`
    : envValue.value;

  return `url = ${value}`;
}

function handleProvider(provider: ConnectorType | string) {
  return `provider = "${provider}"`;
}

function deserializeDatasource(datasource: DataSource) {
  const { activeProvider: provider, name, url } = datasource;

  return `
datasource ${name} {
  ${handleProvider(provider)}
  ${handleUrl(url)}
}`;
}

// ? Exports

export async function deserializeModels(models: DMMF.Model[]) {
  return models.map((model) => deserializeModel(model)).join('\n');
}

export function deserializeDatasources(datasources: DataSource[]) {
  return datasources
    .map((datasource) => deserializeDatasource(datasource))
    .join('\n');
}

export async function deserializeGenerators(generators: GeneratorConfig[]) {
  return generators
    .map((generator) => printGeneratorConfig(generator))
    .join('\n');
}

export async function deserializeEnums(enums: DMMF.DatamodelEnum[]) {
  return enums.map((each) => deserializeEnum(each)).join('\n');
}
