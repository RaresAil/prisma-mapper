import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';

import mapCommand, { action } from '../commands/map';
import CLIError from '../CLIError';

const EXPECTED_PRISMA = path.join(__dirname, 'expected.prisma');
const OUTPUT_PRISMA = path.join(__dirname, 'out.prisma');
const MOCK_PRISMA = path.join(__dirname, 'mock.prisma');

describe('Test map command', () => {
  let expectedPrisma = '';

  beforeAll(async () => {
    const programMock = {
      command: jest.fn().mockReturnValue({
        description: jest.fn().mockReturnValue({
          action: jest.fn()
        })
      })
    } as unknown as Command;

    mapCommand(programMock);

    expectedPrisma = (await fs.readFile(EXPECTED_PRISMA, 'utf-8')).replace(
      /\r\n/g,
      '\n'
    );
  });

  it('command should pass', async () => {
    await action(
      { schema: MOCK_PRISMA, output: OUTPUT_PRISMA, camel: true },
      true,
      true
    );

    expect(expectedPrisma).not.toEqual('');

    const outputPrisma = (await fs.readFile(OUTPUT_PRISMA, 'utf-8')).replace(
      /\r\n/g,
      '\n'
    );
    expect(outputPrisma).toEqual(expectedPrisma);
  });

  it('command should fail with no schema found', async () => {
    try {
      await action({ schema: '', camel: true }, false, true);
      throw new Error('Should not reach here');
    } catch (e) {
      const error = e as CLIError;
      expect(error.message).toEqual('No prisma schema found');
      expect(error.name).toEqual('CLIError');
    }
  });
});
