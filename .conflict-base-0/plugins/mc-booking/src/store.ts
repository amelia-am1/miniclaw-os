import { randomBytes } from "node:crypto";
import type { Client } from "@libsql/client";

export interface Appointment {
  id: string;
  name: string;
  email: string;
  interest: string;
  scheduled_time: string;
  notes: string;
  status: string;
  manage_token: string;
  stripe_payment_id: string;
  stripe_refund_id: string;
  refund_amount: number;
  paid_at: string;
  cancelled_at: string;
  created_at: string;
  updated_at: string;
}

function generateId(): string {
  return `apt_${randomBytes(4).toString("hex")}`;
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export class AppointmentStore {
  constructor(private db: Client) {}

  async create(data: {
    name: string;
    email: string;
    interest?: string;
    scheduled_time: string;
    notes?: string;
    stripe_payment_id?: string;
  }): Promise<Appointment> {
    const now = new Date().toISOString();
    const apt: Appointment = {
      id: generateId(),
      name: data.name,
      email: data.email,
      interest: data.interest || "",
      scheduled_time: data.scheduled_time,
      notes: data.notes || "",
      status: "confirmed",
      manage_token: generateToken(),
      stripe_payment_id: data.stripe_payment_id || "",
      stripe_refund_id: "",
      refund_amount: 0,
      paid_at: data.stripe_payment_id ? now : "",
      cancelled_at: "",
      created_at: now,
      updated_at: now,
    };

    await this.db.execute({
      sql: `INSERT INTO appointments (id, name, email, interest, scheduled_time, notes, status, manage_token, stripe_payment_id, stripe_refund_id, refund_amount, paid_at, cancelled_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        apt.id, apt.name, apt.email, apt.interest, apt.scheduled_time,
        apt.notes, apt.status, apt.manage_token, apt.stripe_payment_id,
        apt.stripe_refund_id, apt.refund_amount, apt.paid_at,
        apt.cancelled_at, apt.created_at, apt.updated_at,
      ],
    });

    return apt;
  }

  async getByToken(token: string): Promise<Appointment | null> {
    const result = await this.db.execute({
      sql: "SELECT * FROM appointments WHERE manage_token = ?",
      args: [token],
    });
    if (!result.rows.length) return null;
    return result.rows[0] as unknown as Appointment;
  }

  async getById(id: string): Promise<Appointment | null> {
    const result = await this.db.execute({
      sql: "SELECT * FROM appointments WHERE id = ?",
      args: [id],
    });
    if (!result.rows.length) return null;
    return result.rows[0] as unknown as Appointment;
  }

  async listUpcoming(limit = 20): Promise<Appointment[]> {
    const result = await this.db.execute({
      sql: `SELECT * FROM appointments
            WHERE status = 'confirmed' AND scheduled_time >= datetime('now')
            ORDER BY scheduled_time ASC LIMIT ?`,
      args: [limit],
    });
    return result.rows as unknown as Appointment[];
  }

  async hasConflict(scheduledTime: string): Promise<boolean> {
    const result = await this.db.execute({
      sql: `SELECT COUNT(*) as cnt FROM appointments
            WHERE scheduled_time = ? AND status = 'confirmed'`,
      args: [scheduledTime],
    });
    return (result.rows[0] as unknown as { cnt: number }).cnt > 0;
  }

  async countOnDate(dateStr: string): Promise<number> {
    const result = await this.db.execute({
      sql: `SELECT COUNT(*) as cnt FROM appointments
            WHERE scheduled_time LIKE ? AND status = 'confirmed'`,
      args: [`${dateStr}%`],
    });
    return (result.rows[0] as unknown as { cnt: number }).cnt;
  }

  async cancel(token: string, refundId?: string, refundAmount?: number): Promise<Appointment | null> {
    const apt = await this.getByToken(token);
    if (!apt || apt.status !== "confirmed") return null;

    const now = new Date().toISOString();
    await this.db.execute({
      sql: `UPDATE appointments
            SET status = 'cancelled', cancelled_at = ?, stripe_refund_id = ?, refund_amount = ?, updated_at = ?
            WHERE manage_token = ?`,
      args: [now, refundId || "", refundAmount || 0, now, token],
    });

    return { ...apt, status: "cancelled", cancelled_at: now, stripe_refund_id: refundId || "", refund_amount: refundAmount || 0, updated_at: now };
  }

  async reschedule(token: string, newTime: string): Promise<Appointment | null> {
    const apt = await this.getByToken(token);
    if (!apt || apt.status !== "confirmed") return null;

    const now = new Date().toISOString();
    await this.db.execute({
      sql: `UPDATE appointments SET scheduled_time = ?, updated_at = ? WHERE manage_token = ?`,
      args: [newTime, now, token],
    });

    return { ...apt, scheduled_time: newTime, updated_at: now };
  }

  async getConfig(key: string): Promise<string | null> {
    const result = await this.db.execute({
      sql: "SELECT value FROM config WHERE key = ?",
      args: [key],
    });
    if (!result.rows.length) return null;
    return (result.rows[0] as unknown as { value: string }).value;
  }

  async setConfig(key: string, value: string): Promise<void> {
    await this.db.execute({
      sql: "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)",
      args: [key, value],
    });
  }
}
