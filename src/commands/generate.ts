import { getDMMF } from '@prisma/internals';
import { Command } from 'commander';
import colors from 'colors/safe';
import nodePath from 'path';
import fs from 'fs';

import { generateJson } from '../functions/generate';
import { Models } from '../types';
import Config from '../index';
import Utils from '../Utils';

export default (program: Command) => {
  program
    .command('generate')
    .description(
      'Generates/updates a json file with the mappings from prisma schema'
    )
    .action(async () => {
      const { schema, camel } = program.opts();

      const logInfo =
        (color = colors.gray) =>
        (...args: unknown[]) => {
          console.log(color(Utils.terminalSymbols().info), ...args);
        };

      const logError = (...args: unknown[]) => {
        console.error(colors.red(Utils.terminalSymbols().error), ...args);
      };

      const logSuccess = (...args: unknown[]) => {
        console.log(colors.green(Utils.terminalSymbols().success), ...args);
      };

      const logSuccessStep = (part: string) => {
        Utils.clearPrevLine();
        console.log(
          colors.gray(Utils.terminalSymbols().success),
          colors.gray(part)
        );
      };

      const prismaPath = nodePath.normalize(
        nodePath.join(Config.userDir || '', schema)
      );

      if (!schema.endsWith('.prisma') || !fs.existsSync(prismaPath)) {
        logError('No Prisma Schema found at', colors.red(prismaPath), '\n');
        return process.exit(1);
      }

      logInfo(colors.blue)('Generating JSON after Schema', colors.gray(schema));

      let nowTime = Date.now();
      const start = nowTime;

      logInfo()(colors.gray('Loading Schema and Previous Mappings'));

      const jsonPath = nodePath.join(
        Config.userDir || '',
        'prisma-mapper.json'
      );
      let existingModels: Models = {};

      try {
        existingModels = JSON.parse(fs.readFileSync(jsonPath).toString('utf8'));
      } catch {}

      logSuccessStep(
        `Schema and Previous Mappings Loaded ${Date.now() - nowTime}ms`
      );
      logInfo()(colors.gray('Parsing Schema'));
      nowTime = Date.now();

      const document = await getDMMF({
        datamodelPath: prismaPath
      });

      logSuccessStep(`Schema Parsed ${Date.now() - nowTime}ms`);
      logInfo()(colors.gray('Generating Mappings'));
      nowTime = Date.now();

      const config = await generateJson(document, existingModels, camel);

      logSuccessStep(`Mappings Generated ${Date.now() - nowTime}ms`);
      logInfo()(colors.gray('Saving Mappings'));
      nowTime = Date.now();

      fs.writeFileSync(jsonPath, JSON.stringify(config, null, 2));

      logSuccessStep(`Mappings Saved ${Date.now() - nowTime}ms`);

      Utils.clearPrevLine(4);
      logSuccess(
        'JSON Created at',
        colors.cyan('prisma-mapper.json'),
        'in',
        colors.green(`${Date.now() - start}ms`)
      );
    });
};
