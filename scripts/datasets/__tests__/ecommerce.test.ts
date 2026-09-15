import { describe, expect, it } from "vitest";
import { ECOMMERCE_ROW_COUNTS, generateEcommerceDataset } from "../ecommerce";

describe("generateEcommerceDataset", () => {
  it("is deterministic given the fixed seed", () => {
    const first = generateEcommerceDataset();
    const second = generateEcommerceDataset();
    expect(second).toEqual(first);
  });

  it("produces the configured row counts", () => {
    const data = generateEcommerceDataset();

    expect(data.customers).toHaveLength(ECOMMERCE_ROW_COUNTS.customers);
    expect(data.products).toHaveLength(ECOMMERCE_ROW_COUNTS.products);
    expect(data.orders).toHaveLength(ECOMMERCE_ROW_COUNTS.orders);
    expect(data.payments).toHaveLength(ECOMMERCE_ROW_COUNTS.orders);
    expect(data.orderItems.length).toBeGreaterThan(data.orders.length);
  });

  it("keeps every foreign key resolvable to its parent table", () => {
    const data = generateEcommerceDataset();

    const customerIds = new Set(data.customers.map((c) => c.customerId));
    const productIds = new Set(data.products.map((p) => p.productId));
    const orderIds = new Set(data.orders.map((o) => o.orderId));

    for (const order of data.orders) {
      expect(customerIds.has(order.customerId)).toBe(true);
    }
    for (const item of data.orderItems) {
      expect(orderIds.has(item.orderId)).toBe(true);
      expect(productIds.has(item.productId)).toBe(true);
    }
    for (const payment of data.payments) {
      expect(orderIds.has(payment.orderId)).toBe(true);
    }
  });

  it("keeps monetary and quantity values within sane, positive ranges", () => {
    const data = generateEcommerceDataset();

    for (const product of data.products) {
      expect(product.price).toBeGreaterThan(0);
      expect(product.cost).toBeGreaterThan(0);
      expect(product.cost).toBeLessThan(product.price);
    }
    for (const item of data.orderItems) {
      expect(item.quantity).toBeGreaterThanOrEqual(1);
      expect(item.unitPrice).toBeGreaterThan(0);
    }
    for (const payment of data.payments) {
      expect(payment.amount).toBeGreaterThan(0);
    }
  });
});
