import fs from 'fs';

import { Models } from './generateJson';

export default function createJson(prismaPath: string, modelsPath: string) {
  const prismaSchema = fs.readFileSync(prismaPath).toString('utf8').split('\n');
  const models: Models = JSON.parse(
    fs.readFileSync(modelsPath).toString('utf8')
  );

  let lastModel = '';
  const schema: string[] = [];

  prismaSchema.forEach((line) => {
    const keywords = line.split(' ').filter((keyword) => !!keyword);
    if (keywords.length === 0) {
      schema.push(line);
      return;
    }

    if (keywords[0] === 'model') {
      lastModel = keywords[1];
      const { hasMap, name } = models[lastModel.toString()];

      if (hasMap) {
        schema.push(line);
        return;
      }

      schema.push(line.replace(lastModel, name || lastModel));
      return;
    }

    if (keywords[0] === '}' && !!lastModel) {
      const { name, hasMap } = models[lastModel.toString()];
      if (name && !hasMap) {
        schema.push(`@@map("${lastModel}")`);
      }

      schema.push(line);
      lastModel = '';
      return;
    }

    if (keywords[0].includes('@@')) {
      const parsedLine = line.split('(');

      const parsedPart = parsedLine[1].split(']');
      if (parsedPart[0].includes('[') && lastModel) {
        Object.entries(models[lastModel.toString()].fields).forEach(
          ([key, value]) => {
            if (!value) {
              return;
            }

            parsedPart[0] = parsedPart[0].replace(key, value);
          }
        );
      }

      parsedLine[1] = parsedPart.join(']');
      schema.push(parsedLine.join('('));
      return;
    }

    const modelRelation = models[keywords[0].toString()];
    if (modelRelation) {
      const parsedLine = line.split('@relation(');

      if (parsedLine[1]) {
        const model = models[lastModel.toString()];

        const relationSplit = parsedLine[1].split('fields: [');
        const fieldsSplit = relationSplit[1].split(']');

        Object.entries(model.fields).forEach(([field, name]) => {
          if (!name || !fieldsSplit[0].includes(field)) {
            return;
          }

          fieldsSplit[0] = fieldsSplit[0].replace(field, name);
        });

        relationSplit[1] = fieldsSplit.join(']');
        parsedLine[1] = relationSplit.join('fields: [');
      }

      const combinedLine = parsedLine.join('@relation(');

      if (modelRelation?.name && !modelRelation?.hasMap) {
        schema.push(
          combinedLine.replace(
            new RegExp(`${keywords[0]}([ ]|[[]|[?])`, 'g'),
            `${modelRelation.name}$1`
          )
        );
        return;
      }

      schema.push(combinedLine);
      return;
    }

    if (lastModel && !line.includes('@map') && !line.includes('@relation')) {
      const [fieldName] = keywords;
      const newName =
        models[lastModel.toString()].fields[fieldName.toString()] || fieldName;

      schema.push(line.replace(fieldName, newName) + ` @map("${fieldName}")`);
      return;
    }

    schema.push(line);
  });

  fs.writeFileSync(prismaPath, schema.join('\n'));
}
