# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Run MCP server**: `deno task start` - Starts the MCP server with stdio transport
- **Development mode**: `deno task dev` - Runs server with file watching for development
- **Run tests**: `deno task test` - Runs all test files with required permissions
- **Type check**: `deno check main.ts`
- **Publish to JSR**: `deno publish` (requires JSR authentication)

## Project Structure

This is an MCP (Model Context Protocol) server built with Deno that allows AI assistants to execute TypeScript and JavaScript code securely:

- `main.ts` - MCP server implementation with code execution tool
- `main_test.ts` - Tests for MCP server functionality and code execution
- `deno.json` - Project configuration for JSR publishing under `@cong/mcp-deno`

## MCP Server Architecture

The server provides a single tool `execute_typescript` that:
- Executes TypeScript/JavaScript code by writing to temporary files
- Takes only a `code` parameter (string)
- Runs code in isolated subprocess for security
- Returns stdout/stderr and exit codes
- Provides helpful permission error messages

## Security Model

Similar to `mcp-deno-sandbox`, this server prioritizes security through:
- Permission configuration at server startup (not per-execution)
- Code execution in separate Deno process
- No persistent state between executions
- Helpful error messages for permission issues

## Integration Examples

For Claude Desktop configuration. The server requires a set of base permissions to operate (manage temporary files, execute scripts). Additional permissions can be added for the scripts themselves.

**Base Server Operational Permissions:**
`--allow-env=DENO_EXEC_PATH` (to find Deno executable)
`--allow-run` (to run scripts in a subprocess)
`--allow-write` (to create temporary script files)
`--allow-read` (to read temporary script files)

### Basic (Server Operational Permissions Only):
This configuration allows the server to run and execute scripts, but the scripts themselves will have a very restricted environment unless more permissions are added.
```json
{
  "mcpServers": {
    "deno-executor": {
      "command": "deno",
      "args": [
        "run",
        "--allow-env=DENO_EXEC_PATH",
        "--allow-run",
        "--allow-write",
        "--allow-read",
        "jsr:@cong/mcp-deno"
      ]
    }
  }
}
```

### With Additional Script Permissions:
This example adds `--allow-net` for scripts that need network access and more specific read/write access.
```json
{
  "mcpServers": {
    "deno-executor": {
      "command": "deno",
      "args": [
        "run",
        // Base server operational permissions:
        "--allow-env=DENO_EXEC_PATH",
        "--allow-run",
        "--allow-write",
        "--allow-read",
        // Additional permissions for scripts:
        "--allow-net=example.com", // Allow specific network access
        "--allow-read=/data",      // Allow reading from /data
        "--allow-write=/output",   // Allow writing to /output
        "jsr:@cong/mcp-deno"
      ]
    }
  }
}
```

### Full Permissions (use with caution):
This grants all permissions to the server and subsequently to the scripts it executes. This should be used sparingly and only in trusted environments.
```json
{
  "mcpServers": {
    "deno-executor": {
      "command": "deno",
      "args": [
        "run",
        "--allow-all", // Includes all necessary operational and script permissions
        "jsr:@cong/mcp-deno"
      ]
    }
  }
}
```