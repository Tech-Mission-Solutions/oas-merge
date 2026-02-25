import fs from "node:fs";
import path from "node:path";
import {Command} from "commander";
import {dump} from "js-yaml";
import {sortOpenApi} from "@/lib/openapi-sort";
import {performSelectiveMerge} from "@/lib/performSelectiveMerge";
import type {MergeConfig} from "@/types";

const program = new Command();

program
  .name("oas-merge")
  .description("Selectively merge OpenAPI schemas via CLI or Config")
  .version("1.0.0")
  .argument("<config-file>", "Path to the api-config.json file")
  .option("-o, --output <path>", "Output file path (overrides config)")
  .action(async (configFile, options) => {
    try {
      // 1. Load Config
      const configPath = path.resolve(configFile);
      if (!fs.existsSync(configPath)) {
        console.error(`❌ Error: Config file not found at ${configPath}`);
        process.exit(1);
      }

      const config: MergeConfig = JSON.parse(
        fs.readFileSync(configPath, "utf-8"),
      );

      // 2. Perform Selective Merge
      console.log("🚀 Starting selective merge...");
      const result = await performSelectiveMerge(config);

      console.log("🚀 Cleaning up...");
      const sorted = await sortOpenApi(result);

      // 3. Determine output format
      const outputPath = options.output || config.output || "./merged-api.yaml";
      const outputDir = path.dirname(outputPath);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, {recursive: true});
      }

      const content = outputPath.endsWith(".json")
        ? JSON.stringify(sorted, null, 2)
        : dump(sorted);

      fs.writeFileSync(outputPath, content);
      console.log(`✅ Successfully merged to: ${outputPath}`);
    } catch (error: any) {
      console.error("❌ Critical Error:", error.message);
      process.exit(1);
    }
  });

program.parse();
