import http, { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createChronicleServer } from './index.js';
import { Storage } from './storage.js';

// Environment variable configuration for Port and Authentication
export const PORT_ENV_VAR = 'CHRONICLE_HTTP_PORT';
export const DEFAULT_PORT = 8787;

const PORT = process.env.CHRONICLE_HTTP_PORT
  ? parseInt(process.env.CHRONICLE_HTTP_PORT, 10)
  : DEFAULT_PORT;

const AUTH_TOKEN = process.env.CHRONICLE_AUTH_TOKEN;

// Step 2: Unconditional authentication guardrail - refuse to start if missing
if (!AUTH_TOKEN) {
  console.error('[FATAL] CHRONICLE_AUTH_TOKEN environment variable is required. Server refusing to start.');
  process.exit(1);
}

const OAUTH_CLIENT_ID = process.env.CHRONICLE_OAUTH_CLIENT_ID || 'chronicle-gemini';
const OAUTH_CLIENT_SECRET = process.env.CHRONICLE_OAUTH_CLIENT_SECRET || AUTH_TOKEN;

// Shared Storage singleton across all HTTP sessions to avoid clobbering and listener leaks
const sharedStorage = new Storage();

// In-memory OAuth authorization codes with TTL and single-use invalidation
interface AuthCodeEntry {
  clientId: string;
  redirectUri: string;
  expiresAt: number;
  codeChallenge?: string;
}
const authCodes = new Map<string, AuthCodeEntry>();

// Session transports map
const transports: Record<string, StreamableHTTPServerTransport> = {};

function parseRawBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', (err) => reject(err));
  });
}

function parseJsonBody(req: IncomingMessage): Promise<unknown> {
  return parseRawBody(req).then((body) => {
    if (!body) return undefined;
    return JSON.parse(body);
  });
}

