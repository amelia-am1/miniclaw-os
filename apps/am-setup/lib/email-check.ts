import * as net from "node:net";
import * as tls from "node:tls";

/**
 * Quick IMAP auth check: attempts IMAP LOGIN against Gmail.
 * Returns { ok: true } if credentials are valid, { ok: false, error } otherwise.
 * This is a lightweight alternative to importing the full mc-email plugin.
 */
export async function checkGmailAuth(
  email: string,
  appPassword: string
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host: "imap.gmail.com", port: 993, servername: "imap.gmail.com" },
      () => {
        let buffer = "";
        let greeted = false;

        socket.on("data", (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split("\r\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!greeted && line.startsWith("* OK")) {
              greeted = true;
              // Send LOGIN command
              socket.write(`A001 LOGIN "${email}" "${appPassword}"\r\n`);
            } else if (line.startsWith("A001 OK")) {
              socket.destroy();
              resolve({ ok: true });
            } else if (line.startsWith("A001 NO") || line.startsWith("A001 BAD")) {
              socket.destroy();
              resolve({ ok: false, error: "Invalid email or app password" });
            }
          }
        });

        socket.on("error", (err: Error) => {
          resolve({ ok: false, error: `Connection error: ${err.message}` });
        });

        socket.on("timeout", () => {
          socket.destroy();
          resolve({ ok: false, error: "Connection timed out" });
        });

        socket.setTimeout(10000);
      }
    );

    socket.on("error", (err: Error) => {
      resolve({ ok: false, error: `TLS error: ${err.message}` });
    });
  });
}
