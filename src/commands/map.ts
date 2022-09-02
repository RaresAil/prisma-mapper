import colors from 'colors/safe';
import nodePath from 'path';
import fs from 'fs';

import { program } from '../commands';
import Config from '../index';

import generatePrisma from '../functions/generatePrisma';

export default () => {
  program
    .command('map')
    .description(
      'Adds the @map and @@map to the prisma schema based on prisma-mapper.json'
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
        'Mapping schema',
        colors.cyan(schema)
      );

      generatePrisma(
        prismaPath,
        nodePath.join(Config.userDir || '', 'prisma-mapper.json')
      );

      console.log(
        colors.green('[Success]'),
        'Schema mapped using',
        colors.cyan('prisma-mapper.json')
      );
    });
};
