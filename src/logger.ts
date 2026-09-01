import chalk from "chalk";

let verbose = false;

export const logger = {
  setVerbose: (value: boolean) => {
    verbose = value;
  },
  info: (msg: string) => {
    if (verbose) console.log(`${chalk.blue("[i]")} ${msg}`);
  },
  log: (msg: string) => console.log(`${chalk.blue("[i]")} ${msg}`),
  warn: (msg: string) => console.log(`${chalk.yellow("[!]")} ${msg}`),
  error: (msg: string) => console.error(`${chalk.red("[!]")} ${msg}`),
  success: (msg: string) => console.log(`${chalk.green("[✓]")} ${msg}`),
};
