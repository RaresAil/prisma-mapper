#! /usr/bin/env node
import { execSync } from 'child_process';
import { Command } from 'commander';
import colors from 'colors/safe';
import path from 'path';
import fs from 'fs';

import Config from './index';

const program = new Command();

program
  .version(Config.version)
  .description(Config.description)
  .option('--schema <path>', 'prisma schema path', 'prisma/schema.prisma')
  .option('--camel', 'use camelCase and ignore the prisma-mapper.json')
  .option('-o --output <path>', 'prisma schema output path');

const rawCommands = fs.readdirSync(path.join(__dirname, 'commands'));
const commandLoader = Promise.all(
  rawCommands.map(async (command) => {
    try {
      if (
        !command.toString().endsWith('.js') &&
        !command.toString().endsWith('.ts')
      ) {
        return;
      }

      (await import(path.join(__dirname, 'commands', command))).default(
        program
      );
    } catch {}
  })
);

if (process.env.NODE_ENV !== 'dev') {
  try {
    const latestVersion = execSync(`npm show ${Config.name} version`)
      .toString('utf8')
      .trim()
      .replace(/\r?\n|\r/g, '');

    if (latestVersion && Config.version) {
      if (latestVersion !== Config.version) {
        console.log(
          '\n\n',
          colors.yellow('Outdated'),
          colors.gray(':'),
          colors.white('You are not using the latest version'),
          `${colors.gray('(')}Last: ${colors.green(latestVersion)}`,
          `Current: ${colors.red(Config.version)}${colors.gray(')')}`,
          '\n\n'
        );
      }
    }
  } catch {}
}

(async () => {
  await commandLoader;
  program.parseOptions(process.argv);
  program.parse(process.argv);
})();
