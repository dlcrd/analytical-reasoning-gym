import { faker } from "@faker-js/faker";

const SEED = 20260914;

export const ECOMMERCE_ROW_COUNTS = {
  customers: 300,
  products: 60,
  orders: 1500,
};

const REGIONS = ["north", "south", "midwest", "west"] as const;
const SEGMENTS = ["retail", "wholesale"] as const;
const CATEGORIES = ["electronics", "home", "apparel", "beauty", "sports"] as const;
const ORDER_STATUS_WEIGHTS = [
  { value: "completed", weight: 8 },
  { value: "cancelled", weight: 1 },
  { value: "refunded", weight: 1 },
] as const;
type OrderStatus = (typeof ORDER_STATUS_WEIGHTS)[number]["value"];
const CHANNELS = ["web", "app", "marketplace"] as const;
const PAYMENT_METHODS = ["card", "paypal", "bank_transfer"] as const;

export interface Customer {
  customerId: number;
  signupDate: Date;
  region: (typeof REGIONS)[number];
  segment: (typeof SEGMENTS)[number];
}

export interface Product {
  productId: number;
  category: (typeof CATEGORIES)[number];
  price: number;
  cost: number;
}

export interface Order {
  orderId: number;
  customerId: number;
  orderDate: Date;
  status: OrderStatus;
  channel: (typeof CHANNELS)[number];
}

export interface OrderItem {
  orderItemId: number;
  orderId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export interface Payment {
  paymentId: number;
  orderId: number;
  paidAt: Date;
  amount: number;
  method: (typeof PAYMENT_METHODS)[number];
  status: "succeeded" | "failed" | "refunded";
}

export interface EcommerceDataset {
  customers: Customer[];
  products: Product[];
  orders: Order[];
  orderItems: OrderItem[];
  payments: Payment[];
}

/** Deterministic (fixed seed) synthetic e-commerce dataset — the one shared Dataset for the ecommerce Domain (ADR 0001). */
export function generateEcommerceDataset(): EcommerceDataset {
  faker.seed(SEED);

  const customers: Customer[] = Array.from(
    { length: ECOMMERCE_ROW_COUNTS.customers },
    (_, i) => ({
      customerId: i + 1,
      signupDate: faker.date.between({ from: "2022-01-01", to: "2025-06-01" }),
      region: faker.helpers.arrayElement(REGIONS),
      segment: faker.helpers.arrayElement(SEGMENTS),
    }),
  );

  const products: Product[] = Array.from(
    { length: ECOMMERCE_ROW_COUNTS.products },
    (_, i) => {
      const cost = faker.number.float({ min: 5, max: 200, fractionDigits: 2 });
      const price = Number((cost * faker.number.float({ min: 1.3, max: 2.5 })).toFixed(2));
      return {
        productId: i + 1,
        category: faker.helpers.arrayElement(CATEGORIES),
        price,
        cost,
      };
    },
  );

  const orders: Order[] = Array.from(
    { length: ECOMMERCE_ROW_COUNTS.orders },
    (_, i) => ({
      orderId: i + 1,
      customerId: faker.number.int({ min: 1, max: customers.length }),
      orderDate: faker.date.between({ from: "2024-01-01", to: "2025-09-01" }),
      status: faker.helpers.weightedArrayElement(ORDER_STATUS_WEIGHTS),
      channel: faker.helpers.arrayElement(CHANNELS),
    }),
  );

  const orderItems: OrderItem[] = [];
  for (const order of orders) {
    const itemCount = faker.number.int({ min: 1, max: 5 });
    for (let i = 0; i < itemCount; i++) {
      const product = faker.helpers.arrayElement(products);
      orderItems.push({
        orderItemId: orderItems.length + 1,
        orderId: order.orderId,
        productId: product.productId,
        quantity: faker.number.int({ min: 1, max: 4 }),
        unitPrice: product.price,
        discount: faker.helpers.weightedArrayElement([
          { value: 0, weight: 7 },
          { value: 0.1, weight: 2 },
          { value: 0.2, weight: 1 },
        ]),
      });
    }
  }

  const payments: Payment[] = orders.map((order) => ({
    paymentId: order.orderId,
    orderId: order.orderId,
    paidAt: faker.date.soon({ days: 2, refDate: order.orderDate }),
    amount: Number(
      orderItems
        .filter((item) => item.orderId === order.orderId)
        .reduce((sum, item) => sum + item.quantity * item.unitPrice * (1 - item.discount), 0)
        .toFixed(2),
    ),
    method: faker.helpers.arrayElement(PAYMENT_METHODS),
    status: order.status === "refunded" ? "refunded" : order.status === "cancelled" ? "failed" : "succeeded",
  }));

  return { customers, products, orders, orderItems, payments };
}
