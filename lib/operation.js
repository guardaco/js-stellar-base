"use strict";

var _interopRequireWildcard = function (obj) { return obj && obj.__esModule ? obj : { "default": obj }; };

var _interopRequire = function (obj) { return obj && obj.__esModule ? obj["default"] : obj; };

var _createClass = (function () { function defineProperties(target, props) { for (var key in props) { var prop = props[key]; prop.configurable = true; if (prop.value) prop.writable = true; } Object.defineProperties(target, props); } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

Object.defineProperty(exports, "__esModule", {
  value: true
});

var xdr = _interopRequire(require("./generated/stellar-xdr_generated"));

var Keypair = require("./keypair").Keypair;

var hash = require("./hashing").hash;

var StrKey = require("./strkey").StrKey;

var Hyper = require("js-xdr").Hyper;

var Asset = require("./asset").Asset;

var BigNumber = _interopRequire(require("bignumber.js"));

var best_r = require("./util/continued_fraction").best_r;

var trimEnd = _interopRequire(require("lodash/trimEnd"));

var isUndefined = _interopRequire(require("lodash/isUndefined"));

var isString = _interopRequire(require("lodash/isString"));

var isNumber = _interopRequire(require("lodash/isNumber"));

var isFinite = _interopRequire(require("lodash/isFinite"));

var ops = _interopRequireWildcard(require("./operations/index"));

var ONE = 10000000;
var MAX_INT64 = "9223372036854775807";

/**
 * When set using `{@link Operation.setOptions}` option, requires the issuing account to
 * give other accounts permission before they can hold the issuing account’s credit.
 * @constant
 * @see [Account flags](https://www.stellar.org/developers/guides/concepts/accounts.html#flags)
 */
var AuthRequiredFlag = 1 << 0;
exports.AuthRequiredFlag = AuthRequiredFlag;
/**
 * When set using `{@link Operation.setOptions}` option, allows the issuing account to
 * revoke its credit held by other accounts.
 * @constant
 * @see [Account flags](https://www.stellar.org/developers/guides/concepts/accounts.html#flags)
 */
var AuthRevocableFlag = 1 << 1;
exports.AuthRevocableFlag = AuthRevocableFlag;
/**
 * When set using `{@link Operation.setOptions}` option, then none of the authorization flags
 * can be set and the account can never be deleted.
 * @constant
 * @see [Account flags](https://www.stellar.org/developers/guides/concepts/accounts.html#flags)
 */
var AuthImmutableFlag = 1 << 2;

exports.AuthImmutableFlag = AuthImmutableFlag;
/**
 * `Operation` class represents [operations](https://www.stellar.org/developers/learn/concepts/operations.html) in Stellar network.
 * Use one of static methods to create operations:
 * * `{@link Operation.createAccount}`
 * * `{@link Operation.payment}`
 * * `{@link Operation.pathPayment}`
 * * `{@link Operation.manageOffer}`
 * * `{@link Operation.createPassiveOffer}`
 * * `{@link Operation.setOptions}`
 * * `{@link Operation.changeTrust}`
 * * `{@link Operation.allowTrust}`
 * * `{@link Operation.accountMerge}`
 * * `{@link Operation.inflation}`
 * * `{@link Operation.manageData}`
 * * `{@link Operation.bumpSequence}`
 *
 * @class Operation
 */

var Operation = exports.Operation = (function () {
  function Operation() {
    _classCallCheck(this, Operation);
  }

  _createClass(Operation, null, {
    setSourceAccount: {
      value: function setSourceAccount(opAttributes, opts) {
        if (opts.source) {
          if (!StrKey.isValidEd25519PublicKey(opts.source)) {
            throw new Error("Source address is invalid");
          }
          opAttributes.sourceAccount = Keypair.fromPublicKey(opts.source).xdrAccountId();
        }
      }
    },
    fromXDRObject: {

      /**
       * Converts the XDR Operation object to the opts object used to create the XDR
       * operation.
       * @param {xdr.Operation} operation - An XDR Operation.
       * @return {Operation}
       */

      value: function fromXDRObject(operation) {
        function accountIdtoAddress(accountId) {
          return StrKey.encodeEd25519PublicKey(accountId.ed25519());
        }

        var result = {};
        if (operation.sourceAccount()) {
          result.source = accountIdtoAddress(operation.sourceAccount());
        }

        var attrs = operation.body().value();
        switch (operation.body()["switch"]().name) {
          case "createAccount":
            result.type = "createAccount";
            result.destination = accountIdtoAddress(attrs.destination());
            result.startingBalance = this._fromXDRAmount(attrs.startingBalance());
            break;
          case "payment":
            result.type = "payment";
            result.destination = accountIdtoAddress(attrs.destination());
            result.asset = Asset.fromOperation(attrs.asset());
            result.amount = this._fromXDRAmount(attrs.amount());
            break;
          case "pathPayment":
            result.type = "pathPayment";
            result.sendAsset = Asset.fromOperation(attrs.sendAsset());
            result.sendMax = this._fromXDRAmount(attrs.sendMax());
            result.destination = accountIdtoAddress(attrs.destination());
            result.destAsset = Asset.fromOperation(attrs.destAsset());
            result.destAmount = this._fromXDRAmount(attrs.destAmount());
            var path = attrs.path();
            result.path = [];
            for (var i in path) {
              result.path.push(Asset.fromOperation(path[i]));
            }
            break;
          case "changeTrust":
            result.type = "changeTrust";
            result.line = Asset.fromOperation(attrs.line());
            result.limit = this._fromXDRAmount(attrs.limit());
            break;
          case "allowTrust":
            result.type = "allowTrust";
            result.trustor = accountIdtoAddress(attrs.trustor());
            result.assetCode = attrs.asset().value().toString();
            result.assetCode = trimEnd(result.assetCode, "\u0000");
            result.authorize = attrs.authorize();
            break;
          case "setOption":
            result.type = "setOptions";
            if (attrs.inflationDest()) {
              result.inflationDest = accountIdtoAddress(attrs.inflationDest());
            }

            result.clearFlags = attrs.clearFlags();
            result.setFlags = attrs.setFlags();
            result.masterWeight = attrs.masterWeight();
            result.lowThreshold = attrs.lowThreshold();
            result.medThreshold = attrs.medThreshold();
            result.highThreshold = attrs.highThreshold();
            // home_domain is checked by iscntrl in stellar-core
            result.homeDomain = attrs.homeDomain() !== undefined ? attrs.homeDomain().toString("ascii") : undefined;

            if (attrs.signer()) {
              var signer = {};
              var arm = attrs.signer().key().arm();
              if (arm == "ed25519") {
                signer.ed25519PublicKey = accountIdtoAddress(attrs.signer().key());
              } else if (arm == "preAuthTx") {
                signer.preAuthTx = attrs.signer().key().preAuthTx();
              } else if (arm == "hashX") {
                signer.sha256Hash = attrs.signer().key().hashX();
              }

              signer.weight = attrs.signer().weight();
              result.signer = signer;
            }
            break;
          case "manageOffer":
            result.type = "manageOffer";
            result.selling = Asset.fromOperation(attrs.selling());
            result.buying = Asset.fromOperation(attrs.buying());
            result.amount = this._fromXDRAmount(attrs.amount());
            result.price = this._fromXDRPrice(attrs.price());
            result.offerId = attrs.offerId().toString();
            break;
          case "createPassiveOffer":
            result.type = "createPassiveOffer";
            result.selling = Asset.fromOperation(attrs.selling());
            result.buying = Asset.fromOperation(attrs.buying());
            result.amount = this._fromXDRAmount(attrs.amount());
            result.price = this._fromXDRPrice(attrs.price());
            break;
          case "accountMerge":
            result.type = "accountMerge";
            result.destination = accountIdtoAddress(attrs);
            break;
          case "manageDatum":
            result.type = "manageData";
            // manage_data.name is checked by iscntrl in stellar-core
            result.name = attrs.dataName().toString("ascii");
            result.value = attrs.dataValue();
            break;
          case "inflation":
            result.type = "inflation";
            break;
          case "bumpSequence":
            result.type = "bumpSequence";
            result.bumpTo = attrs.bumpTo().toString();
            break;
          default:
            throw new Error("Unknown operation");
        }
        return result;
      }
    },
    isValidAmount: {
      value: function isValidAmount(value) {
        var allowZero = arguments[1] === undefined ? false : arguments[1];

        if (!isString(value)) {
          return false;
        }

        var amount = undefined;
        try {
          amount = new BigNumber(value);
        } catch (e) {
          return false;
        }

        switch (true) {
          // == 0
          case !allowZero && amount.isZero():
          // < 0
          case amount.isNegative():
          // > Max value
          case amount.times(ONE).greaterThan(new BigNumber(MAX_INT64).toString()):
          // Decimal places (max 7)
          case amount.decimalPlaces() > 7:
          // NaN or Infinity
          case amount.isNaN() || !amount.isFinite():
            return false;
          default:
            return true;
        }
      }
    },
    constructAmountRequirementsError: {
      value: function constructAmountRequirementsError(arg) {
        return "" + arg + " argument must be of type String, represent a positive number and have at most 7 digits after the decimal";
      }
    },
    _checkUnsignedIntValue: {

      /**
       * Returns value converted to uint32 value or undefined.
       * If `value` is not `Number`, `String` or `Undefined` then throws an error.
       * Used in {@link Operation.setOptions}.
       * @private
       * @param {string} name Name of the property (used in error message only)
       * @param {*} value Value to check
       * @param {function(value, name)} isValidFunction Function to check other constraints (the argument will be a `Number`)
       * @returns {undefined|Number}
       * @private
       */

      value: function _checkUnsignedIntValue(name, value) {
        var isValidFunction = arguments[2] === undefined ? null : arguments[2];

        if (isUndefined(value)) {
          return undefined;
        }

        if (isString(value)) {
          value = parseFloat(value);
        }

        switch (true) {
          case !isNumber(value) || !isFinite(value) || value % 1 !== 0:
            throw new Error("" + name + " value is invalid");
          case value < 0:
            throw new Error("" + name + " value must be unsigned");
          case !isValidFunction || isValidFunction && isValidFunction(value, name):
            return value;
          default:
            throw new Error("" + name + " value is invalid");
        }
      }
    },
    _toXDRAmount: {

      /**
       * @private
       */

      value: function _toXDRAmount(value) {
        var amount = new BigNumber(value).mul(ONE);
        return Hyper.fromString(amount.toString());
      }
    },
    _fromXDRAmount: {

      /**
       * @private
       */

      value: function _fromXDRAmount(value) {
        return new BigNumber(value).div(ONE).toString();
      }
    },
    _fromXDRPrice: {

      /**
       * @private
       */

      value: function _fromXDRPrice(price) {
        var n = new BigNumber(price.n());
        return n.div(new BigNumber(price.d())).toString();
      }
    },
    _toXDRPrice: {

      /**
       * @private
       */

      value: function _toXDRPrice(price) {
        var xdrObject = undefined;
        if (price.n && price.d) {
          xdrObject = new xdr.Price(price);
        } else {
          price = new BigNumber(price);
          var approx = best_r(price);
          xdrObject = new xdr.Price({
            n: parseInt(approx[0]),
            d: parseInt(approx[1])
          });
        }

        if (xdrObject.n() < 0 || xdrObject.d() < 0) {
          throw new Error("price must be positive");
        }

        return xdrObject;
      }
    }
  });

  return Operation;
})();

// Attach all imported operations as static methods on the Operation class
Operation.accountMerge = ops.accountMerge;
Operation.allowTrust = ops.allowTrust;
Operation.bumpSequence = ops.bumpSequence;
Operation.changeTrust = ops.changeTrust;
Operation.createAccount = ops.createAccount;
Operation.createPassiveOffer = ops.createPassiveOffer;
Operation.inflation = ops.inflation;
Operation.manageData = ops.manageData;
Operation.manageOffer = ops.manageOffer;
Operation.pathPayment = ops.pathPayment;
Operation.payment = ops.payment;
Operation.setOptions = ops.setOptions;