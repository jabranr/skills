import { lintStagedCommands } from '@jabraf/dev/lint-staged';

export default {
  '*.{js,mjs,ts,mts,jsx,tsx,md,yaml,yml,json,xml}': (files) => [lintStagedCommands.prettier(files)],
};
