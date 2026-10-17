import { readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(new URL("../src/guideContent.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { GUIDE } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const lines = ["<!-- Generated from src/guideContent.ts. Run npm run docs:guide to update. -->", `# ${GUIDE.title}`, GUIDE.intro, GUIDE.beta,
  "## Contents", ...GUIDE.topics.map(topic => `- [${topic.title}](#${topic.id})`)];
for (const topic of GUIDE.topics) {
  lines.push(`<a id="${topic.id}"></a>`, `## ${topic.title}`, ...topic.paragraphs,
    topic.steps.map((step, index) => `${index + 1}. ${step}`).join("\n"), `> ${topic.tip}`);
}
lines.push("## Contextual help reference", "These short texts come from the same source as the guide and can be used beside UI headings.",
  ...GUIDE.topics.flatMap(topic => [`### ${topic.title.replace(/^\d+\. /, "")}`, topic.shortHelp]));
const output = lines.join("\n\n") + "\n";
const destination = new URL("../docs/GETTING_STARTED.md", import.meta.url);
if (process.argv.includes("--check")) {
  if (readFileSync(destination, "utf8") !== output) throw new Error("Guide documentation is out of date. Run npm run docs:guide.");
  console.log("Guide documentation matches the shared help content.");
} else { writeFileSync(destination, output); console.log("Updated docs/GETTING_STARTED.md"); }
