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
- Executes TypeScript/JavaScript code using `deno eval`
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

For Claude Desktop configuration:

### Basic (no permissions):
```json
{
  "mcpServers": {
    "deno-executor": {
      "command": "deno",
      "args": ["run", "jsr:@cong/mcp-deno"]
    }
  }
}
```

### With specific permissions:
```json
{
  "mcpServers": {
    "deno-executor": {
      "command": "deno",
      "args": [
        "run",
        "--allow-net=example.com",
        "--allow-read=/tmp",
        "--allow-write=/tmp",
        "jsr:@cong/mcp-deno"
      ]
    }
  }
}
```

### Full permissions (use with caution):
```json
{
  "mcpServers": {
    "deno-executor": {
      "command": "deno",
      "args": ["run", "--allow-all", "jsr:@cong/mcp-deno"]
    }
  }
}
```