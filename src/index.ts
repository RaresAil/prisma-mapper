import path from 'path';
import fs from 'fs';

import Utils from './Utils';

const root = __dirname;
let version = '0.0.0';
let description = '';
let name = '';
let dir = '';

try {
  const packageData = fs
    .readFileSync(path.join(root, '..', 'package.json'))
    .toString('utf8');

  if (packageData && JSON.parse(packageData)) {
    const data = JSON.parse(packageData);
    description = data.description;
    version = data.version;
    name = data.name;
  }

  dir = Utils.getUserDic();
} catch {}

export default {
  logPrefix: '[Prisma Mapper]',
  userDir: dir,
  description,
  version,
  root,
  name
};
