import path from "path";
import fs from "fs";

/**
 * Mirrors console output to a rotating-safe log file. Extracted verbatim from the
 * original monolith. Call once at process start.
 */
export function installConsoleFileLogging(): void {
  const logFilePath = path.join(process.cwd(), "server_console.log");
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  console.log = (...args: any[]) => {
    originalConsoleLog(...args);
    try {
      const formatted = args
        .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg)))
        .join(" ");
      fs.appendFileSync(logFilePath, `[LOG] ${new Date().toISOString()} - ${formatted}\n`, "utf-8");
    } catch (e) {
      /* ignore file logging failures */
    }
  };

  console.error = (...args: any[]) => {
    originalConsoleError(...args);
    try {
      const formatted = args
        .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg)))
        .join(" ");
      fs.appendFileSync(logFilePath, `[ERROR] ${new Date().toISOString()} - ${formatted}\n`, "utf-8");
    } catch (e) {
      /* ignore file logging failures */
    }
  };
}
