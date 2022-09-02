import fs from 'fs';

export interface Model {
  fields: Record<string, string | null>;
  name?: string | null;
  hasMap: boolean;
}

export interface Models {
  [key: string]: Model;
}

export default function createJson(prismaPath: string, output: string) {
  const prismaSchema = fs.readFileSync(prismaPath).toString('utf8').split('\n');
  let existingModels: Models = {};

  try {
    existingModels = JSON.parse(fs.readFileSync(output).toString('utf8'));
  } catch {}

  let lastModel = '';

  const fieldsTypes: Record<string, string> = {};

  const models = prismaSchema.reduce((acc: Models, line) => {
    const keywords = line.split(' ').filter((keyword) => !!keyword);
    if (keywords.length === 0) {
      return acc;
    }

    if (keywords[0] === 'model') {
      lastModel = keywords[1];

      if (!acc[lastModel.toString()]) {
        acc[lastModel.toString()] = {
          hasMap: false,
          name: null,
          fields: {}
        };
      }

      return acc;
    }

    if (keywords[0] === '}' && !!lastModel) {
      lastModel = '';
      return acc;
    }

    if (keywords[0].includes('@@map')) {
      acc[lastModel.toString()].hasMap = true;
      acc[lastModel.toString()].name = undefined;
      return acc;
    }

    if (keywords[0].includes('@@')) {
      return acc;
    }

    if (lastModel && !line.includes('@map')) {
      const [fieldName, fieldType] = keywords;
      fieldsTypes[`${lastModel}.${fieldName}`] = fieldType;

      if (!acc[lastModel.toString()].fields[fieldName.toString()]) {
        acc[lastModel.toString()].fields[fieldName.toString()] = null;
      }
    }

    return acc;
  }, existingModels);

  const modelsName = Object.keys(models);
  Object.entries(models).forEach(([model, data]) => {
    Object.keys(data.fields).forEach((field) => {
      const fieldType = fieldsTypes[`${model}.${field}`]
        ?.replace('[]', '')
        ?.replace('?', '')
        ?.replace('!', '');

      if (modelsName.includes(fieldType)) {
        delete models[model.toString()].fields[field.toString()];
      }
    });
  });

  fs.writeFileSync(output, JSON.stringify(models, null, 2));
}
