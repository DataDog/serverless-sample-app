import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import axios, { AxiosInstance } from "axios";
import { getParameter } from "@aws-lambda-powertools/parameters/ssm";
import { Logger } from "@aws-lambda-powertools/logger";
import { z } from "zod";
import {
  createProductService,
  ProductService,
} from "../core/products/productService";
import { createOrderService, OrderService } from "../core/order/orderService";

const logger = new Logger({});

let productService: ProductService | undefined;
let orderService: OrderService | undefined;

const create = () => {
  const mcpServer = new McpServer(
    {
      name: "order-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  mcpServer.tool(
    "availableProducts",
    { token: z.string().optional() },
    async (ctx) => {
      if (!productService) {
        productService = await createProductService(ctx.token!);
      }

      const productList = await productService.getAvailableProducts();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(productList),
          },
        ],
      };
    }
  );

  mcpServer.tool(
    "createOrder",
    { token: z.string().optional(), productsOnOrder: z.array(z.string()) },
    async (ctx) => {
      if (!orderService) {
        orderService = await createOrderService(ctx.token!);
      }

      const orderResponse = await orderService.createOrder(ctx.productsOnOrder);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(orderResponse),
          },
        ],
      };
    }
  );

  mcpServer.tool(
    "getOrderStatus",
    { token: z.string().optional(), orderId: z.string() },
    async (ctx) => {
      if (!orderService) {
        orderService = await createOrderService(ctx.token!);
      }

      const orderResponse = await orderService.getOrderStatus(ctx.orderId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(orderResponse),
          },
        ],
      };
    }
  );

  mcpServer.tool(
    "getMyOrders",
    { token: z.string().optional() },
    async (ctx) => {
      if (!orderService) {
        orderService = await createOrderService(ctx.token!);
      }

      const orderResponse = await orderService.listOrders();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(orderResponse),
          },
        ],
      };
    }
  );

  return mcpServer;
};

export default { create };
