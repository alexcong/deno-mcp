import { assertEquals, assertStringIncludes, assertInstanceOf } from "@std/assert";
import { JSONRPCClient, JSONRPCServer } from "jsonrpc-server-client";

const DENO_EXE = Deno.execPath();

// Helper to manage server process
async function startServer(permissions: string[] = []) {
  const commandArgs = ["run", ...permissions, "main.ts"];
  const process = new Deno.Command(DENO_EXE, {
    args: commandArgs,
    stdin: "piped",
    stdout: "piped",
    stderr: "piped", // Capture stderr for debugging and server status messages
  });
  const child = process.spawn();
  
  // Wait for server to be ready by looking for the startup message
  const stderrReader = child.stderr.getReader();
  let stderrAcc = "";
  const decoder = new TextDecoder();
  while (!stderrAcc.includes("MCP Deno server running on stdio")) {
    const { value, done } = await stderrReader.read();
    if (done) {
      throw new Error(`Server exited prematurely. Stderr: ${stderrAcc}`);
    }
    stderrAcc += decoder.decode(value);
  }
  // Release the lock so stderr can be fully consumed later if needed
  stderrReader.releaseLock();

  return child;
}

// Helper to send a JSON-RPC request and get a response
async function rpcCall(child: Deno.ChildProcess, method: string, params: unknown, id: number | string = 1) {
  const request = JSON.stringify({
    jsonrpc: "2.0",
    id,
    method,
    params,
  }) + "\n";

  const writer = child.stdin.getWriter();
  await writer.write(new TextEncoder().encode(request));
  writer.releaseLock(); // Release lock after writing

  const stdoutReader = child.stdout.getReader();
  const { value, done } = await stdoutReader.read();
  stdoutReader.releaseLock(); // Release lock after reading

  if (done) {
    const errorOutput = await child.stderr.pipeThrough(new TextDecoderStream()).getReader().read();
    throw new Error(`Server closed stdout unexpectedly. Stderr: ${errorOutput.value}`);
  }
  
  const responseStr = new TextDecoder().decode(value);
  try {
    return JSON.parse(responseStr);
  } catch (e) {
    throw new Error(`Failed to parse JSON response: ${responseStr}. Error: ${e.message}`);
  }
}

