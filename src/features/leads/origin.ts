export function journeyOriginAllowed(
  origin: string | null,
  requestUrl: string,
  configuredUrl: string,
  development: boolean,
) {
  if (origin === new URL(configuredUrl).origin) return true;
  if (!development || !origin) return false;
  const local = new URL(requestUrl);
  return (
    ["localhost", "127.0.0.1", "[::1]"].includes(local.hostname) &&
    origin === local.origin
  );
}
