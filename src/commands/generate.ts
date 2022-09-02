import colors from 'colors/safe';
import nodePath from 'path';
import fs from 'fs';

import { program } from '../commands';
import Config from '../index';

import createJson from '../functions/generateJson';

export default () => {
  program
    .command('generate')
    .description(
      'Generates/updates a json file with the mappings from prisma schema'
    )
    .action(() => {
      const { schema } = program.opts();

      const prismaPath = nodePath.normalize(
        nodePath.join(Config.userDir || '', schema)
      );

      if (!schema.endsWith('.prisma') || !fs.existsSync(prismaPath)) {
        console.log(
          colors.red('[Failed]'),
          'No prisma schema found at',
          colors.red(prismaPath),
          '\n'
        );
        return;
      }

      console.log(
        colors.cyan('[Working]'),
        'Generating a json after prisma schema from',
        colors.cyan(schema)
      );

      createJson(
        prismaPath,
        nodePath.join(Config.userDir || '', 'prisma-mapper.json')
      );

      console.log(
        colors.green('[Success]'),
        'Json created at',
        colors.cyan('prisma-mapper.json')
      );
    });
};
