"use strict";

var _interopRequire = function (obj) { return obj && obj.__esModule ? obj["default"] : obj; };

var _createClass = (function () { function defineProperties(target, props) { for (var key in props) { var prop = props[key]; prop.configurable = true; if (prop.value) prop.writable = true; } Object.defineProperties(target, props); } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

Object.defineProperty(exports, "__esModule", {
  value: true
});

var xdr = _interopRequire(require("./generated/stellar-xdr_generated"));

var Keypair = require("./keypair").Keypair;

var StrKey = require("./strkey").StrKey;

var clone = _interopRequire(require("lodash/clone"));

var padEnd = _interopRequire(require("lodash/padEnd"));

var trimEnd = _interopRequire(require("lodash/trimEnd"));

/**
 * Asset class represents an asset, either the native asset (`XLM`)
 * or an asset code / issuer account ID pair.
 *
 * An asset code describes an asset code and issuer pair. In the case of the native
 * asset XLM, the issuer will be null.
 *
 * @constructor
 * @param {string} code - The asset code.
 * @param {string} issuer - The account ID of the issuer.
 */

var Asset = exports.Asset = (function () {
  function Asset(code, issuer) {
    _classCallCheck(this, Asset);

    if (!/^[a-zA-Z0-9]{1,12}$/.test(code)) {
      throw new Error("Asset code is invalid (maximum alphanumeric, 12 characters at max)");
    }
    if (String(code).toLowerCase() !== "xlm" && !issuer) {
      throw new Error("Issuer cannot be null");
    }
    if (issuer && !StrKey.isValidEd25519PublicKey(issuer)) {
      throw new Error("Issuer is invalid");
    }

    this.code = code;
    this.issuer = issuer;
  }

  _createClass(Asset, {
    toXDRObject: {

      /**
       * Returns the xdr object for this asset.
       * @returns {xdr.Asset}
       */

      value: function toXDRObject() {
        if (this.isNative()) {
          return xdr.Asset.assetTypeNative();
        }

        var xdrType = undefined,
            xdrTypeString = undefined;
        if (this.code.length <= 4) {
          xdrType = xdr.AssetAlphaNum4;
          xdrTypeString = "assetTypeCreditAlphanum4";
        } else {
          xdrType = xdr.AssetAlphaNum12;
          xdrTypeString = "assetTypeCreditAlphanum12";
        }

        // pad code with null bytes if necessary
        var padLength = this.code.length <= 4 ? 4 : 12;
        var paddedCode = padEnd(this.code, padLength, "\u0000");

        var assetType = new xdrType({
          assetCode: paddedCode,
          issuer: Keypair.fromPublicKey(this.issuer).xdrAccountId()
        });

        return new xdr.Asset(xdrTypeString, assetType);
      }
    },
    getCode: {

      /**
       * Return the asset code
       * @returns {string}
       */

      value: function getCode() {
        return clone(this.code);
      }
    },
    getIssuer: {

      /**
       * Return the asset issuer
       * @returns {string}
       */

      value: function getIssuer() {
        return clone(this.issuer);
      }
    },
    getAssetType: {

      /**
       * Return the asset type. Can be one of following types:
       *
       * * `native`
       * * `credit_alphanum4`
       * * `credit_alphanum12`
       *
       * @see [Assets concept](https://www.stellar.org/developers/learn/concepts/assets.html)
       * @returns {string}
       */

      value: function getAssetType() {
        if (this.isNative()) {
          return "native";
        }
        if (this.code.length >= 1 && this.code.length <= 4) {
          return "credit_alphanum4";
        }
        if (this.code.length >= 5 && this.code.length <= 12) {
          return "credit_alphanum12";
        }
      }
    },
    isNative: {

      /**
       * Returns true if this asset object is the native asset.
       * @returns {boolean}
       */

      value: function isNative() {
        return !this.issuer;
      }
    },
    equals: {

      /**
       * Returns true if this asset equals the given asset.
       * @param {Asset} asset Asset to compare
       * @returns {boolean}
       */

      value: function equals(asset) {
        return this.code == asset.getCode() && this.issuer == asset.getIssuer();
      }
    }
  }, {
    native: {

      /**
       * Returns an asset object for the native asset.
       * @Return {Asset}
       */

      value: function native() {
        return new Asset("XLM");
      }
    },
    fromOperation: {

      /**
       * Returns an asset object from its XDR object representation.
       * @param {xdr.Asset} assetXdr - The asset xdr object.
       * @returns {Asset}
       */

      value: function fromOperation(assetXdr) {
        var anum = undefined,
            code = undefined,
            issuer = undefined;
        switch (assetXdr["switch"]()) {
          case xdr.AssetType.assetTypeNative():
            return this.native();
          case xdr.AssetType.assetTypeCreditAlphanum4():
            anum = assetXdr.alphaNum4();
          /* falls through */
          case xdr.AssetType.assetTypeCreditAlphanum12():
            anum = anum || assetXdr.alphaNum12();
            issuer = StrKey.encodeEd25519PublicKey(anum.issuer().ed25519());
            code = trimEnd(anum.assetCode(), "\u0000");
            return new this(code, issuer);
          default:
            throw new Error("Invalid asset type: " + assetXdr["switch"]().name);
        }
      }
    }
  });

  return Asset;
})();