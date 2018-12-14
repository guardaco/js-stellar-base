"use strict";

var _interopRequire = function (obj) { return obj && obj.__esModule ? obj["default"] : obj; };

var _createClass = (function () { function defineProperties(target, props) { for (var key in props) { var prop = props[key]; prop.configurable = true; if (prop.value) prop.writable = true; } Object.defineProperties(target, props); } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

Object.defineProperty(exports, "__esModule", {
  value: true
});

var xdr = _interopRequire(require("./generated/stellar-xdr_generated"));

var UnsignedHyper = require("js-xdr").UnsignedHyper;

var hash = require("./hashing").hash;

var Keypair = require("./keypair").Keypair;

var Account = require("./account").Account;

var Operation = require("./operation").Operation;

var Transaction = require("./transaction").Transaction;

var Memo = require("./memo").Memo;

var BigNumber = _interopRequire(require("bignumber.js"));

var clone = _interopRequire(require("lodash/clone"));

var map = _interopRequire(require("lodash/map"));

var isUndefined = _interopRequire(require("lodash/isUndefined"));

var BASE_FEE = 100; // Stroops

/**
 * @constant
 * @see {@link TransactionBuilder#setTimeout}
 * @see [Timeout](https://www.stellar.org/developers/horizon/reference/endpoints/transactions-create.html#timeout)
 */
var TimeoutInfinite = 0;

exports.TimeoutInfinite = TimeoutInfinite;
/**
 * <p>Transaction builder helps constructs a new `{@link Transaction}` using the given {@link Account}
 * as the transaction's "source account". The transaction will use the current sequence
 * number of the given account as its sequence number and increment the given account's
 * sequence number by one. The given source account must include a private key for signing
 * the transaction or an error will be thrown.</p>
 *
 * <p>Operations can be added to the transaction via their corresponding builder methods, and
 * each returns the TransactionBuilder object so they can be chained together. After adding
 * the desired operations, call the `build()` method on the `TransactionBuilder` to return a fully
 * constructed `{@link Transaction}` that can be signed. The returned transaction will contain the
 * sequence number of the source account and include the signature from the source account.</p>
 *
 * <p>The following code example creates a new transaction with {@link Operation.createAccount} and
 * {@link Operation.payment} operations.
 * The Transaction's source account first funds `destinationA`, then sends
 * a payment to `destinationB`. The built transaction is then signed by `sourceKeypair`.</p>
 *
 * ```
 * var transaction = new TransactionBuilder(source)
 *  .addOperation(Operation.createAccount({
        destination: destinationA,
        startingBalance: "20"
    }) // <- funds and creates destinationA
    .addOperation(Operation.payment({
        destination: destinationB,
        amount: "100"
        asset: Asset.native()
    }) // <- sends 100 XLM to destinationB
 *   .setTimeout(30)
 *   .build();
 *
 * transaction.sign(sourceKeypair);
 * ```
 * @constructor
 * @param {Account} sourceAccount - The source account for this transaction.
 * @param {object} [opts]
 * @param {number} [opts.fee] - The max fee willing to pay per operation in this transaction (**in stroops**).
 * @param {object} [opts.timebounds] - The timebounds for the validity of this transaction.
 * @param {number|string} [opts.timebounds.minTime] - 64 bit unix timestamp
 * @param {number|string} [opts.timebounds.maxTime] - 64 bit unix timestamp
 * @param {Memo} [opts.memo] - The memo for the transaction
 */

var TransactionBuilder = exports.TransactionBuilder = (function () {
  function TransactionBuilder(sourceAccount) {
    var opts = arguments[1] === undefined ? {} : arguments[1];

    _classCallCheck(this, TransactionBuilder);

    if (!sourceAccount) {
      throw new Error("must specify source account for the transaction");
    }
    this.source = sourceAccount;
    this.operations = [];
    this.baseFee = isUndefined(opts.fee) ? BASE_FEE : opts.fee;
    this.timebounds = clone(opts.timebounds);
    this.memo = opts.memo || Memo.none();
    this.timeoutSet = false;
  }

  _createClass(TransactionBuilder, {
    addOperation: {

      /**
       * Adds an operation to the transaction.
       * @param {xdr.Operation} operation The xdr operation object, use {@link Operation} static methods.
       * @returns {TransactionBuilder}
       */

      value: function addOperation(operation) {
        this.operations.push(operation);
        return this;
      }
    },
    addMemo: {

      /**
       * Adds a memo to the transaction.
       * @param {Memo} memo {@link Memo} object
       * @returns {TransactionBuilder}
       */

      value: function addMemo(memo) {
        this.memo = memo;
        return this;
      }
    },
    setTimeout: {

      /**
       * Because of the distributed nature of the Stellar network it is possible that the status of your transaction
       * will be determined after a long time if the network is highly congested.
       * If you want to be sure to receive the status of the transaction within a given period you should set the
       * {@link TimeBounds} with <code>maxTime</code> on the transaction (this is what <code>setTimeout</code> does
       * internally; if there's <code>minTime</code> set but no <code>maxTime</code> it will be added).
       * Call to <code>TransactionBuilder.setTimeout</code> is required if Transaction does not have <code>max_time</code> set.
       * If you don't want to set timeout, use <code>{@link TimeoutInfinite}</code>. In general you should set
       * <code>{@link TimeoutInfinite}</code> only in smart contracts.
       *
       * Please note that Horizon may still return <code>504 Gateway Timeout</code> error, even for short timeouts.
       * In such case you need to resubmit the same transaction again without making any changes to receive a status.
       * This method is using the machine system time (UTC), make sure it is set correctly.
       * @param {timeout} Timeout in seconds.
       * @return {TransactionBuilder}
       * @see TimeoutInfinite
       */

      value: function setTimeout(timeout) {
        if (this.timebounds != null && this.timebounds.maxTime > 0) {
          throw new Error("TimeBounds.max_time has been already set - setting timeout would overwrite it.");
        }

        if (timeout < 0) {
          throw new Error("timeout cannot be negative");
        }

        this.timeoutSet = true;
        if (timeout > 0) {
          var timeoutTimestamp = Math.floor(Date.now() / 1000) + timeout;
          if (this.timebounds == null) {
            this.timebounds = { minTime: 0, maxTime: timeoutTimestamp };
          } else {
            this.timebounds = { minTime: this.timebounds.minTime, maxTime: timeoutTimestamp };
          }
        }

        return this;
      }
    },
    build: {

      /**
       * This will build the transaction.
       * It will also increment the source account's sequence number by 1.
       * @returns {Transaction} This method will return the built {@link Transaction}.
       */

      value: function build() {
        // Ensure setTimeout called or maxTime is set
        if ((this.timebounds == null || this.timebounds != null && this.timebounds.maxTime == 0) && !this.timeoutSet) {
          throw new Error("TimeBounds has to be set or you must call setTimeout(TimeoutInfinite).");
        }

        var sequenceNumber = new BigNumber(this.source.sequenceNumber()).add(1);

        var attrs = {
          sourceAccount: Keypair.fromPublicKey(this.source.accountId()).xdrAccountId(),
          fee: this.baseFee * this.operations.length,
          seqNum: xdr.SequenceNumber.fromString(sequenceNumber.toString()),
          memo: this.memo ? this.memo.toXDRObject() : null,
          ext: new xdr.TransactionExt(0)
        };

        if (this.timebounds) {
          this.timebounds.minTime = UnsignedHyper.fromString(this.timebounds.minTime.toString());
          this.timebounds.maxTime = UnsignedHyper.fromString(this.timebounds.maxTime.toString());
          attrs.timeBounds = new xdr.TimeBounds(this.timebounds);
        }

        var xtx = new xdr.Transaction(attrs);
        xtx.operations(this.operations);

        var xenv = new xdr.TransactionEnvelope({ tx: xtx });
        var tx = new Transaction(xenv);

        this.source.incrementSequenceNumber();

        return tx;
      }
    }
  });

  return TransactionBuilder;
})();