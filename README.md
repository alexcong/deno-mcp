# @cong/mcp-deno

A secure MCP (Model Context Protocol) server that allows AI assistants like Claude to execute TypeScript and JavaScript code through Deno.

## Features

- 🔒 **Secure code execution** using Deno's permission system
- 🚀 **TypeScript and JavaScript support** with full Deno runtime
- 🛡️ **Configurable permissions** set at server startup
- 🔌 **MCP compliant** for seamless AI assistant integration
- ⚡ **Fast and lightweight** with minimal dependencies

## Installation

Install from JSR:

```bash
deno add jsr:@cong/mcp-deno
```

Or run directly:

```bash
# Base permissions for the server to operate (manage temp files, run subprocesses)
deno run --allow-env=DENO_EXEC_PATH --allow-run --allow-write --allow-read jsr:@cong/mcp-deno
# Add further permissions (e.g., --allow-net) if the scripts you intend to run require them.
```

## Usage

The MCP Deno server requires a baseline set of permissions to operate:
- `--allow-env=DENO_EXEC_PATH`: To correctly locate the Deno executable for running scripts.
- `--allow-run`: To execute scripts in a subprocess.
- `--allow-write`: To create temporary script files.
- `--allow-read`: To read temporary script files and potentially other files if your scripts need it.

When running the server, you must provide these base permissions. You can then add *additional* permissions that the scripts executed by the tool might need (e.g., `--allow-net` for network access).

### With Claude Desktop

Add to your Claude Desktop configuration:

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
        // Add any additional permissions for your scripts below:
        // e.g., "--allow-net=example.com",
        // e.g., "--allow-read=/path/to/data",
        "jsr:@cong/mcp-deno"
      ]
    }
  }
}
```

### Understanding Permission Flags

The following flags control what the Deno process (and thus the scripts it executes) can do:
- `--allow-net[=<allow-list>]` - Allow network access
- `--allow-read[=<allow-list>]` - Allow file system read access
- `--allow-write[=<allow-list>]` - Allow file system write access
- `--allow-run[=<allow-list>]` - Allow running subprocesses
- `--allow-env[=<allow-list>]` - Allow environment access
- `--allow-all` - Allow all permissions (use with caution)

## Development

```bash
# Install dependencies
deno cache main.ts

# Run in development mode
deno task dev

# Run tests
deno task test

# Type check
deno check main.ts
```

### Debugging with MCP Inspector

For debugging and testing your MCP server, use the [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
# Install MCP Inspector
npm install -g @modelcontextprotocol/inspector

# Run the server with inspector (using required base permissions)
npx @modelcontextprotocol/inspector deno run --allow-env=DENO_EXEC_PATH --allow-run --allow-write --allow-read jsr:@cong/mcp-deno

# Or test locally (replace jsr:... with main.ts and add --allow-read=main.ts)
npx @modelcontextprotocol/inspector deno run --allow-read=main.ts --allow-env=DENO_EXEC_PATH --allow-run --allow-write --allow-read main.ts
```


## Security

This MCP server prioritizes security. It's crucial to understand the two layers of permissions:

1.  **Server Operational Permissions**: The server itself needs a baseline set of Deno permissions to function (e.g., to run subprocesses and manage temporary files). These are `--allow-env=DENO_EXEC_PATH`, `--allow-run`, `--allow-write`, and `--allow-read`. These must be provided when starting the server.
2.  **Script Execution Permissions**: The code executed by the `execute_typescript` tool runs within the sandbox defined by the server's startup permissions. If a script attempts an action for which the server process lacks permission (e.g., network access via `fetch` if the server wasn't started with `--allow-net`), Deno will deny it. The server will then relay a clear error message to the client, guiding the user to restart the server with the necessary additional flags.

Key security mechanisms:
- **Subprocess Isolation**: Code runs in separate Deno processes created by the server.
- **Explicit Permissions**: The Deno runtime enforces that only granted permissions are available.
- **No Persistent State**: Each execution is independent by default.
- **Clear Permission Error Handling**: If a script requires permissions not granted to the server process, a specific error message is returned.


## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.