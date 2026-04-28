const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

const QR_PAY_WASM =
  "contracts\\qr_payment\\target\\wasm32v1-none\\release\\qr_payment.wasm";

const QR_TOKEN_WASM =
  "contracts\\qr_token\\target\\wasm32v1-none\\release\\qr_token.wasm";

const SOURCE = "alice";
const NETWORK = "testnet";

function run(command) {
  console.log(`\n> ${command}\n`);

  return execSync(command, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

function runVisible(command) {
  console.log(`\n> ${command}\n`);

  return execSync(command, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "inherit",
  });
}

function extractContractId(output) {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const contractId = [...lines]
    .reverse()
    .find((line) => /^C[A-Z0-9]{55}$/.test(line));

  if (!contractId) {
    console.log("\nRaw deploy output:\n");
    console.log(output);
    throw new Error("Could not find valid contract ID in deploy output.");
  }

  return contractId;
}

function extractHash(output) {
  const match = output.match(/[a-f0-9]{64}/i);
  return match ? match[0] : "";
}

function writeContractInfo({
  qrPayContractId,
  qrTokenContractId,
  qrPayDeployHash,
  qrTokenDeployHash,
}) {
  const contractInfoPath = path.join(ROOT, "src", "contractInfo.js");

  const content = `export const LEVEL4_QR_PAY_CONTRACT_ID =
  "${qrPayContractId}";

export const LEVEL4_QRUSD_TOKEN_CONTRACT_ID =
  "${qrTokenContractId}";

export const LEVEL4_QR_PAY_DEPLOY_HASH =
  "${qrPayDeployHash}";

export const LEVEL4_QRUSD_TOKEN_DEPLOY_HASH =
  "${qrTokenDeployHash}";

export const LEVEL4_NETWORK = "testnet";
`;

  fs.writeFileSync(contractInfoPath, content, "utf8");

  console.log(`\nUpdated ${contractInfoPath}`);
}

function main() {
  console.log("\nStarting Level 4 automated deployment...\n");

  console.log("Building QRUSD token contract...");
  runVisible("cd contracts\\qr_token && stellar contract build");

  console.log("Building QR Pay contract...");
  runVisible("cd contracts\\qr_payment && stellar contract build");

  console.log("\nDeploying QRUSD token contract...");
  const tokenDeployOutput = run(
    `stellar contract deploy --wasm ${QR_TOKEN_WASM} --source ${SOURCE} --network ${NETWORK}`
  );

  console.log(tokenDeployOutput);

  const qrTokenContractId = extractContractId(tokenDeployOutput);
  const qrTokenDeployHash = extractHash(tokenDeployOutput);

  console.log("\nDeploying QR Pay contract...");
  const qrPayDeployOutput = run(
    `stellar contract deploy --wasm ${QR_PAY_WASM} --source ${SOURCE} --network ${NETWORK}`
  );

  console.log(qrPayDeployOutput);

  const qrPayContractId = extractContractId(qrPayDeployOutput);
  const qrPayDeployHash = extractHash(qrPayDeployOutput);

  writeContractInfo({
    qrPayContractId,
    qrTokenContractId,
    qrPayDeployHash,
    qrTokenDeployHash,
  });

  console.log("\nLevel 4 deployment completed successfully.\n");

  console.log({
    qrPayContractId,
    qrTokenContractId,
    qrPayDeployHash,
    qrTokenDeployHash,
  });
}

main();