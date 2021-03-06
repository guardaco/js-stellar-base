"use strict";

var _interopRequire = function (obj) { return obj && obj.__esModule ? obj["default"] : obj; };

Object.defineProperty(exports, "__esModule", {
  value: true
});

var xdr = _interopRequire(require("../generated/stellar-xdr_generated"));

var Keypair = require("../keypair").Keypair;

var StrKey = require("../strkey").StrKey;

/**
 * Returns a XDR PaymentOp. A "payment" operation send the specified amount to the
 * destination account, optionally through a path. XLM payments create the destination
 * account if it does not exist.
 * @function
 * @alias Operation.pathPayment
 * @param {object} opts
 * @param {Asset} opts.sendAsset - The asset to pay with.
 * @param {string} opts.sendMax - The maximum amount of sendAsset to send.
 * @param {string} opts.destination - The destination account to send to.
 * @param {Asset} opts.destAsset - The asset the destination will receive.
 * @param {string} opts.destAmount - The amount the destination receives.
 * @param {Asset[]} opts.path - An array of Asset objects to use as the path.
 * @param {string} [opts.source] - The source account for the payment. Defaults to the transaction's source account.
 * @returns {xdr.PathPaymentOp}
 */
var pathPayment = function pathPayment(opts) {
  switch (true) {
    case !opts.sendAsset:
      throw new Error("Must specify a send asset");
    case !this.isValidAmount(opts.sendMax):
      throw new TypeError(this.constructAmountRequirementsError("sendMax"));
    case !StrKey.isValidEd25519PublicKey(opts.destination):
      throw new Error("destination is invalid");
    case !opts.destAsset:
      throw new Error("Must provide a destAsset for a payment operation");
    case !this.isValidAmount(opts.destAmount):
      throw new TypeError(this.constructAmountRequirementsError("destAmount"));
  }

  var attributes = {};
  attributes.sendAsset = opts.sendAsset.toXDRObject();
  attributes.sendMax = this._toXDRAmount(opts.sendMax);
  attributes.destination = Keypair.fromPublicKey(opts.destination).xdrAccountId();
  attributes.destAsset = opts.destAsset.toXDRObject();
  attributes.destAmount = this._toXDRAmount(opts.destAmount);

  var path = opts.path ? opts.path : [];
  attributes.path = path.map(function (x) {
    return x.toXDRObject();
  });

  var payment = new xdr.PathPaymentOp(attributes);

  var opAttributes = {};
  opAttributes.body = xdr.OperationBody.pathPayment(payment);
  this.setSourceAccount(opAttributes, opts);

  return new xdr.Operation(opAttributes);
};
exports.pathPayment = pathPayment;