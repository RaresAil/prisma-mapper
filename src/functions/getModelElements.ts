import { formatSchema } from '@prisma/internals';

import { Element } from '../types';

export async function getModelElements(schema: string) {
  const parsedCurrentSchema = await formatSchema({ schema });
  let currentModel = '';
  const elements: Record<string, Element[]> = {};

  parsedCurrentSchema.split('\n').forEach((line) => {
    if (currentModel && line.trim().startsWith('@@map')) {
      return;
    }

    if (line.trim().startsWith('model')) {
      currentModel = line.split(' ')[1];
      elements[currentModel.toString()] = [];
    } else if (line.trim().startsWith('}')) {
      currentModel = '';
    } else if (currentModel && line.trim().startsWith('@@')) {
      const trimmedLine = line.trim();
      const name = trimmedLine.split('(')[0];

      let argsPart0 = trimmedLine.replace(`${name}(`, '');
      if (argsPart0.endsWith(')')) {
        argsPart0 = argsPart0.slice(0, -1);
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

      elements[currentModel.toString()].push({
        name,
        arrayArg: array,
        params
      });
    }
  });

  return elements;
}
