import { formatSchema } from '@prisma/internals';

import { Elements } from '../types';

const SPECIAL_PARAMS = ['@unique', '@id'];

export async function getElements(
  schema: string,
  type: 'model' | 'enum'
): Promise<Record<string, Elements>> {
  const parsedCurrentSchema = await formatSchema({ schema });
  let currentModel = '';
  const elementsParent: Record<string, Elements> = {};

  parsedCurrentSchema.split('\n').forEach((line) => {
    if (currentModel && line.trim().startsWith('@@map')) {
      return;
    }

    if (line.trim().startsWith(`${type} `)) {
      currentModel = line.split(' ')[1];
      elementsParent[currentModel.toString()] = {
        elements: [],
        fields: {}
      };
      return;
    }

    if (line.trim().startsWith('}')) {
      currentModel = '';
      return;
    }

    if (currentModel && line.trim().startsWith('@@')) {
      const trimmedLine = line.trim();
      const name = trimmedLine.split('(')[0];

      let argsPart0 = trimmedLine.replace(`${name}(`, '');
      if (argsPart0.endsWith(')')) {
        argsPart0 = argsPart0.slice(0, -1);
      }

      if (name === '@@schema') {
        elementsParent[currentModel.toString()].elements.push({
          name,
          rawParams: [argsPart0]
        });

        return;
      }

      const [arrayPart, argsPart1] = argsPart0.split(']');
      const params = argsPart1?.split(',')?.reduce((acc, e) => {
        if (e.trim().length === 0) {
          return acc;
        }

        const [key, value] = e.split(':');
        return { ...acc, [key.trim()]: value.trim() };
      }, {});

      const array = arrayPart
        ?.split('[')?.[1]
        ?.split(',')
        ?.map((e) => e.trim());

      elementsParent[currentModel.toString()].elements.push({
        name,
        arrayArg: array,
        params
      });

      return;
    }

    if (currentModel) {
      const fieldName = line
        .trim()
        ?.split(' ')
        ?.map((e) => e.trim())
        ?.filter((e) => e)?.[0];

      if (fieldName) {
        elementsParent[currentModel.toString()].fields[fieldName.toString()] = {
          dbTypes: []
        };
      }

      if (line.includes('@db.')) {
        const elements = line
          .slice(line.indexOf('@'))
          .split('@')
          .reduce((acc: string[], element) => {
            const trimmed = element.trim();
            if (!trimmed || !trimmed.startsWith('db.')) {
              return acc;
            }

            return [...acc, `@${trimmed}`];
          }, []);

        elementsParent[currentModel.toString()].fields[
          fieldName.toString()
        ].dbTypes = elements;
      }

      if (line.includes('@relation(') && line.indexOf('onUpdate') >= 0) {
        const onUpdate = line
          .slice(line.indexOf('onUpdate'))
          .split(',')
          .find((e) => e.includes('onUpdate'))
          ?.split(': ')[1]
          ?.replace(')', '');

        elementsParent[currentModel.toString()].fields[
          fieldName.toString()
        ].relationOnUpdate = onUpdate;
      }

      SPECIAL_PARAMS.forEach((specialParam) => {
        if (!line.includes(`${specialParam}(`)) {
          return;
        }

        const uniqueParams = line
          .trim()
          ?.split(`${specialParam}(`)?.[1]
          ?.split(')')?.[0];

        elementsParent[currentModel.toString()].elements.push({
          isField: fieldName,
          name: specialParam,
          stringParams: uniqueParams
        });
      });
    }
  });

  return elementsParent;
}
