"use strict";

var _interopRequire = function (obj) { return obj && obj.__esModule ? obj["default"] : obj; };

Object.defineProperty(exports, "__esModule", {
  value: true
});

var xdr = _interopRequire(require("../generated/stellar-xdr_generated"));

var isUndefined = _interopRequire(require("lodash/isUndefined"));

/**
 * Returns a XDR CreatePasiveOfferOp. A "create passive offer" operation creates an
 * offer that won't consume a counter offer that exactly matches this offer. This is
 * useful for offers just used as 1:1 exchanges for path payments. Use manage offer
 * to manage this offer after using this operation to create it.
 * @function
 * @alias Operation.createPassiveOffer
 * @param {object} opts
 * @param {Asset} opts.selling - What you're selling.
 * @param {Asset} opts.buying - What you're buying.
 * @param {string} opts.amount - The total amount you're selling. If 0, deletes the offer.
 * @param {number|string|BigNumber|Object} opts.price - Price of 1 unit of `selling` in terms of `buying`.
 * @param {number} opts.price.n - If `opts.price` is an object: the price numerator
 * @param {number} opts.price.d - If `opts.price` is an object: the price denominator
 * @param {string} [opts.source] - The source account (defaults to transaction source).
 * @throws {Error} Throws `Error` when the best rational approximation of `price` cannot be found.
 * @returns {xdr.CreatePassiveOfferOp}
 */
var createPassiveOffer = function createPassiveOffer(opts) {
  var attributes = {};
  attributes.selling = opts.selling.toXDRObject();
  attributes.buying = opts.buying.toXDRObject();
  if (!this.isValidAmount(opts.amount)) {
    throw new TypeError(this.constructAmountRequirementsError("amount"));
  }
  attributes.amount = this._toXDRAmount(opts.amount);
  if (isUndefined(opts.price)) {
    throw new TypeError("price argument is required");
  }
  attributes.price = this._toXDRPrice(opts.price);
  var createPassiveOfferOp = new xdr.CreatePassiveOfferOp(attributes);

  var opAttributes = {};
  opAttributes.body = xdr.OperationBody.createPassiveOffer(createPassiveOfferOp);
  this.setSourceAccount(opAttributes, opts);

  return new xdr.Operation(opAttributes);
};
exports.createPassiveOffer = createPassiveOffer;