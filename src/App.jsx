import { useEffect, useRef, useState } from "react";
import { isConnected, getAddress } from "@stellar/freighter-api";
import { Horizon } from "@stellar/stellar-sdk";
import { LEVEL4_NETWORK } from "./contractInfo";
import "./App.css";

const horizonServer = new Horizon.Server("https://horizon-testnet.stellar.org");

const EXCHANGE_RATES_TO_VND = {
  USDC: 26340,
  USDT: 26340,
  ETH: 61124000,
  USD: 26340,
  VND: 1,
  EUR: 28500,
};

function App() {
  const [publicKey, setPublicKey] = useState("");
  const [xlmBalance, setXlmBalance] = useState("");

  const [walletKitStatus, setWalletKitStatus] = useState(
    "Connect your wallet to start a merchant payment."
  );

  const [paymentMethod, setPaymentMethod] = useState("stablecoin");
  const [selectedStablecoin, setSelectedStablecoin] = useState("USDC");
  const [selectedFiat, setSelectedFiat] = useState("USD");

  const [merchantAddress, setMerchantAddress] = useState("");
  const [merchantBillVnd, setMerchantBillVnd] = useState("24000");

  const [transactionStatus, setTransactionStatus] = useState("Idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [paymentMessage, setPaymentMessage] = useState(
    "No payment submitted yet."
  );

  const walletButtonRef = useRef(null);

  const currentPayCurrency =
    paymentMethod === "stablecoin" ? selectedStablecoin : selectedFiat;

  const currentExchangeRate =
    EXCHANGE_RATES_TO_VND[currentPayCurrency] || EXCHANGE_RATES_TO_VND.USD;

  const billAmount = Number(merchantBillVnd) || 0;
  const userPayAmount = billAmount > 0 ? billAmount / currentExchangeRate : 0;

  useEffect(() => {
    async function initWalletKit() {
      try {
        const sdk = await import("@creit.tech/stellar-wallets-kit/sdk");
        const utils = await import(
          "@creit.tech/stellar-wallets-kit/modules/utils"
        );

        const { StellarWalletsKit } = sdk;
        const { defaultModules } = utils;

        StellarWalletsKit.init({
          modules: defaultModules(),
        });

        if (walletButtonRef.current && StellarWalletsKit.createButton) {
          StellarWalletsKit.createButton(walletButtonRef.current);
        }

        setWalletKitStatus(
          "Choose Freighter from the wallet list to connect and sign testnet payments."
        );
      } catch (error) {
        setWalletKitStatus(
          "Wallet connection is prepared. Use Freighter on Stellar Testnet for this demo."
        );
      }
    }

    initWalletKit();
  }, []);

  useEffect(() => {
    const syncInterval = setInterval(() => {
      syncWalletState();
    }, 1000);

    return () => clearInterval(syncInterval);
  }, [publicKey]);

  function resetError() {
    setErrorMessage("");
  }

  function resetPaymentResult() {
    resetError();
    setTransactionStatus("Idle");
    setPaymentId("");
    setPaymentMessage("No payment submitted yet.");
  }

  function clearWalletState(message = "Wallet disconnected.") {
    setPublicKey("");
    setXlmBalance("");
    setTransactionStatus("Idle");
    setPaymentMessage(message);
  }

  async function syncWalletState() {
    try {
      const walletKitText = walletButtonRef.current?.innerText || "";

      if (walletKitText.includes("Connect Wallet")) {
        if (publicKey) {
          clearWalletState("Wallet disconnected.");
        }
        return;
      }

      const connected = await isConnected();

      if (!connected.isConnected) {
        if (publicKey) {
          clearWalletState("Wallet disconnected.");
        }
        return;
      }

      const addressResult = await getAddress();

      if (addressResult.error || !addressResult.address) {
        return;
      }

      if (addressResult.address !== publicKey) {
        setPublicKey(addressResult.address);
        await fetchXlmBalance(addressResult.address);

        setTransactionStatus("Ready");
        setPaymentMessage("Wallet connected. You can now pay a merchant.");
        resetError();
      }
    } catch (error) {
      console.log("Wallet sync skipped:", error.message);
    }
  }

  function handleWalletKitClick() {
    resetError();

    setTimeout(() => {
      syncWalletState();
    }, 1200);

    setTimeout(() => {
      syncWalletState();
    }, 3000);
  }

  async function fetchXlmBalance(address) {
    try {
      const account = await horizonServer.loadAccount(address);

      const nativeBalance = account.balances.find(
        (item) => item.asset_type === "native"
      );

      setXlmBalance(nativeBalance ? nativeBalance.balance : "0");
    } catch (error) {
      setTransactionStatus("Failed");
      setErrorMessage("Network fee balance fetch failed: " + error.message);
    }
  }

  function formatVnd(value) {
    return new Intl.NumberFormat("vi-VN").format(value);
  }

  function formatPayAmount(value, currency) {
    if (!value || value <= 0) return "0";

    if (currency === "ETH") {
      return value.toFixed(6);
    }

    if (currency === "VND") {
      return formatVnd(value);
    }

    return value.toFixed(4);
  }

  function shortAddress(address) {
    if (!address) return "";
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  }

  function validateCommonPaymentInput() {
    if (!merchantAddress) {
      setTransactionStatus("Failed");
      setErrorMessage("Please paste or enter the merchant address.");
      return false;
    }

    if (!merchantAddress.startsWith("G")) {
      setTransactionStatus("Failed");
      setErrorMessage(
        "Merchant address must be a Stellar public key starting with G."
      );
      return false;
    }

    if (!merchantBillVnd || Number(merchantBillVnd) <= 0) {
      setTransactionStatus("Failed");
      setErrorMessage("Please enter a valid merchant bill amount.");
      return false;
    }

    return true;
  }

  function confirmStablecoinPayment() {
    if (!publicKey) {
      setTransactionStatus("Failed");
      setErrorMessage("Please connect your wallet before making a payment.");
      return;
    }

    if (!validateCommonPaymentInput()) {
      return;
    }

    resetError();
    setTransactionStatus("Success");
    setPaymentId(`STABLE-${Date.now()}`);

    setPaymentMessage(
      `${selectedStablecoin} payment simulation completed. User pays approximately ${formatPayAmount(
        userPayAmount,
        selectedStablecoin
      )} ${selectedStablecoin}. Merchant receives ${formatVnd(
        billAmount
      )} VND.`
    );
  }

  function confirmFiatPayment() {
    if (!validateCommonPaymentInput()) {
      return;
    }

    resetError();
    setTransactionStatus("Success");
    setPaymentId(`FIAT-${Date.now()}`);

    setPaymentMessage(
      `Fiat payment simulation completed. User pays approximately ${formatPayAmount(
        userPayAmount,
        selectedFiat
      )} ${selectedFiat}. Merchant receives ${formatVnd(billAmount)} VND.`
    );
  }

  function handleConfirmPayment() {
    if (paymentMethod === "stablecoin") {
      confirmStablecoinPayment();
      return;
    }

    confirmFiatPayment();
  }

  return (
    <main className="app">
      <section className="card">
        <div className="header">
          <p className="badge">Stellar Testnet · Level 4</p>

          <h1>Stellar QR Pay</h1>

          <p className="description">
            Scan a merchant QR, review the VND bill, choose a payment method,
            and confirm the payment. The app calculates how much the user needs
            to pay.
          </p>
        </div>

        <div className="block">
          <h2>1. Connect Wallet</h2>

          <p className="small-text center">{walletKitStatus}</p>

          <div
            ref={walletButtonRef}
            className="kit-button-wrapper"
            onClick={handleWalletKitClick}
          ></div>

          {publicKey && (
            <div className="wallet-card">
              <div>
                <p className="label">Connected Wallet</p>
                <p>{shortAddress(publicKey)}</p>
              </div>

              <div>
                <p className="label">Network Fee Balance</p>
                <p>{Number(xlmBalance).toFixed(2)} XLM</p>
              </div>

              <p className="small-text center">
                XLM is shown as the network fee balance. The payment method is
                selected separately below.
              </p>
            </div>
          )}
        </div>

        <div className="block">
          <h2>2. Merchant Bill</h2>

          <div className="qr-placeholder">
            <div className="qr-box">QR</div>
            <p>
              In a real app, scanning the QR would fill merchant address and
              bill amount automatically. For this demo, paste the merchant
              address and bill amount below.
            </p>
          </div>

          <label>Merchant Address</label>
          <input
            value={merchantAddress}
            onChange={(event) => setMerchantAddress(event.target.value.trim())}
            placeholder="Paste merchant Stellar address"
          />

          <label>Merchant Bill Amount</label>
          <input
            value={merchantBillVnd}
            onChange={(event) => {
              setMerchantBillVnd(event.target.value);
              resetPaymentResult();
            }}
            placeholder="Enter VND bill amount, e.g. 24000"
          />

          <div className="result-box">
            <p className="label">Merchant Receives</p>
            <p>
              {billAmount > 0
                ? `${formatVnd(billAmount)} VND`
                : "Enter bill amount"}
            </p>
          </div>
        </div>

        <div className="block">
          <h2>3. Choose Payment Method</h2>

          <label>Pay Currency Type</label>
          <div className="method-grid">
            <button
              type="button"
              className={
                paymentMethod === "stablecoin"
                  ? "selector-button active"
                  : "selector-button"
              }
              onClick={() => {
                setPaymentMethod("stablecoin");
                resetPaymentResult();
              }}
            >
              Stablecoin / Crypto
            </button>

            <button
              type="button"
              className={
                paymentMethod === "fiat"
                  ? "selector-button active"
                  : "selector-button"
              }
              onClick={() => {
                setPaymentMethod("fiat");
                resetPaymentResult();
              }}
            >
              Fiat
            </button>
          </div>

          {paymentMethod === "stablecoin" && (
            <div className="asset-box">
              <p className="label">Choose Stablecoin / Crypto</p>

              <div className="asset-grid">
                <button
                  type="button"
                  className={
                    selectedStablecoin === "USDC"
                      ? "asset-active"
                      : "asset-button"
                  }
                  onClick={() => {
                    setSelectedStablecoin("USDC");
                    resetPaymentResult();
                  }}
                >
                  USDC
                </button>

                <button
                  type="button"
                  className={
                    selectedStablecoin === "USDT"
                      ? "asset-active"
                      : "asset-button"
                  }
                  onClick={() => {
                    setSelectedStablecoin("USDT");
                    resetPaymentResult();
                  }}
                >
                  USDT
                </button>

                <button
                  type="button"
                  className={
                    selectedStablecoin === "ETH"
                      ? "asset-active"
                      : "asset-button"
                  }
                  onClick={() => {
                    setSelectedStablecoin("ETH");
                    resetPaymentResult();
                  }}
                >
                  ETH
                </button>
              </div>

              <p className="small-text center">
                Product-level payment simulation. Level 4 smart contract proof
                is documented separately through QRUSD testnet settlement.
              </p>
            </div>
          )}

          {paymentMethod === "fiat" && (
            <div className="asset-box">
              <p className="label">Choose Fiat Currency</p>

              <div className="asset-grid">
                <button
                  type="button"
                  className={
                    selectedFiat === "USD" ? "asset-active" : "asset-button"
                  }
                  onClick={() => {
                    setSelectedFiat("USD");
                    resetPaymentResult();
                  }}
                >
                  USD
                </button>

                <button
                  type="button"
                  className={
                    selectedFiat === "VND" ? "asset-active" : "asset-button"
                  }
                  onClick={() => {
                    setSelectedFiat("VND");
                    resetPaymentResult();
                  }}
                >
                  VND
                </button>

                <button
                  type="button"
                  className={
                    selectedFiat === "EUR" ? "asset-active" : "asset-button"
                  }
                  onClick={() => {
                    setSelectedFiat("EUR");
                    resetPaymentResult();
                  }}
                >
                  EUR
                </button>
              </div>

              <p className="small-text center">
                Fiat mode is a product-flow simulation. In production, this
                would require a bank, card, e-wallet, or payment gateway
                partner.
              </p>
            </div>
          )}

          <div className="result-box">
            <p className="label">Exchange Rate</p>
            <p>
              1 {currentPayCurrency} ≈ {formatVnd(currentExchangeRate)} VND
            </p>

            <p className="label">User Pays</p>
            <p>
              {billAmount > 0
                ? `${formatPayAmount(
                    userPayAmount,
                    currentPayCurrency
                  )} ${currentPayCurrency}`
                : "Enter bill amount to calculate payment"}
            </p>

            <p className="label">Merchant Receives</p>
            <p>
              {billAmount > 0
                ? `${formatVnd(billAmount)} VND`
                : "Enter bill amount"}
            </p>
          </div>

          <button onClick={handleConfirmPayment}>Confirm Payment</button>
        </div>

        <div className="block">
          <h2>4. Payment Receipt</h2>

          <div className={`receipt-box ${transactionStatus.toLowerCase()}`}>
            <p className="label">Payment Status</p>
            <p className="status-text">{transactionStatus}</p>

            <p className="label">Message</p>
            <p>{paymentMessage}</p>

            {paymentId && (
              <>
                <p className="label">Payment Reference ID</p>
                <p>{paymentId}</p>
              </>
            )}

            {billAmount > 0 && (
              <>
                <p className="label">Merchant Bill</p>
                <p>{formatVnd(billAmount)} VND</p>

                <p className="label">User Pays</p>
                <p>
                  {formatPayAmount(userPayAmount, currentPayCurrency)}{" "}
                  {currentPayCurrency}
                </p>
              </>
            )}

            {merchantAddress && (
              <>
                <p className="label">Merchant</p>
                <p className="break">{merchantAddress}</p>
              </>
            )}

            {publicKey && (
              <>
                <p className="label">Payer Wallet</p>
                <p className="break">{publicKey}</p>
              </>
            )}

            <p className="label">Payment Method</p>
            <p>
              {paymentMethod === "stablecoin" ? "Stablecoin / Crypto" : "Fiat"}
            </p>

            <p className="label">Network</p>
            <p>{LEVEL4_NETWORK || "testnet"}</p>
          </div>

          {errorMessage && (
            <div className="error-box">
              <p className="label">Error Message</p>
              <p>{errorMessage}</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default App;