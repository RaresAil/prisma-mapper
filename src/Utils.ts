import { execSync } from 'child_process';
import process from 'node:process';
import fs from 'fs/promises';
import nodePath from 'path';
import syncFs from 'fs';
import os from 'os';

export default abstract class Utils {
  public static getUserDic(): string {
    let findCommand;
    const platform = os.platform();
    const linuxPlatforms = [
      'darwin',
      'linux',
      'freebsd',
      'openbsd',
      'sunos',
      'aix'
    ];

    if (linuxPlatforms.includes(platform)) {
      findCommand = 'pwd';
    } else if (platform === 'win32') {
      findCommand = 'cd';
    } else {
      return '';
    }

    let dir: string | undefined;
    try {
      dir = execSync(findCommand)
        .toString('utf8')
        .trim()
        .replace(/\r?\n|\r/g, '');
    } catch {
      return '';
    }

    if (!syncFs.existsSync(nodePath.normalize(dir))) {
      return '';
    }

    return dir;
  }

  public static clearPrevLine(line = 1) {
    Array.from(Array(line).keys()).forEach(() => {
      process.stdout.moveCursor(0, -1);
      process.stdout.clearLine(1);
    });
  }

  public static isUnicodeSupported(): boolean {
    if (process.platform !== 'win32') {
      return process.env.TERM !== 'linux'; // Linux console (kernel)
    }

    return (
      Boolean(process.env.CI) ||
      Boolean(process.env.WT_SESSION) || // Windows Terminal
      Boolean(process.env.TERMINUS_SUBLIME) || // Terminus (<0.2.27)
      process.env.ConEmuTask === '{cmd::Cmder}' || // ConEmu and cmder
      process.env.TERM_PROGRAM === 'Terminus-Sublime' ||
      process.env.TERM_PROGRAM === 'vscode' ||
      process.env.TERM === 'xterm-256color' ||
      process.env.TERM === 'alacritty' ||
      process.env.TERMINAL_EMULATOR === 'JetBrains-JediTerm'
    );
  }

  public static terminalSymbols() {
    const main = {
      info: 'ℹ',
      success: '✔',
      warning: '⚠',
      error: '✖'
    };

    const fallback = {
      info: 'i',
      success: '√',
      warning: '‼',
      error: 'x'
    };

    return Utils.isUnicodeSupported() ? main : fallback;
  }

  public static async fsExists(path: string) {
    try {
      await fs.lstat(path);
      return true;
    } catch {
      return false;
    }
  }
}
