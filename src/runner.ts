// runner.ts
import type { Device, Message, Script, Session } from "frida";
import type { Target } from "./device.js";
import { logger } from "./logger.js";
import type { RunSummary, TestSuiteResult } from "./protocol/protocol.js";
import { isAgentMessage } from "./protocol/protocol.js";
import { printTestSuiteResult } from "./reporter/console.js";

export class TestRunner {
  private session?: Session;
  private script?: Script;
  private initialized = false;
  private readonly results: TestSuiteResult[] = [];
  private fatalError?: Error;

  constructor(
    private readonly device: Device,
    private readonly target: Target,
    private readonly agentBundle: string,
    private readonly verbose: boolean,
  ) {}

  get suiteResults(): readonly TestSuiteResult[] {
    return this.results;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error("TestRunner already initialized");
    }

    const session = await this.device.attach(this.target.pid);
    try {
      const script = await session.createScript(this.agentBundle);
      script.message.connect((message, data) => this.onMessage(message, data));
      script.destroyed.connect(() => {
        this.fatalError ??= new Error("Script was destroyed unexpectedly");
      });
      await script.load();

      this.session = session;
      this.script = script;
      this.initialized = true;

      if (this.target.wasSpawned) {
        await this.device.resume(this.target.pid);
      }
    } catch (error) {
      await session.detach().catch(() => {});
      throw error;
    }
  }

  async runTests(): Promise<RunSummary> {
    if (!this.initialized || this.script === undefined) {
      throw new Error("TestRunner not initialized; call initialize() first");
    }
    const summary = await this.script.exports.runTests(this.verbose);
    if (this.fatalError !== undefined) {
      throw this.fatalError;
    }
    return summary;
  }

  async dispose(): Promise<void> {
    try {
      await this.script?.unload();
    } finally {
      await this.session?.detach();
      this.script = undefined;
      this.session = undefined;
      this.initialized = false;
    }
  }

  private onMessage(message: Message, _data: Buffer | null): void {
    if (message.type === "error") {
      this.fatalError = new Error(message.stack ?? message.description);
      return;
    }

    const payload = message.payload;
    if (!isAgentMessage(payload)) {
      if (this.verbose) {
        logger.info(`Ignoring non-agent message: ${JSON.stringify(payload)}`);
      }
      return;
    }

    switch (payload.type) {
      case "agent-ready":
        break;
      case "test-suite-started":
        logger.info(`Test suite "${payload.name}" started...`);
        break;
      case "test-suite-finished":
        logger.info(`Test suite "${payload.name}" finished.`);
        printTestSuiteResult(payload.result);
        this.results.push(payload.result);
        break;
      case "run-finished":
        break;
    }
  }
}
