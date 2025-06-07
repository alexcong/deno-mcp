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
deno run --allow-all jsr:@cong/mcp-deno
```

## Usage

### With Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "deno-executor": {
      "command": "deno",
      "args": [
        "run",
        "--allow-all",
        "jsr:@cong/mcp-deno"
      ]
    }
  }
}
```

### Permission Configuration

Control what the executed code can access by modifying the startup arguments:

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

Available permission flags:
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

# Run the server with inspector
npx @modelcontextprotocol/inspector deno run --allow-all jsr:@cong/mcp-deno

# Or test locally
npx @modelcontextprotocol/inspector deno run --allow-all main.ts
```


## Security

This MCP server prioritizes security through:

- **Subprocess isolation**: Code runs in separate Deno processes
- **Explicit permissions**: Only granted permissions are available to executed code
- **No persistent state**: Each execution is independent
- **Permission error handling**: Clear feedback when permissions are insufficient


## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.