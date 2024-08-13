const crypto = require("crypto");

module.exports = {
  generateProduct: function (context, events, done) {
    context.vars.Name = crypto.randomUUID();

    const min = -0;
    const max = 99;
    const diff = max - min;

    context.vars.Price = Math.random() * diff + min;
    context.vars.UpdatedPrice = Math.random() * diff + min;

    return done();
  },
};
