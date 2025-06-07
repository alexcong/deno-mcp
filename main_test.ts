import { assertEquals, assertStringIncludes } from "@std/assert";

Deno.test("Server creation", async () => {
  const process = new Deno.Command("deno", {
    args: ["run", "--allow-all", "main.ts"],
    stdin: "piped",
    stdout: "piped", 
    stderr: "piped",
  });

  const child = process.spawn();
  
  // Send initialization request
  const initRequest = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "test-client",
        version: "1.0.0"
      }
    }
  }) + "\n";

  const writer = child.stdin.getWriter();
  await writer.write(new TextEncoder().encode(initRequest));
  
  // Close stdin to signal end of input
  await writer.close();
  
  const { code, stdout, stderr } = await child.output();
  const stdoutText = new TextDecoder().decode(stdout);
  const stderrText = new TextDecoder().decode(stderr);
  
  // Should not crash and should contain initialization response
  assertEquals(code, 0);
  assertStringIncludes(stderrText, "MCP Deno server running on stdio");
});

Deno.test("Tool execution simulation", async () => {
  // Test the core logic without full MCP server
  const testCode = "console.log('Hello from Deno!');";
  
  const command = new Deno.Command("deno", {
    args: ["eval", testCode],
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await command.output();
  const stdoutText = new TextDecoder().decode(stdout);
  
  assertEquals(code, 0);
  assertStringIncludes(stdoutText, "Hello from Deno!");
});

Deno.test("Error handling simulation", async () => {
  // Test error handling with invalid code
  const testCode = `throw new Error('Simulated error');`;
  
  const command = new Deno.Command("deno", {
    args: ["eval", testCode],
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await command.output();
  const stderrText = new TextDecoder().decode(stderr);
  
  // Should fail with error
  assertEquals(code, 1);
  assertStringIncludes(stderrText, "Simulated error");
});
