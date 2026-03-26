# Next.js Agent Documentation

This project uses Next.js 16.2.0, which includes native Model Context Protocol (MCP) support for AI agents.

## Agent Resources

- **MCP Endpoint**: `/_next/mcp`
- **Documentation**: Bundled documentation is available in `node_modules/next/dist/docs/`.
- **Diagnostics**: Use the MCP tools to inspect React component trees, PPR shells, and server logs.

## Best Practices for Agents

1. **Read Bundled Docs**: Before proposing complex changes, refer to the local documentation in `node_modules/next/dist/docs/`.
2. **Use MCP Tools**: Leverage the `/mcp` endpoint to get real-time feedback on errors and rendering.
3. **Turbopack**: The project uses Turbopack for development. If you encounter issues, check the `next dev` logs carefully.
