import { printGeneratorConfig } from '@prisma/engine-core';
import colors from 'colors/safe';
import {
  GeneratorConfig,
  ConnectorType,
  DataSource,
  EnvValue,
  DMMF
} from '@prisma/generator-helper';

import { ExtendedModel, Element, FieldMeta } from '../types';
import Config from '../index';

// ? MODELS

const getParamsForElement = (
  hasIt: boolean,
  name: string,
  elements?: Element[]
) => {
  const element = elements?.find((element) => element.name === name);
  const params = element?.stringParams ? `(${element.stringParams})` : '';

  return hasIt ? `${name}${params}` : '';
};

const handlers = (
  type: string,
  kind: DMMF.FieldKind,
  elements?: Element[]
): Record<
  string,
  { (value: unknown | Record<string, unknown>): string | void }
> => {
  return {
    default: (value) => {
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
        return `@default(${(value as Record<string, string>).name}(${(
          value as Record<string, string[]>
        ).args
          .map((arg: string) => `"${arg}"`)
          .join(', ')}))`;
      }

      if (typeof value === 'number') {
        return `@default(${value})`;
      }

      if (typeof value === 'string') {
        return `@default("${value}")`;
      }

      console.log(
        colors.yellow(Config.logPrefix),
        'Unsupported field attribute',
        colors.red(value.toString())
      );

      return '';
    },
    isId: (value) => getParamsForElement(!!value, '@id', elements),
    isUnique: (value) => getParamsForElement(!!value, '@unique', elements),
    isUpdatedAt: (value) => (value ? '@updatedAt' : ''),
    columnName: (value) => (value ? `@map("${value}")` : '')
  };
};

function handleAttributes(
  attributes: DMMF.Field,
  kind: DMMF.FieldKind,
  type: string,
  modelName: string,
  fieldMeta?: FieldMeta,
  elements?: Element[]
) {
  const {
    relationFromFields,
    relationToFields,
    relationName,
    relationOnDelete,
    name
  } = attributes;

  const fieldElements = elements?.filter((element) => element.isField === name);

  if (kind === 'scalar') {
    return `${Object.keys(attributes)
      .map((each) => {
        const handler = handlers(type, kind, fieldElements)[each.toString()];
        if (!handler) {
          return '';
        }

        return handler(attributes[each.toString()]);
      })
      .join(' ')}`;
  }

  if (kind === 'object' && relationFromFields) {
    const includeRelationName = type === modelName;

    const relName = includeRelationName ? `"${relationName}", ` : '';
    const onDelete = relationOnDelete ? `onDelete: ${relationOnDelete}` : '';
    const onUpdate = fieldMeta?.relationOnUpdate
      ? `onUpdate: ${fieldMeta.relationOnUpdate}`
      : '';

    const relations = [onDelete, onUpdate].filter((each) => each).join(', ');

    if (relationFromFields.length > 0) {
      return `@relation(${relName}fields: [${relationFromFields}], references: [${relationToFields}], ${relations})`;
    }

    if (relName === '') {
      return '';
    }

    return `@relation(${relName}${relations})`;
  }

  if (kind === 'enum') {
    return `${Object.keys(attributes)
      .map((each) => {
        const handler = handlers(type, kind, fieldElements)[each.toString()];
        if (!handler) {
          return '';
        }

        return handler(attributes[each.toString()]);
      })
      .join(' ')}`;
  }

  return '';
}

function handleFields(
  modelName: string,
  fields: DMMF.Field[],
  fieldsMeta?: Record<string, FieldMeta>,
  elements?: Element[]
) {
  return fields
    .map((field) => {
      const { name, kind, type, isRequired, isList } = field;

      const fieldMeta = fieldsMeta?.[name.toString()];
      const dbTypeString = fieldMeta?.dbTypes?.join(' ') || '';

      if (kind === 'scalar') {
        return `  ${name} ${type}${
          isRequired ? '' : '?'
        } ${dbTypeString} ${handleAttributes(
          field,
          kind,
          type,
          modelName,
          fieldMeta,
          elements
        )}`;
      }

      if (kind === 'object') {
        return `  ${name} ${type}${
          isList ? '[]' : isRequired ? '' : '?'
        } ${dbTypeString} ${handleAttributes(
          field,
          kind,
          type,
          modelName,
          fieldMeta,
          elements
        )}`;
      }

      if (kind === 'enum') {
        return `  ${name} ${type}${
          isList ? '[]' : isRequired ? '' : '?'
        } ${dbTypeString} ${handleAttributes(
          field,
          kind,
          type,
          modelName,
          fieldMeta,
          elements
        )}`;
      }

      console.log(
        colors.yellow(Config.logPrefix),
        'Unsupported field kind',
        colors.red(kind.toString())
      );

      return '';
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
  const { name, dbName, fields, elementsParent } = model;

  const output = `
model ${name} {
${handleFields(
  name,
  fields,
  elementsParent?.fields,
  elementsParent?.elements?.filter((element) => element.isField)
)}
${handleDbName(dbName)}${handleModelElements(
    elementsParent?.elements?.filter((element) => !element.isField)
  )}
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
