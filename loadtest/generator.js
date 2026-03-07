const crypto = require("crypto");

module.exports = {
  generateEmailAddress: function (context, events, done) {
    context.vars.Email = `${crypto.randomUUID()}@example.com`;
    context.vars.Password = `Test!23`;

    return done();
  },
  setOrderProducts: function (context, events, done) {
    const randomIndex = Math.round(
      Math.random() * context.vars.products.length
    );

    context.vars.OrderProducts = [context.vars.products[randomIndex].productId];

    return done();
  },
  setOutOfStockProductId: function (context, events, done) {
    const zeroStockProducts = context.vars.products.filter(
      (product) => product.stockLevel === 0
    );

    if (zeroStockProducts.length === 0) {
      return done();
    }

    const randomIndex = Math.round(Math.random() * zeroStockProducts.length);
    context.vars.ProductId = zeroStockProducts[randomIndex].productId;

    return done();
  },
  getLatestConfirmedOrder: function (context, events, done) {
    if (
      !context.vars.confirmedOrders ||
      context.vars.confirmedOrders.items.length === 0
    ) {
      return done();
    }

    context.vars.ConfirmedOrderId =
      context.vars.confirmedOrders.items[0].orderId;
    context.vars.ConfirmedOrderUserId =
      context.vars.confirmedOrders.items[0].userId;

    return done();
  },
  generateRestockAmount: function (context, events, done) {
    if (context.vars.currentStockLevel > 0) {
      context.vars.NewStockLevel = context.vars.currentStockLevel;
      return done();
    }

    const randomStockLevel = Math.round(Math.random() * 10);
    context.vars.NewStockLevel = randomStockLevel;

    return done();
  },
  generateProductName: function (context, events, done) {
    context.vars.ProductName = crypto.randomUUID().toString().slice(0, 10);
    const randomPrice = Math.round(Math.random() * 10);
    context.vars.Price = randomPrice;

    return done();
  },
  generateSearchQuery: function (context, events, done) {
    const queries = [
      "products suitable for outdoor activities",
      "items for a relaxing afternoon",
      "gifts for someone who loves cooking",
      "affordable products under ten dollars",
      "premium items for special occasions",
      "products great for beginners",
      "items perfect for the office",
      "something unique and handmade",
      "popular products in stock",
      "products for a cozy evening at home",
    ];
    const idx = Math.floor(Math.random() * queries.length);
    context.vars.SearchQuery = queries[idx];
    return done();
  },
};
