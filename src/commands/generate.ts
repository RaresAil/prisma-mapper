import { getDMMF } from '@prisma/internals';
import colors from 'colors/safe';
import nodePath from 'path';
import fs from 'fs';

import { generateJson } from '../functions/generate';
import { program } from '../commands';
import { Models } from '../types';
import Config from '../index';

export default () => {
  program
    .command('generate')
    .description(
      'Generates/updates a json file with the mappings from prisma schema'
    )
    .action(async () => {
      const { schema, camel } = program.opts();

      const prismaPath = nodePath.normalize(
        nodePath.join(Config.userDir || '', schema)
      );

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
        'Loading schema and previous mappings'
      );

      const jsonPath = nodePath.join(
        Config.userDir || '',
        'prisma-mapper.json'
      );
      let existingModels: Models = {};

      try {
        existingModels = JSON.parse(fs.readFileSync(jsonPath).toString('utf8'));
      } catch {}

      console.log(
        colors.cyan(Config.logPrefix),
        'Parsing schema',
        colors.green(`+${Date.now() - nowTime}ms`)
      );
      nowTime = Date.now();

      const document = await getDMMF({
        datamodelPath: prismaPath
      });

      console.log(
        colors.cyan(Config.logPrefix),
        'Generating mappings',
        colors.green(`+${Date.now() - nowTime}ms`)
      );
      nowTime = Date.now();

      const config = await generateJson(document, existingModels, camel);

      console.log(
        colors.cyan(Config.logPrefix),
        'Saving mappings',
        colors.green(`+${Date.now() - nowTime}ms`)
      );
      nowTime = Date.now();

      fs.writeFileSync(jsonPath, JSON.stringify(config, null, 2));

      console.log(
        colors.green(Config.logPrefix),
        'Json created at',
        colors.cyan('prisma-mapper.json'),
        'in',
        colors.green(`${Date.now() - start}ms`)
      );
    });
};
