// Read and validate env once at boot; a missing required key stops the server.
function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env key: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT || 2567),
  dashboardAdminKey: required("DASHBOARD_ADMIN_KEY")
};
