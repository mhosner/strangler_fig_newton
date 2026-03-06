/**
 * Creates a realistic toy Node/Express monolith on disk for integration testing.
 * The structure exercises language detection, chunking, entity extraction prompts,
 * and data flow tracing.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function createToyMonolith(root: string): void {
  // Root-level markers for language/framework detection
  writeFile(root, 'package.json', JSON.stringify({
    name: 'acme-monolith',
    version: '1.0.0',
    dependencies: {
      express: '^4.18.0',
      sequelize: '^6.35.0',
      amqplib: '^0.10.0',
      axios: '^1.6.0',
      nodemailer: '^6.9.0',
    },
  }, null, 2));

  writeFile(root, 'tsconfig.json', JSON.stringify({
    compilerOptions: { strict: true, target: 'ES2022', module: 'Node16' },
  }, null, 2));

  // ── Orders service (module with its own package.json) ──
  const orders = dir(root, 'services', 'orders');
  writeFile(orders, 'package.json', '{}');

  writeFile(orders, 'index.ts', `
import express from 'express';
import { OrderController } from './order.controller';
import { connectDB } from './db';

const app = express();
app.use('/orders', OrderController);
app.listen(3001, () => console.log('Orders service on 3001'));
`);

  writeFile(orders, 'order.controller.ts', `
import { Router } from 'express';
import { Order } from './models/order.model';
import { publishOrderCreated } from './events';
import axios from 'axios';

const router = Router();

router.get('/', async (req, res) => {
  const orders = await Order.findAll();
  res.json(orders);
});

router.post('/', async (req, res) => {
  const order = await Order.create(req.body);
  await publishOrderCreated(order);
  // Notify shipping service downstream
  await axios.post('http://shipping-service:3003/shipments', {
    orderId: order.id,
    address: order.shippingAddress,
  });
  res.status(201).json(order);
});

router.get('/:id', async (req, res) => {
  const order = await Order.findByPk(req.params.id);
  res.json(order);
});

export const OrderController = router;
`);

  const orderModels = dir(orders, 'models');
  writeFile(orderModels, 'order.model.ts', `
import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../db';

export class Order extends Model {
  declare id: number;
  declare customerId: number;
  declare total: number;
  declare status: 'pending' | 'confirmed' | 'shipped' | 'delivered';
  declare shippingAddress: string;
}

Order.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  customerId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'customers', key: 'id' } },
  total: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'confirmed', 'shipped', 'delivered'), defaultValue: 'pending' },
  shippingAddress: { type: DataTypes.STRING, allowNull: false },
}, { sequelize, tableName: 'orders' });
`);

  writeFile(orderModels, 'order-item.model.ts', `
import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../db';

export class OrderItem extends Model {
  declare id: number;
  declare orderId: number;
  declare productId: number;
  declare quantity: number;
  declare unitPrice: number;
}

OrderItem.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  orderId: { type: DataTypes.INTEGER, references: { model: 'orders', key: 'id' } },
  productId: { type: DataTypes.INTEGER, references: { model: 'products', key: 'id' } },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  unitPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
}, { sequelize, tableName: 'order_items' });
`);

  writeFile(orders, 'events.ts', `
import amqp from 'amqplib';

const EXCHANGE = 'order_events';

export async function publishOrderCreated(order: any) {
  const conn = await amqp.connect('amqp://rabbitmq:5672');
  const ch = await conn.createChannel();
  await ch.assertExchange(EXCHANGE, 'topic');
  ch.publish(EXCHANGE, 'order.created', Buffer.from(JSON.stringify(order)));
}

export async function publishOrderShipped(orderId: number) {
  const conn = await amqp.connect('amqp://rabbitmq:5672');
  const ch = await conn.createChannel();
  await ch.assertExchange(EXCHANGE, 'topic');
  ch.publish(EXCHANGE, 'order.shipped', Buffer.from(JSON.stringify({ orderId })));
}
`);

  writeFile(orders, 'db.ts', `
import { Sequelize } from 'sequelize';
export const sequelize = new Sequelize('postgres://user:pass@db:5432/acme');
export const connectDB = () => sequelize.authenticate();
`);

  // ── Payments service ──
  const payments = dir(root, 'services', 'payments');
  writeFile(payments, 'package.json', '{}');

  writeFile(payments, 'index.ts', `
import express from 'express';
import { PaymentController } from './payment.controller';

const app = express();
app.use('/payments', PaymentController);
app.listen(3002, () => console.log('Payments service on 3002'));
`);

  writeFile(payments, 'payment.controller.ts', `
import { Router } from 'express';
import { Payment } from './models/payment.model';
import axios from 'axios';

const router = Router();

router.post('/', async (req, res) => {
  const payment = await Payment.create(req.body);
  // Call external payment gateway
  const result = await axios.post('https://api.stripe.com/v1/charges', {
    amount: payment.amount,
    currency: 'usd',
    source: req.body.token,
  });
  payment.externalId = result.data.id;
  await payment.save();
  res.status(201).json(payment);
});

router.get('/order/:orderId', async (req, res) => {
  const payments = await Payment.findAll({ where: { orderId: req.params.orderId } });
  res.json(payments);
});

export const PaymentController = router;
`);

  const paymentModels = dir(payments, 'models');
  writeFile(paymentModels, 'payment.model.ts', `
import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../db';

export class Payment extends Model {
  declare id: number;
  declare orderId: number;
  declare amount: number;
  declare status: 'pending' | 'charged' | 'refunded';
  declare externalId: string;
}

Payment.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  orderId: { type: DataTypes.INTEGER, references: { model: 'orders', key: 'id' } },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'charged', 'refunded'), defaultValue: 'pending' },
  externalId: { type: DataTypes.STRING },
}, { sequelize, tableName: 'payments' });
`);

  writeFile(payments, 'db.ts', `
import { Sequelize } from 'sequelize';
export const sequelize = new Sequelize('postgres://user:pass@db:5432/acme');
`);

  // ── Customers service ──
  const customers = dir(root, 'services', 'customers');
  writeFile(customers, 'package.json', '{}');

  writeFile(customers, 'index.ts', `
import express from 'express';
import { CustomerController } from './customer.controller';

const app = express();
app.use('/customers', CustomerController);
app.listen(3004, () => console.log('Customers on 3004'));
`);

  writeFile(customers, 'customer.controller.ts', `
import { Router } from 'express';
import { Customer } from './models/customer.model';

const router = Router();
router.get('/', async (_req, res) => res.json(await Customer.findAll()));
router.get('/:id', async (req, res) => res.json(await Customer.findByPk(req.params.id)));
router.post('/', async (req, res) => res.status(201).json(await Customer.create(req.body)));
export const CustomerController = router;
`);

  const customerModels = dir(customers, 'models');
  writeFile(customerModels, 'customer.model.ts', `
import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../db';

export class Customer extends Model {
  declare id: number;
  declare name: string;
  declare email: string;
}

Customer.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
}, { sequelize, tableName: 'customers' });
`);

  writeFile(customers, 'db.ts', `
import { Sequelize } from 'sequelize';
export const sequelize = new Sequelize('postgres://user:pass@db:5432/acme');
`);

  // ── Shared config at root ──
  writeFile(root, '.env.example', `
DATABASE_URL=postgres://user:pass@db:5432/acme
RABBITMQ_URL=amqp://rabbitmq:5672
STRIPE_API_KEY=sk_test_xxx
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SHIPPING_SERVICE_URL=http://shipping-service:3003
`);

  // ── SQL migrations at root level ──
  const migrations = dir(root, 'migrations');
  writeFile(migrations, '001-create-customers.sql', `
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
`);

  writeFile(migrations, '002-create-orders.sql', `
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  total DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  shipping_address TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL
);
`);

  writeFile(migrations, '003-create-payments.sql', `
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  external_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
`);

  // ── Notification worker (event handler) ──
  const notifications = dir(root, 'services', 'notifications');
  writeFile(notifications, 'package.json', '{}');

  writeFile(notifications, 'order-created.handler.ts', `
import amqp from 'amqplib';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
  port: 587,
  auth: { user: 'apikey', pass: process.env.SMTP_PASSWORD },
});

export async function startConsumer() {
  const conn = await amqp.connect('amqp://rabbitmq:5672');
  const ch = await conn.createChannel();
  await ch.assertExchange('order_events', 'topic');
  const q = await ch.assertQueue('notification_queue');
  await ch.bindQueue(q.queue, 'order_events', 'order.created');

  ch.consume(q.queue, async (msg) => {
    if (!msg) return;
    const order = JSON.parse(msg.content.toString());
    await transporter.sendMail({
      to: order.customerEmail,
      subject: 'Order Confirmation',
      text: \`Your order #\${order.id} has been placed.\`,
    });
    ch.ack(msg);
  });
}
`);

  writeFile(notifications, 'index.ts', `
import { startConsumer } from './order-created.handler';
startConsumer().then(() => console.log('Notification worker running'));
`);
}

function dir(...parts: string[]): string {
  const p = join(...parts);
  mkdirSync(p, { recursive: true });
  return p;
}

function writeFile(dirPath: string, name: string, content: string): void {
  mkdirSync(dirPath, { recursive: true });
  writeFileSync(join(dirPath, name), content.trimStart());
}
