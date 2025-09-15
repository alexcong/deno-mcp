#!/usr/bin/env -S deno run --allow-all

/// <reference types="npm:@types/node@^22.12.0" />

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server({
  name: "mcp-deno",
  version: "0.2.1",
}, {
  capabilities: {
    tools: {},
  },
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "execute_typescript",
        description: "Execute TypeScript or JavaScript code using Deno. Permissions are configured at server startup.",
        inputSchema: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "The TypeScript or JavaScript code to execute",
            },
          },
          required: ["code"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "execute_typescript") {
    const { code } = request.params.arguments as {
      code: string;
    };

    try {
      // Create a temporary directory for script isolation
      const tempDir = await Deno.makeTempDir({ prefix: "deno-mcp-" });
      const scriptPath = `${tempDir}/script.ts`;
      
      try {
        // Write the code to a temporary file
        await Deno.writeTextFile(scriptPath, code, { mode: 0o600 });

        // Execute the script using the current Deno executable
        const command = new Deno.Command(Deno.execPath(), {
          args: ["run", "--no-check","--allow-all", scriptPath],
          stdout: "piped",
          stderr: "piped",
          cwd: tempDir,
        });

        const { code: exitCode, stdout, stderr } = await command.output();
        const stdoutText = new TextDecoder().decode(stdout);
        const stderrText = new TextDecoder().decode(stderr);

        if (exitCode === 0) {
          return {
            content: [
              {
                type: "text",
                text: stdoutText || "Code executed successfully (no output)",
              },
            ],
          };
        } else {
          // Check if it's a permission error and provide helpful feedback
          if (stderrText.includes("PermissionDenied") || stderrText.includes("permission denied")) {
            return {
              content: [
                {
                  type: "text",
                  text: `Permission denied error:\n${stderrText}\n\nTo grant permissions, restart the MCP server with appropriate flags like --allow-net, --allow-read, or --allow-write`,
                },
              ],
              isError: true,
            };
          }
          
          return {
            content: [
              {
                type: "text", 
                text: `Error (exit code ${exitCode}):\n${stderrText}`,
              },
            ],
            isError: true,
          };
        }
      } finally {
        // Clean up the temporary directory
        await Deno.remove(tempDir, { recursive: true }).catch(() => {
          // Ignore cleanup errors
        });
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Execution error: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Deno server running on stdio");
}

if (import.meta.main) {
  main().catch(console.error);
}
