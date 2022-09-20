import { DMMF } from '@prisma/generator-helper';
import { Model, Models } from '../types';
import { camelize, capitalize } from './camelCase';

export const generateJson = async (
  document: DMMF.Document,
  existingModels: Models = {},
  camelCase = false
): Promise<Models> => {
  const parseName = <T = string | null>(
    name: T,
    defaultValue: T,
    capitalizeName = false
  ): T => {
    if (camelCase && name && typeof name === 'string') {
      const newName = (capitalizeName ? capitalize(name) : camelize(name)) as T;

      if (newName !== name) {
        return newName;
      }
    }

    return defaultValue;
  };

  let config = document.datamodel.models.reduce(
    (acc: Models, { name, dbName, fields }) => {
      const existingModel: Model = acc[name.toString()];
      const hasMap = !!dbName;

      const relationFields: Record<string, string | null> =
        existingModel?.relationFields || {};

      const fieldsReducer = fields.reduce(
        (
          fieldsAcc,
          { name, relationName, relationFromFields, relationToFields }
        ) => {
          if (relationName || relationFromFields || relationToFields) {
            relationFields[name.toString()] = parseName(
              name.toString(),
              relationFields[name.toString()] || null,
              true
            );
            return fieldsAcc;
          }

          return {
            ...fieldsAcc,
            [name]: parseName(
              name.toString(),
              fieldsAcc[name.toString()] || null
            )
          };
        },
        (existingModel?.fields as Record<string, string | null>) || {}
      );

      return {
        ...acc,
        [name]: {
          ...(!hasMap && {
            name: parseName(name, existingModel?.name || null, true)
          }),
          hasMap,
          fields: fieldsReducer,
          relationFields
        }
      };
    },
    existingModels
  );

  config = document.datamodel.enums.reduce(
    (acc: Models, { dbName, name, values }) => {
      const existingEnum = acc[name.toString()];
      const hasMap = !!dbName;

      return {
        ...acc,
        [name]: {
          ...(!hasMap && {
            name: parseName(
              existingEnum?.name,
              existingEnum?.name || null,
              true
            )
          }),
          hasMap,
          fields: values.reduce(
            (valuesAcc: Record<string, string | null>, value) => {
              const valueName = value.dbName || value.name;
              return {
                ...valuesAcc,
                [valueName]: parseName(
                  value.dbName ? value.name : valueName,
                  valuesAcc[valueName.toString()] ||
                    (value.dbName ? value.name : null) ||
                    null,
                  true
                )
              };
            },
            (existingEnum?.fields as Record<string, string | null>) || {}
          )
        }
      };
    },
    config
  );

  return config;
};
