import axios, { AxiosInstance } from "axios";
import { getParameter } from "@aws-lambda-powertools/parameters/ssm";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger({});

export interface OrderDTO {
  userId: string;
  orderId: string;
  orderDate: string;
  products: string[];
  status: string;
}

export interface OrderService {
  listOrders: () => Promise<OrderDTO[]>;
  createOrder: (products: string[]) => Promise<OrderDTO>;
  getOrderStatus: (orderId: string) => Promise<OrderDTO>;
}

export const createOrderService = async (
  authToken: string
): Promise<OrderService> => {
  const currentEnvironment = process.env.ENV || "local";

  const integratedEnvironments = ["dev", "staging", "prod"];

  if (integratedEnvironments.includes(currentEnvironment)) {
    // In production or staging, use the real product service
    return await createHttpOrderServiceInstance(authToken);
  } else {
    // In local or development environments, use the mock product service
    return new MockOrderService();
  }
};

export class MockOrderService implements OrderService {
  orders: OrderDTO[] = [];

  async createOrder(products: string[]): Promise<OrderDTO> {
    // Return mock orders for testing purposes
    let productsOnOrder = products.map((product) => ({
      name: product,
      price: Math.floor(Math.random() * 100) + 1, // Random price between 1 and 100
    }));

    const order: OrderDTO = {
      userId: "mock-user-id",
      orderId: `mock-order-${Date.now()}`,
      orderDate: new Date().toISOString(),
      products: productsOnOrder.map((p) => p.name),
      status: "Created",
    };

    this.orders.push(order);

    return order;
  }

  async getOrderStatus(orderId: string): Promise<OrderDTO> {
    // Return a mock order status based on the orderId
    const order = this.orders.find((o) => o.orderId === orderId);

    if (!order) {
      throw new Error("Order not found");
    }
    return order;
  }

  async listOrders(): Promise<OrderDTO[]> {
    // Return all mock orders
    return this.orders;
  }
}

const createHttpOrderServiceInstance = async (
  authToken: string
): Promise<OrderService> => {
  const productApiEndpoint = await getParameter(
    `/${process.env.ENV}/OrdersService/api-endpoint`,
    {
      decrypt: true,
    }
  );

  if (!productApiEndpoint) {
    logger.warn("Order API endpoint is not configured.");

    throw new Error(
      "Order API endpoint is not configured. Please check your environment variables."
    );
  }

  const productApiClient = axios.create({
    baseURL: productApiEndpoint,
  });

  return new HttpOrderService(productApiEndpoint, authToken, productApiClient);
};

class HttpOrderService implements OrderService {
  apiEndpoint: string;
  authToken: string;
  productApiClient: AxiosInstance | undefined;

  constructor(
    apiEndpoint: string,
    authToken: string,
    productApiClient?: AxiosInstance
  ) {
    this.apiEndpoint = apiEndpoint;
    this.productApiClient = productApiClient;
    this.authToken = authToken;
  }

  async getOrderStatus(orderId: string): Promise<OrderDTO> {
    if (!this.productApiClient) {
      throw new Error("Product API client is not initialized.");
    }
    try {
      const response = await this.productApiClient.get(`/orders/${orderId}`, {
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
      });

      return response.data;
    } catch (error: any) {
      logger.error(`Error fetching order status: ${error.message}`);
      throw new Error("Failed to fetch order status.");
    }
  }

  async createOrder(products: string[]): Promise<OrderDTO> {
    if (!this.productApiClient) {
      throw new Error("Product API client is not initialized.");
    }

    try {
      const response = await this.productApiClient.post(
        "/orders",
        {
          products: products,
        },
        {
          headers: {
            Authorization: `Bearer ${this.authToken}`,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error(`Error creating order: ${error.message}`);
      throw new Error("Failed to create order.");
    }
  }

  async listOrders(): Promise<OrderDTO[]> {
    if (!this.productApiClient) {
      throw new Error("Product API client is not initialized.");
    }

    try {
      const response = await this.productApiClient.get("/orders", {
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
      });

      return response.data;
    } catch (error: any) {
      logger.error(`Error listing orders: ${error.message}`);
      throw new Error("Failed to list orders.");
    }
  }
}
