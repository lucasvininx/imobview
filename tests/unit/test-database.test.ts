import { expect, it } from "vitest";
import { testAdminUrl } from "../database-url";
it("keeps E2E administration local when the application uses Supabase", () => {
  expect(
    testAdminUrl({
      DATABASE_URL: "postgresql://app@remote/postgres",
      DIRECT_DATABASE_URL: "postgresql://admin@remote/postgres",
      TEST_DATABASE_URL: "postgresql://app@localhost:55432/imobview_test",
      TEST_DIRECT_DATABASE_URL:
        "postgresql://admin@localhost:55432/imobview_test",
    }),
  ).toBe("postgresql://admin@localhost:55432/imobview_test");
});
it("refuses to derive a test connection from a remote administrator", () => {
  expect(() =>
    testAdminUrl({
      DIRECT_DATABASE_URL: "postgresql://admin@remote/postgres",
      TEST_DATABASE_URL: "postgresql://app@localhost:55432/imobview_test",
    }),
  ).toThrow("isolated local database");
});
