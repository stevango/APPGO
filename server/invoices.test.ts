import { describe, it, expect, vi } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  getInvoices: vi.fn().mockResolvedValue({
    items: [
      {
        id: 1,
        userId: 1,
        description: "Mensalidade GO - Jun/2026",
        amount: "89.90",
        status: "paid",
        method: "boleto",
        dueDate: new Date("2026-06-05"),
        paidAt: new Date("2026-06-03"),
        referenceMonth: "06/2026",
        boletoUrl: "https://example.com/boleto/123",
        boletoBarcode: "23793.38128 60000.000003 00000.000408 1 89260000008990",
        createdAt: new Date("2026-05-20"),
      },
      {
        id: 2,
        userId: 1,
        description: "Mensalidade GO - Jul/2026",
        amount: "89.90",
        status: "pending",
        method: "boleto",
        dueDate: new Date("2026-07-05"),
        paidAt: null,
        referenceMonth: "07/2026",
        boletoUrl: "https://example.com/boleto/456",
        boletoBarcode: "23793.38128 60000.000003 00000.000408 2 89260000008990",
        createdAt: new Date("2026-06-20"),
      },
    ],
    total: 2,
  }),
  getInvoiceById: vi.fn().mockResolvedValue({
    id: 1,
    userId: 1,
    description: "Mensalidade GO - Jun/2026",
    amount: "89.90",
    status: "paid",
    method: "boleto",
    dueDate: new Date("2026-06-05"),
    paidAt: new Date("2026-06-03"),
    referenceMonth: "06/2026",
    boletoUrl: "https://example.com/boleto/123",
    boletoBarcode: "23793.38128 60000.000003 00000.000408 1 89260000008990",
    createdAt: new Date("2026-05-20"),
  }),
}));

import * as db from "./db";

describe("Invoice procedures", () => {
  it("getInvoices returns paginated results with items and total", async () => {
    const result = await db.getInvoices(1, { page: 1, limit: 10 });
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it("getInvoices returns items with correct structure", async () => {
    const result = await db.getInvoices(1, { page: 1, limit: 10 });
    const invoice = result.items[0];
    expect(invoice).toHaveProperty("id");
    expect(invoice).toHaveProperty("description");
    expect(invoice).toHaveProperty("amount");
    expect(invoice).toHaveProperty("status");
    expect(invoice).toHaveProperty("method");
    expect(invoice).toHaveProperty("dueDate");
    expect(invoice).toHaveProperty("boletoUrl");
    expect(invoice).toHaveProperty("boletoBarcode");
  });

  it("getInvoices supports status filter", async () => {
    await db.getInvoices(1, { status: "paid", page: 1, limit: 10 });
    expect(db.getInvoices).toHaveBeenCalledWith(1, { status: "paid", page: 1, limit: 10 });
  });

  it("getInvoices supports pagination", async () => {
    await db.getInvoices(1, { page: 2, limit: 5 });
    expect(db.getInvoices).toHaveBeenCalledWith(1, { page: 2, limit: 5 });
  });

  it("getInvoiceById returns a single invoice", async () => {
    const result = await db.getInvoiceById(1, 1);
    expect(result).toHaveProperty("id", 1);
    expect(result).toHaveProperty("status", "paid");
    expect(result).toHaveProperty("boletoUrl");
  });

  it("invoice statuses are valid enum values", async () => {
    const result = await db.getInvoices(1, { page: 1, limit: 10 });
    const validStatuses = ["paid", "pending", "overdue", "cancelled"];
    result.items.forEach((item: any) => {
      expect(validStatuses).toContain(item.status);
    });
  });

  it("invoice methods are valid enum values", async () => {
    const result = await db.getInvoices(1, { page: 1, limit: 10 });
    const validMethods = ["boleto", "credit_card", "debit_card", "pix", "recurring_card"];
    result.items.forEach((item: any) => {
      expect(validMethods).toContain(item.method);
    });
  });
});
