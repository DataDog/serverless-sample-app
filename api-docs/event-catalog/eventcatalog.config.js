import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

/** @type {import('@eventcatalog/core/bin/eventcatalog.config').Config} */
export default {
  title: 'EventCatalog',
  tagline: 'Discover, Explore and Document your Event Driven Architectures',
  organizationName: 'ServerlessJames',
  homepageLink: 'https://eventcatalog.dev/',
  editUrl: 'https://github.com/boyney123/eventcatalog-demo/edit/master',
  // By default set to false, add true to get urls ending in /
  trailingSlash: false,
  // Change to make the base url of the site different, by default https://{website}.com/docs,
  // changing to /company would be https://{website}.com/company/docs,
  base: '/',
  logo: {
    alt: 'EventCatalog Logo',
    src: '/logo.png',
    text: 'EventCatalog',
  },
  generators: [
    [
      '@eventcatalog/generator-asyncapi',
      {
        services: [
          { path: path.join(__dirname, '../../', 'src', 'order-service', 'api-docs', 'orders-api.yml'), owners: ['order-management'], id: 'Orders API' },
          { path: path.join(__dirname, '../../', 'src', 'order-service', 'api-docs', 'orders-acl.yml'), owners: ['order-management'], id: 'Orders ACL' },
        ],
        domain: { id: 'orders', name: 'Orders', version: '0.0.1' },
      },
    ],
    [
      '@eventcatalog/generator-asyncapi',
      {
        services: [
          { path: path.join(__dirname, '../../', 'src', 'inventory-service', 'api-docs', 'inventory-service.yml'), owners: ['inventory-service'], id: 'Inventory Service' },
        ],
        domain: { id: 'inventory-domain', name: 'Inventory Domain', version: '0.0.1' },
        debug: true
      },
    ],
    [
      '@eventcatalog/generator-asyncapi',
      {
        services: [
          { path: path.join(__dirname, '../../', 'src', 'product-management-service', 'api-docs', 'product-service.yml'), owners: ['product-management'], id: 'Product Management Service' },
        ],
        domain: { id: 'product-domain', name: 'Product Domain', version: '0.0.1' },
        debug: true
      },
    ],
  ],
  docs: {
    sidebar: {
      // TREE_VIEW will render the DOCS as a tree view and map your file system folder structure
      // FLAT_VIEW will render the DOCS as a flat list (no nested folders)
      type: 'TREE_VIEW'
    },
  },
  // Enable RSS feed for your eventcatalog
  rss: {
    enabled: true,
    // number of items to include in the feed per resource (event, service, etc)
    limit: 20
  },
  // required random generated id used by eventcatalog
  cId: '9e719d6b-a80f-46b8-b528-f429ea4944f4'
};
