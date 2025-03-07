import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

/** @type {import('@eventcatalog/core/bin/eventcatalog.config').Config} */
export default {
  title: "EventCatalog",
  tagline: "Discover, Explore and Document your Event Driven Architectures",
  organizationName: "Serverles eCommerce",
  homepageLink: "https://eventcatalog.dev/",
  editUrl: "https://github.com/DataDog/serverless-sample-app",
  // By default set to false, add true to get urls ending in /
  trailingSlash: false,
  // Change to make the base url of the site different, by default https://{website}.com/docs,
  // changing to /company would be https://{website}.com/company/docs,
  base: "/",
  logo: {
    alt: "EventCatalog Logo",
    src: "/logo.png",
    text: "EventCatalog",
  },
  generators: [
    [
      "@eventcatalog/generator-asyncapi",
      {
        services: [
          {
            path: path.join(
              __dirname,
              "../../",
              "src",
              "order-service",
              "api-docs",
              "orders-api-events.yml"
            ),
            owners: ["order-management"],
            id: "Orders API",
          },
          {
            path: path.join(
              __dirname,
              "../../",
              "src",
              "order-service",
              "api-docs",
              "orders-acl.yml"
            ),
            owners: ["order-management"],
            id: "Orders ACL",
          },
        ],
        domain: { id: "orders", name: "Orders", version: "0.0.1" },
      },
    ],
    [
      "@eventcatalog/generator-openapi",
      {
        services: [
          {
            path: path.join(
              __dirname,
              "../../",
              "src",
              "order-service",
              "api-docs",
              "orders-api.yml"
            ),
            owners: ["order-management"],
            id: "Orders API",
          },
        ],
        domain: { id: "orders", name: "Orders", version: "0.0.1" },
      },
    ],
    [
      "@eventcatalog/generator-asyncapi",
      {
        services: [
          {
            path: path.join(
              __dirname,
              "../../",
              "src",
              "inventory-service",
              "api-docs",
              "inventory-service.yml"
            ),
            owners: ["inventory-service"],
            id: "Inventory Service",
          },
        ],
        domain: {
          id: "inventory-domain",
          name: "Inventory Domain",
          version: "0.0.1",
        },
      },
    ],
    [
      "@eventcatalog/generator-openapi",
      {
        services: [
          {
            path: path.join(
              __dirname,
              "../../",
              "src",
              "inventory-service",
              "api-docs",
              "inventory-api.yml"
            ),
            owners: ["inventory-service"],
            id: "Inventory Service",
          },
        ],
        domain: {
          id: "inventory-domain",
          name: "Inventory Domain",
          version: "0.0.1",
        },
      },
    ],
    [
      "@eventcatalog/generator-openapi",
      {
        services: [
          {
            path: path.join(
              __dirname,
              "../../",
              "src",
              "product-management-service",
              "api-docs",
              "product-api.yml"
            ),
            owners: ["product-management"],
            id: "Product API",
          },
        ],
        domain: { id: "products", name: "Products", version: "0.0.1" },
      },
    ],
    [
      "@eventcatalog/generator-asyncapi",
      {
        services: [
          {
            path: path.join(
              __dirname,
              "../../",
              "src",
              "product-management-service",
              "api-docs",
              "product-api-events.yml"
            ),
            owners: ["product-management"],
            id: "Product API",
          },
          {
            path: path.join(
              __dirname,
              "../../",
              "src",
              "product-management-service",
              "api-docs",
              "product-acl.yml"
            ),
            owners: ["product-management"],
            id: "Product Management Service",
          },
        ],
        domain: { id: "products", name: "Products", version: "0.0.1" },
      },
    ],
    [
      "@eventcatalog/generator-openapi",
      {
        services: [
          {
            path: path.join(
              __dirname,
              "../../",
              "src",
              "user-management-service",
              "api-docs",
              "user-mgmt-api.yml"
            ),
            owners: ["user-management"],
            id: "User Management API",
          },
        ],
        domain: { id: "users", name: "Users", version: "0.0.1" },
      },
    ],
    [
      "@eventcatalog/generator-asyncapi",
      {
        services: [
          {
            path: path.join(
              __dirname,
              "../../",
              "src",
              "user-management-service",
              "api-docs",
              "user-mgmt-api-events.yml"
            ),
            owners: ["user-management"],
            id: "User Management API",
          },
          {
            path: path.join(
              __dirname,
              "../../",
              "src",
              "user-management-service",
              "api-docs",
              "user-mgmt-acl.yml"
            ),
            owners: ["user-management"],
            id: "User Management Service",
          },
        ],
        domain: { id: "users", name: "Users", version: "0.0.1" },
      },
    ],
    [
      "@eventcatalog/generator-openapi",
      {
        services: [
          {
            path: path.join(
              __dirname,
              "../../",
              "src",
              "loyalty-point-service",
              "api-docs",
              "loyalty-api.yml"
            ),
            owners: ["loyalty-points"],
            id: "Loyalty Points",
          },
        ],
        domain: { id: "loyalty", name: "Loyalty Points", version: "0.0.1" },
      },
    ],
    [
      "@eventcatalog/generator-asyncapi",
      {
        services: [
          {
            path: path.join(
              __dirname,
              "../../",
              "src",
              "loyalty-point-service",
              "api-docs",
              "loyalty-service.yml"
            ),
            owners: ["loyalty-points"],
            id: "Loyalty Points",
          },
        ],
        domain: { id: "loyalty", name: "Loyalty Points", version: "0.0.1" },
      },
    ],
  ],
  docs: {
    sidebar: {
      // TREE_VIEW will render the DOCS as a tree view and map your file system folder structure
      // FLAT_VIEW will render the DOCS as a flat list (no nested folders)
      type: "TREE_VIEW",
    },
  },
  // Enable RSS feed for your eventcatalog
  rss: {
    enabled: true,
    // number of items to include in the feed per resource (event, service, etc)
    limit: 20,
  },
  // required random generated id used by eventcatalog
  cId: "9e719d6b-a80f-46b8-b528-f429ea4944f4",
};
