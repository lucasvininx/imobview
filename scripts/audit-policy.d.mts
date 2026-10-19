export type AuditReport = {
  vulnerabilities?: Record<
    string,
    {
      severity: string;
      via: (string | { url: string })[];
    }
  >;
};
export function auditBlockers(
  report: AuditReport,
  production?: boolean,
  now?: number,
): string[];
