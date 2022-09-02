import { execSync } from 'child_process';
import nodePath from 'path';
import os from 'os';
import fs from 'fs';

export default abstract class Utils {
  public static getUserDic(): string | undefined {
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
      return undefined;
    }

    let dir: string | undefined;
    try {
      dir = execSync(findCommand)
        .toString('utf8')
        .trim()
        .replace(/\r?\n|\r/g, '');
    } catch {
      return undefined;
    }

    if (!fs.existsSync(nodePath.normalize(dir))) {
      return undefined;
    }

    return dir;
  }
}