const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const protocol = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || `localhost:${PORT}`;
  const baseUrl = `${protocol}://${host}`;

  // Add CORS headers for browser/web-app clients
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id, mcp-protocol-version');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // OAuth 2.0 Authorization Server / OpenID Metadata Discovery
  if (
    url.pathname.includes('oauth-authorization-server') ||
    url.pathname.includes('openid-configuration')
  ) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/authorize`,
        token_endpoint: `${baseUrl}/token`,
        grant_types_supported: ['authorization_code', 'client_credentials'],
        token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none'],
        response_types_supported: ['code'],
      })
    );
    return;
  }

  // OAuth 2.0 Protected Resource Metadata (RFC 9728)
  if (url.pathname.includes('oauth-protected-resource')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        resource: `${baseUrl}/mcp`,
        authorization_servers: [baseUrl],
      })
    );
    return;
  }

  // OAuth Token Endpoint (/token)
  if (url.pathname === '/token' || url.pathname.endsWith('/token')) {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid_request', error_description: 'Method Must Be POST' }));
      return;
    }

    try {
      const rawBody = await parseRawBody(req);
      let clientId = '';
      let clientSecret = '';
      let grantType = '';

      // Check Basic Auth header
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Basic ')) {
        const credentials = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8').split(':');
        clientId = credentials[0] || '';
        clientSecret = credentials[1] || '';
      }

      let codeParam = '';

      // Check form or JSON body
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        try {
          const json = JSON.parse(rawBody) || {};
          clientId = clientId || json.client_id || '';
          clientSecret = clientSecret || json.client_secret || '';
          grantType = json.grant_type || '';
          codeParam = json.code || '';
        } catch {}
      } else {
        const params = new URLSearchParams(rawBody);
        clientId = clientId || params.get('client_id') || '';
        clientSecret = clientSecret || params.get('client_secret') || '';
        grantType = params.get('grant_type') || '';
        codeParam = params.get('code') || '';
      }

      // Handle client_credentials grant: STRICT check using && (never ||)
      if (grantType === 'client_credentials') {
        if (clientId === OAUTH_CLIENT_ID && clientSecret === OAUTH_CLIENT_SECRET) {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
          res.end(
            JSON.stringify({
              access_token: AUTH_TOKEN,
              token_type: 'bearer',
              expires_in: 3600,
            })
          );
          return;
        }

        res.writeHead(401, {
          'Content-Type': 'application/json',
          'WWW-Authenticate': `Bearer realm="chronicle"`,
        });
        res.end(JSON.stringify({ error: 'invalid_client', error_description: 'Invalid client credentials' }));
        return;
      }

      // Handle authorization_code grant: Verify single-use, non-expired authorization code
      if (grantType === 'authorization_code') {
        if (!codeParam) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid_request', error_description: 'Missing authorization code' }));
          return;
        }

        const entry = authCodes.get(codeParam);
        if (!entry || entry.expiresAt < Date.now()) {
          if (entry) authCodes.delete(codeParam);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid or expired authorization code' }));
          return;
        }

        // Single-use: Consume and delete immediately
        authCodes.delete(codeParam);

        if (clientId && clientId !== entry.clientId) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid_client', error_description: 'Client ID mismatch for authorization code' }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(
          JSON.stringify({
            access_token: AUTH_TOKEN,
            token_type: 'bearer',
            expires_in: 3600,
          })
        );
        return;
      }

      // Fallback: If client presents valid static credentials directly
      if (clientId === OAUTH_CLIENT_ID && clientSecret === OAUTH_CLIENT_SECRET) {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(
          JSON.stringify({
            access_token: AUTH_TOKEN,
            token_type: 'bearer',
            expires_in: 3600,
          })
        );
        return;
      }

      res.writeHead(401, {
        'Content-Type': 'application/json',
        'WWW-Authenticate': `Bearer realm="chronicle"`,
      });
      res.end(JSON.stringify({ error: 'invalid_client', error_description: 'Invalid client credentials or unsupported grant_type' }));
      return;
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'server_error', error_description: err.message }));
      return;
    }
  }

  // OAuth Dynamic Client Registration (RFC 7591)
  // Protected: Never return master tokens or secrets to unauthenticated callers
  if (url.pathname.includes('/register')) {
    const regAuthHeader = req.headers['authorization'];
    if (!regAuthHeader || regAuthHeader !== `Bearer ${AUTH_TOKEN}`) {
      res.writeHead(401, {
        'Content-Type': 'application/json',
        'WWW-Authenticate': `Bearer realm="chronicle"`,
      });
      res.end(JSON.stringify({ error: 'unauthorized', error_description: 'Client registration requires valid Bearer authentication' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        client_id: OAUTH_CLIENT_ID,
        client_secret: OAUTH_CLIENT_SECRET,
        grant_types: ['authorization_code', 'client_credentials'],
        response_types: ['code'],
      })
    );
    return;
  }

  // OAuth Authorize Endpoint (/authorize)
  if (url.pathname.includes('/authorize')) {
    const requestedClientId = url.searchParams.get('client_id');
    if (requestedClientId && requestedClientId !== OAUTH_CLIENT_ID) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized_client', error_description: 'Unknown client_id' }));
      return;
    }

    const redirectUri = url.searchParams.get('redirect_uri');
    const state = url.searchParams.get('state') || '';
    const codeChallenge = url.searchParams.get('code_challenge') || undefined;

    if (redirectUri) {
      const code = randomUUID();
      authCodes.set(code, {
        clientId: requestedClientId || OAUTH_CLIENT_ID,
        redirectUri,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5-minute TTL
        codeChallenge,
      });

      const targetUrl = new URL(redirectUri);
      targetUrl.searchParams.set('code', code);
      if (state) targetUrl.searchParams.set('state', state);
      res.writeHead(302, { Location: targetUrl.toString() });
      res.end();
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body><h2>Chronicle MCP Server</h2><p>Authorized Successfully. You can close this window.</p></body></html>');
    return;
  }

  // Handle both / and /mcp path
  if (url.pathname !== '/mcp' && url.pathname !== '/') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found. MCP endpoint is mounted at /mcp' }));
    return;
  }

  // Step 2: Bearer Authentication Verification
  const authHeader = req.headers['authorization'];
  if (!authHeader || authHeader !== `Bearer ${AUTH_TOKEN}`) {
    res.writeHead(401, {
      'Content-Type': 'application/json',
      'WWW-Authenticate': `Bearer realm="chronicle", resource_id="${baseUrl}/mcp"`,
    });
    res.end(JSON.stringify({ error: 'Unauthorized: Missing or invalid Bearer token' }));
    return;
  }

  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  try {
    if (req.method === 'POST') {
      let parsedBody: unknown;
      try {
        parsedBody = await parseJsonBody(req);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        return;
      }

      const isInitialize =
        parsedBody &&
        typeof parsedBody === 'object' &&
        (parsedBody as any).method === 'initialize';

      if (sessionId && transports[sessionId] && !isInitialize) {
        await transports[sessionId].handleRequest(req, res, parsedBody);
        return;
      }

      // If an existing transport exists for an initialize re-request, close old one
      if (sessionId && transports[sessionId]) {
        try {
          await transports[sessionId].close();
        } catch {}
        delete transports[sessionId];
      }

      // New session transport
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports[sid] = transport;
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          delete transports[sid];
        }
      };

      const mcpServer = createChronicleServer(sharedStorage);
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, parsedBody);
      return;
    }

    if (req.method === 'GET' || req.method === 'DELETE') {
      if (sessionId && transports[sessionId]) {
        if (req.method === 'GET') {
          // If a previous SSE stream is lingering from a previous network connection/reconnect,
          // close it so the new stream can connect cleanly without 409 Conflict.
          try {
            transports[sessionId].closeStandaloneSSEStream();
          } catch {}
        }
        await transports[sessionId].handleRequest(req, res);
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing or invalid mcp-session-id header' }));
      }
      return;
    }

    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  } catch (err: any) {
    console.error('Error handling HTTP MCP request:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error', message: err.message }));
    }
  }
});

server.listen(PORT, () => {
  console.log(`[chronicle-mcp] Streamable HTTP server listening on http://localhost:${PORT}/mcp`);
});
