// Application constants
export const APP_NAME = "IMSOP";
export const APP_DESCRIPTION = "Intelligent Multi-Cloud Supply Chain & Operations Platform";
export const APP_VERSION = "2.5.0";
export const COOKIE_NAME = "imsop_session";
export const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// Demo credentials
export const DEMO_ACCOUNTS = {
  admin: { email: "admin@imsop.io", password: "admin123" },
  engineer: { email: "engineer@imsop.io", password: "engineer123" },
  analyst: { email: "analyst@imsop.io", password: "analyst123" },
  demo: { email: "demo@imsop.io", password: "demo123" },
};

// Simple login URL - redirects to the login page
export const getLoginUrl = () => {
  return "/login";
};