Deno.test("Server Initialization and ListTools", async (t) => {
  // Minimal permissions needed for the server to start and list tools.
  // main.ts itself needs to be read. Deno.execPath() might need DENO_EXEC_PATH.
  const serverProcess = await startServer(["--allow-read=main.ts", "--allow-env=DENO_EXEC_PATH"]);

  try {
    await t.step("Initialize Server", async () => {
      const response = await rpcCall(serverProcess, "initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      }, "init-1");

      assertEquals(response.id, "init-1");
      assertEquals(response.jsonrpc, "2.0");
      assertInstanceOf(response.result.serverInfo.name, String);
      assertEquals(response.result.serverInfo.name, "mcp-deno");
      // Add more assertions for serverInfo if needed
    });

    await t.step("List Tools", async () => {
      const response = await rpcCall(serverProcess, "listTools", {}, "list-tools-1");
      assertEquals(response.id, "list-tools-1");
      assertEquals(response.jsonrpc, "2.0");
      assertEquals(response.result.tools.length, 1);
      assertEquals(response.result.tools[0].name, "execute_typescript");
      assertStringIncludes(response.result.tools[0].description, "Execute TypeScript or JavaScript code");
    });

  } finally {
    // Ensure stdin is closed before waiting for the process to exit to avoid hangs
    if (serverProcess.stdin && !serverProcess.stdin.locked) {
        await serverProcess.stdin.close().catch(e => console.error("Error closing stdin:", e));
    }

    // Wait for the process to exit and capture any final output
    const status = await serverProcess.status;
    const stdout = await serverProcess.stdout.pipeThrough(new TextDecoderStream()).pipeThrough(new TextDecoderStream()).getReader().read();
    const stderr = await serverProcess.stderr.pipeThrough(new TextDecoderStream()).pipeThrough(new TextDecoderStream()).getReader().read();

    if (!status.success) {
        console.error("Server process exited with an error:");
        console.error("Stdout:", stdout.value);
        console.error("Stderr:", stderr.value);
    }

    // Terminate the process if it hasn't exited, to prevent resource leaks
     try {
        child.kill("SIGTERM");
     } catch (e) {
        // Ignore errors if already exited
     }
     await child.status; // wait for kill to complete
  }
});

// Placeholder for future tests - to be expanded
Deno.test("Execute TypeScript Tool", async (t) => {
  // This test will need --allow-run for Deno.Command inside main.ts
  // and potentially other permissions depending on the script being run.
  const serverProcess = await startServer([
    "--allow-read=main.ts", // Read main.ts itself
    "--allow-env=DENO_EXEC_PATH", // For Deno.execPath()
    "--allow-run", // For Deno.Command to run the script
    "--allow-write", // For Deno.makeTempDir, Deno.writeTextFile
    "--allow-read", // For Deno.Command to read the temp script
  ]);

  try {
    // Initialize first (good practice, though not strictly necessary for all tool calls)
    await rpcCall(serverProcess, "initialize", { /* params */ }, "init-exec");

    await t.step("Successful execution", async () => {
      const codeToRun = "console.log('Hello from execute_typescript');";
      const response = await rpcCall(serverProcess, "callTool", {
        name: "execute_typescript",
        arguments: { code: codeToRun },
      }, "exec-1");

      assertEquals(response.id, "exec-1");
      assertEquals(response.jsonrpc, "2.0");
      assertEquals(response.result.content[0].type, "text");
      assertStringIncludes(response.result.content[0].text, "Hello from execute_typescript");
      assertEquals(response.result.isError, undefined); // Should not be an error
    });

    await t.step("Execution with runtime error", async () => {
      const codeToRun = "throw new Error('This is a test runtime error');";
      const response = await rpcCall(serverProcess, "callTool", {
        name: "execute_typescript",
        arguments: { code: codeToRun },
      }, "exec-err-1");

      assertEquals(response.id, "exec-err-1");
      assertEquals(response.jsonrpc, "2.0");
      assertEquals(response.result.isError, true);
      assertEquals(response.result.content[0].type, "text");
      assertStringIncludes(response.result.content[0].text, "Error (exit code 1):");
      assertStringIncludes(response.result.content[0].text, "This is a test runtime error");
    });

    await t.step("Execution with syntax error", async () => {
        const codeToRun = "console.log('missing paren';"; // Syntax error
        const response = await rpcCall(serverProcess, "callTool", {
          name: "execute_typescript",
          arguments: { code: codeToRun },
        }, "exec-syntax-err-1");
  
        assertEquals(response.id, "exec-syntax-err-1");
        assertEquals(response.jsonrpc, "2.0");
        assertEquals(response.result.isError, true);
        assertEquals(response.result.content[0].type, "text");
        assertStringIncludes(response.result.content[0].text, "Error (exit code 1):");
        // Deno's error messages for syntax errors can be quite detailed.
        // We'll check for a common indicator.
        assertStringIncludes(response.result.content[0].text, "SyntaxError");
      });

  } finally {
    if (serverProcess.stdin && !serverProcess.stdin.locked) {
        await serverProcess.stdin.close().catch(e => console.error("Error closing stdin:", e));
    }
    const status = await serverProcess.status;
    // Terminate if not exited
    try {
        child.kill("SIGTERM");
     } catch (e) {
        // Ignore
     }
     await child.status;
  }
});

Deno.test("Tool Error Handling", async (t) => {
    const serverProcess = await startServer(["--allow-read=main.ts", "--allow-env=DENO_EXEC_PATH"]); // Minimal permissions

    try {
        await rpcCall(serverProcess, "initialize", { /* params */ }, "init-error-handling");

        await t.step("Calling a non-existent tool", async () => {
            const response = await rpcCall(serverProcess, "callTool", {
              name: "non_existent_tool",
              arguments: {},
            }, "err-unknown-1");

            assertEquals(response.id, "err-unknown-1");
            assertEquals(response.jsonrpc, "2.0");
            assertEquals(response.result.isError, true);
            assertEquals(response.result.content[0].type, "text");
            assertStringIncludes(response.result.content[0].text, "Error: Unknown tool 'non_existent_tool'");
            assertStringIncludes(response.result.content[0].text, "Available tools: 'execute_typescript'");
          });

        await t.step("Calling execute_typescript with invalid arguments (code not string)", async () => {
            const response = await rpcCall(serverProcess, "callTool", {
                name: "execute_typescript",
                arguments: { code: 12345 }, // Invalid: code should be a string
            }, "err-invalid-args-1");

            assertEquals(response.id, "err-invalid-args-1");
            assertEquals(response.jsonrpc, "2.0");
            assertEquals(response.result.isError, true);
            assertEquals(response.result.content[0].type, "text");
            assertStringIncludes(response.result.content[0].text, "Error: 'code' argument must be a string.");
        });

    } finally {
        if (serverProcess.stdin && !serverProcess.stdin.locked) {
            await serverProcess.stdin.close().catch(e => console.error("Error closing stdin:", e));
        }
        // Terminate if not exited
        try {
            child.kill("SIGTERM");
         } catch (e) {
            // Ignore
         }
         await child.status;
    }
});

Deno.test("Permission Denied Scenario", async (t) => {
    // Start server with ONLY read access to main.ts and ENV access for Deno.execPath().
    // NO --allow-run, --allow-net, etc.
    const serverProcess = await startServer([
        "--allow-read=main.ts",
        "--allow-env=DENO_EXEC_PATH",
        // Crucially, no --allow-write for temp file creation by executeDenoScript
        // and no --allow-run for the Deno.Command within executeDenoScript
    ]);

    try {
        await rpcCall(serverProcess, "initialize", { /* params */ }, "init-perms");

        await t.step("Attempt to execute code requiring permissions (e.g. write access for temp file)", async () => {
            // This code itself doesn't need special perms, but the server's attempt to
            // write it to a temp file will fail if --allow-write is not granted to the server process.
            // Or, if writing succeeds, Deno.Command to run it will fail without --allow-run.
            const codeToRun = "console.log('This should ideally not run or fail with permission error');";
            const response = await rpcCall(serverProcess, "callTool", {
              name: "execute_typescript",
              arguments: { code: codeToRun },
            }, "perm-denied-1");

            assertEquals(response.id, "perm-denied-1");
            assertEquals(response.jsonrpc, "2.0");
            assertEquals(response.result.isError, true);
            assertEquals(response.result.content[0].type, "text");

            // The error could be from Deno.makeTempDir (needs --allow-write)
            // or from Deno.Command (needs --allow-run for the sub-process).
            // The error message we crafted in main.ts for "PermissionDenied" is generic enough.
            // However, the actual error might be about creating the temp file first if --allow-write is missing.
            // Let's check for the general structure of the permission error message we added.
            const text = response.result.content[0].text;
            if (text.includes("PermissionDenied") || text.includes("permission denied")) {
                assertStringIncludes(text, "Permission denied error:");
                assertStringIncludes(text, "To grant permissions, restart the MCP server with appropriate flags");
            } else {
                // If it's not a "PermissionDenied" error from Deno itself, it might be our higher-level
                // "Execution error" if, for example, makeTempDir failed before Deno.Command was even tried.
                // This depends on the order of operations and which permission is missing.
                // For this test, we are primarily interested if *any* operation within executeDenoScript
                // fails due to missing broad permissions like --allow-write or --allow-run.
                assertStringIncludes(text, "Execution error:", `Unexpected error message: ${text}`);
            }
          });

    } finally {
        if (serverProcess.stdin && !serverProcess.stdin.locked) {
            await serverProcess.stdin.close().catch(e => console.error("Error closing stdin:", e));
        }
        // Terminate if not exited
        try {
            child.kill("SIGTERM");
         } catch (e) {
            // Ignore
         }
         await child.status;
    }
});

Deno.test("Execute TypeScript Tool - Script Permission Denied", async (t) => {
  // Server has permissions to run scripts, but not necessarily all permissions the script itself might need.
  const serverProcess = await startServer([
    "--allow-read=main.ts",
    "--allow-env=DENO_EXEC_PATH",
    "--allow-run", // Allows Deno.Command
    "--allow-write", // For temp files
    "--allow-read", // For reading temp script
    // NO --allow-net for the server process itself initially
  ]);

  try {
    await rpcCall(serverProcess, "initialize", { /* params */ }, "init-script-perms");

    await t.step("Script requires --allow-net (not granted to server's deno run for the script)", async () => {
      // This code requires --allow-net to be passed to the Deno process that executes it.
      const codeToRun = "await Deno.listen({ port: 9876 }); console.log('Listening...');";
      const response = await rpcCall(serverProcess, "callTool", {
        name: "execute_typescript",
        arguments: { code: codeToRun },
      }, "script-perm-denied-1");

      assertEquals(response.id, "script-perm-denied-1");
      assertEquals(response.jsonrpc, "2.0");
      assertEquals(response.result.isError, true);
      assertEquals(response.result.content[0].type, "text");
      // This is the error message from the *inner* Deno process, caught by main.ts
      assertStringIncludes(response.result.content[0].text, "PermissionDenied");
      assertStringIncludes(response.result.content[0].text, "Net permission"); // Deno's specific message for net
      assertStringIncludes(response.result.content[0].text, "To grant permissions, restart the MCP server with appropriate flags");
    });

  } finally {
    if (serverProcess.stdin && !serverProcess.stdin.locked) {
        await serverProcess.stdin.close().catch(e => console.error("Error closing stdin:", e));
    }
    // Terminate if not exited
    try {
        child.kill("SIGTERM");
     } catch (e) {
        // Ignore
     }
     await child.status;
  }
});

// TODO: Add more tests, e.g. for script timeout (if Deno.Command supports it easily),
// very large outputs, etc., if deemed necessary.

// Helper to ensure child processes are cleaned up if tests fail or stop prematurely
// This is a bit of a global hack, ideally test suites have better setup/teardown per test file.
let child: Deno.ChildProcess; // To hold the current child process for cleanup

globalThis.addEventListener("unload", () => {
    if (child && child.pid) {
        try {
            child.kill("SIGTERM");
        } catch (e) {
            // Ignore, process might have already exited
        }
    }
});

// Override Deno.test to keep track of the child process
// This is a simplification. A more robust solution might involve a test runner
// with per-test setup/teardown for processes.
const originalTest = Deno.test;
Deno.test = (async (nameOrFnOrOptions, fn) => {
    const options = typeof nameOrFnOrOptions === "string" ? { name: nameOrFnOrOptions, fn } : nameOrFnOrOptions;
    if (typeof options.fn !== "function") {
      // Handle if options.fn is not a function (e.g. if only name is provided)
      return originalTest(options);
    }
    const newFn = async (t?: Deno.TestContext) => {
        // Reset child for each test that might use it.
        // This is simplistic; a proper test fixture manager would be better.
        // @ts-ignore: child is not typed on Deno.TestDefinition
        if (t && t.origin === serverProcess?.origin) { // A way to identify tests that use serverProcess
             // @ts-ignore
            child = t.origin; // Assume serverProcess is passed via test context somehow or use a global
        }
        await options.fn(t);
    };
    // @ts-ignore: Deno.TestDefinition name and fn are compatible
    return originalTest({ ...options, fn: newFn });
}) as typeof Deno.test;
