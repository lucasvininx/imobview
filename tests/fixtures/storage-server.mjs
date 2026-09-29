// Local contract fixture for browser tests. Never imported by the application.
import { createServer } from "node:http";
const objects = new Map();
createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3100");
  res.setHeader("Access-Control-Allow-Headers", "content-type,x-upsert");
  res.setHeader("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }
  const path = decodeURIComponent(
    new URL(req.url, "http://127.0.0.1:3101").pathname,
  ).replace("/storage/v1", "");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  function json(data, status = 200) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  }
  if (path === "/health") return json({ ok: true });
  if (path.startsWith("/object/upload/sign/")) {
    const key = path.slice("/object/upload/sign/".length);
    if (req.method === "POST")
      return json({ url: `${path}?token=local-test-only` });
    if (req.method === "PUT") {
      objects.set(key, body);
      return json({ Key: key });
    }
  }
  if (path.startsWith("/object/info/")) {
    const key = path.slice("/object/info/".length),
      value = objects.get(key);
    return value
      ? json({ name: key, size: value.length, metadata: {} })
      : json({ message: "not found" }, 404);
  }
  if (path.startsWith("/object/sign/") && req.method === "POST") {
    const bucket = path.slice("/object/sign/".length);
    return json(
      JSON.parse(body.toString()).paths.map((key) => ({
        path: key,
        signedURL: `/object/sign/${bucket}/${key}?token=local-test-only`,
        error: null,
      })),
    );
  }
  if (req.method === "DELETE") {
    const bucket = path.slice("/object/".length);
    for (const key of JSON.parse(body.toString()).prefixes)
      objects.delete(`${bucket}/${key}`);
    return json([]);
  }
  const key = path.replace(/^\/object\/(authenticated\/|sign\/)?/, "");
  if (req.method === "POST") {
    if (objects.has(key)) return json({ message: "exists" }, 409);
    objects.set(key, body);
    return json({ Key: key });
  }
  const value = objects.get(key);
  if (value) {
    res.writeHead(200, { "Content-Type": "image/jpeg" });
    res.end(value);
  } else json({ message: "not found" }, 404);
}).listen(3101, "127.0.0.1");
