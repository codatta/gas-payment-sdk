/**
 * Example: Gas Payment SDK usage
 *
 * Run all:     npm run example
 * Run one:     npm run example:price | example:eth-price | example:quote | example:prepare | example:status | example:submit
 *
 * Env: loaded from .env in project root. API_BASE_URL, RPC_URL, CHAIN_ID, ENTRY_POINT_ADDRESS,
 *      ERC3009_TOKEN_ADDRESS, PAYMENT_TARGET_CONTRACT,
 *      SENDER, TARGET, CALL_DATA, REQUEST_ID,
 *      SENDER_PRIVATE_KEY (for submit: sign userOpHash locally), or SUBMIT_SIGNATURE (manual hex)
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";

import {
  GasPaymentClient,
  createProvider,
  ERC20_BALANCE_OF_ABI,
  buildTransferWithAuthorizationTypedData,
  buildErc3009PaymasterAndData,
  calculatePaymentAmount,
  fetchEip712DomainFromToken,
} from "../src";
import type { TransferWithAuthorizationTypedData } from "../src";
import { privateKeyToAccount } from "viem/accounts";
import { encodeFunctionData, hexToBytes } from "viem";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable ${name} in .env`);
  }
  return value;
}

const SET_UINT256_ABI = [
  {
    name: "set",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_value", type: "uint256" }],
    outputs: [],
  },
] as const;

function randomUint256(): bigint {
  const bytes = new Uint8Array(32);
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 32; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return BigInt("0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join(""));
}

function getClient(): GasPaymentClient {
  const apiBaseUrl = requireEnv("API_BASE_URL");
  const rpcUrl = requireEnv("RPC_URL");
  const chainId = parseInt(requireEnv("CHAIN_ID"), 10);
  const entryPointAddress = requireEnv("ENTRY_POINT_ADDRESS") as `0x${string}`;
  const erc3009TokenAddress = requireEnv("ERC3009_TOKEN_ADDRESS") as `0x${string}`;
  const paymentTargetContract = requireEnv("PAYMENT_TARGET_CONTRACT") as `0x${string}`;

  return new GasPaymentClient({
    apiBaseUrl,
    rpcUrl,
    chainId,
    entryPointAddress,
    erc3009TokenAddress,
    paymentTargetContract,
  });
}

async function cmdPrice(): Promise<void> {
  const client = getClient();
  console.log("getTokenPrice()");
  try {
    const tokenPrice = await client.getTokenPrice({});
    console.log("  tokenPerETH:   ", tokenPrice.tokenPerETH.toString());
  } catch (e) {
    console.log("  error:", (e as Error).message);
  }
}

async function cmdEthPrice(): Promise<void> {
  const client = getClient();
  console.log("getTokenPrice() — Token/ETH price from bundler API");
  try {
    const tokenPrice = await client.getTokenPrice({});
    console.log("  tokenPerETH:   ", tokenPrice.tokenPerETH.toString());
  } catch (e) {
    console.log("  error:", (e as Error).message);
  }
}

async function cmdQuote(): Promise<void> {
  const client = getClient();
  console.log("getQuote()");
  try {
    const { quote, gasPriceWei } = await client.getQuote();
    console.log("  quote:       ", quote);
    console.log("  gasPriceWei:  ", gasPriceWei.toString());
  } catch (e) {
    console.log("  error:", (e as Error).message);
  }
}

async function cmdState(): Promise<void> {
  const rpcUrl = requireEnv("RPC_URL");
  const chainId = parseInt(requireEnv("CHAIN_ID"), 10);
  const provider = createProvider(rpcUrl, chainId);
  const senderPrivateKey = process.env.SENDER_PRIVATE_KEY as `0x${string}` | undefined;
  const senderEnv = process.env.SENDER as `0x${string}` | undefined;
  if (!senderPrivateKey && !senderEnv) {
    throw new Error("SENDER_PRIVATE_KEY or SENDER must be set in .env for cmdState()");
  }
  const sender =
    senderPrivateKey && senderPrivateKey !== "0x"
      ? privateKeyToAccount(senderPrivateKey).address
      : (senderEnv as `0x${string}`);
  const token = requireEnv("ERC3009_TOKEN_ADDRESS") as `0x${string}`;
  const paymaster = requireEnv("PAYMENT_TARGET_CONTRACT") as `0x${string}`;

  console.log("query on-chain state (ETH + ERC20 balances)");
  try {
    const [senderEth, paymasterEth, senderBal, paymasterBal] = await Promise.all([
      provider.getBalance({ address: sender }),
      provider.getBalance({ address: paymaster }),
      provider.readContract({
        address: token,
        abi: ERC20_BALANCE_OF_ABI,
        functionName: "balanceOf",
        args: [sender],
      }),
      provider.readContract({
        address: token,
        abi: ERC20_BALANCE_OF_ABI,
        functionName: "balanceOf",
        args: [paymaster],
      }),
    ]);
    console.log("  token:", token);
    console.log("  sender:", sender);
    console.log("    ETH balance:", senderEth.toString());
    console.log("    token balance:", senderBal.toString());
    console.log("  paymaster/target:", paymaster);
    console.log("    ETH balance:", paymasterEth.toString());
    console.log("    token balance:", paymasterBal.toString());
  } catch (e) {
    console.log("  error querying state:", (e as Error).message);
  }
}

async function cmdPrepare(): Promise<void> {
  const client = getClient();
  const senderPrivateKey = process.env.SENDER_PRIVATE_KEY as `0x${string}` | undefined;
  const senderEnv = process.env.SENDER as `0x${string}` | undefined;
  if (!senderPrivateKey && !senderEnv) {
    throw new Error("SENDER_PRIVATE_KEY or SENDER must be set in .env for cmdPrepare()");
  }
  const sender =
    senderPrivateKey && senderPrivateKey !== "0x"
      ? privateKeyToAccount(senderPrivateKey).address
      : (senderEnv as `0x${string}`);
  const targetEnv =
    (process.env.TARGET as `0x${string}` | undefined) ??
    (process.env.CALL_TARGET_CONTRACT as `0x${string}` | undefined);
  if (!targetEnv) {
    throw new Error("TARGET or CALL_TARGET_CONTRACT must be set in .env for cmdPrepare()");
  }
  const target = targetEnv;
  const callData = (process.env.CALL_DATA ?? "0x") as `0x${string}`;

  console.log("preparePayment({ sender, target, callData })");
  try {
    const prepared = await client.preparePayment({
      sender,
      target,
      callData,
    });
    console.log("  userOp (no sig):", {
      sender: prepared.userOp.sender,
      target: prepared.userOp.target,
      nonce: prepared.userOp.nonce.toString(),
    });
    console.log("  handleOpsTx:   ", prepared.handleOpsTx);
    console.log("  fee:           ", {
      gas: prepared.fee.gas.toString(),
      gasPriceWei: prepared.fee.gasPriceWei.toString(),
      tokenPerETH: prepared.fee.tokenPerETH.toString(),
      paymentAmount: prepared.fee.paymentAmount.toString(),
    });
    console.log("  userOpHash:    ", prepared.userOpHash);
    console.log("  erc3009Payload.to:", prepared.erc3009Payload.to);
    console.log("  erc3009 typedData:", prepared.erc3009Payload.typedData ? "present" : "absent");
  } catch (e) {
    console.log("  error:", (e as Error).message);
  }
}

async function cmdStatus(): Promise<void> {
  const client = getClient();
  const requestId = process.env.REQUEST_ID ?? "fake-request-id";
  console.log("getStatus(%s)", JSON.stringify(requestId));
  try {
    const status = await client.getStatus(requestId);
    console.log("  ", status);
  } catch (e) {
    console.log("  error:", (e as Error).message);
  }
}

async function cmdSubmit(): Promise<void> {
  const client = getClient();
  const privateKey = process.env.SENDER_PRIVATE_KEY as `0x${string}` | undefined;
  if (privateKey && privateKey !== "0x") {
    // 1. 基本环境与参与方
    console.log("submitPayment (prepare + sign with SENDER_PRIVATE_KEY + submit)");
    const account = privateKeyToAccount(privateKey);
    const sender = account.address;
    const targetEnv =
      (process.env.TARGET as `0x${string}` | undefined) ??
      (process.env.CALL_TARGET_CONTRACT as `0x${string}` | undefined);
    if (!targetEnv) {
      throw new Error("TARGET or CALL_TARGET_CONTRACT must be set in .env for cmdSubmit()");
    }
    const target = targetEnv;
    const paymaster = requireEnv("PAYMENT_TARGET_CONTRACT") as `0x${string}`;
    const paymentType = Number(process.env.PAYMASTER_TYPE ?? "1");
    const expectedSender = sender as `0x${string}`;
    const erc3009Receiver = paymaster as `0x${string}`;

    // 2. 时间窗口与随机 nonce（用于 ERC3009 授权）
    const now = Math.floor(Date.now() / 1000);
    const validAfter = Number(
      process.env.PAYMASTER_VALID_AFTER ?? String(now - 5 * 60),
    );
    const validBefore = Number(
      process.env.PAYMASTER_VALID_BEFORE ?? String(now + 10 * 60),
    );
    const nonce = (`0x${randomBytes(32).toString("hex")}` as `0x${string}`);

    // 3. 业务 callData：如果未显式提供 CALL_DATA，则对目标合约调用 set(uint256 random)
    let callData = (process.env.CALL_DATA ?? "0x") as `0x${string}`;
    if (target !== "0x0000000000000000000000000000000000000000" && callData === "0x") {
      let randomValue = randomUint256();
      console.log("randomValue", randomValue);
      callData = encodeFunctionData({
        abi: SET_UINT256_ABI,
        functionName: "set",
        args: [randomValue],
      }) as `0x${string}`;
    }
    try {
      // 4. 获取价格与 gas 限制，并计算需要的 ERC3009 支付金额（amount）
      const gasPriceWei = await client.getGasPriceWei();
      const {
        tokenPerETH,
        verificationGasLimit: verificationGasLimitFromPrice,
        preVerificationGas: preVerificationGasFromPrice,
      } = await client.getTokenPrice();
      // callGasLimit：必须显式配置 SUBMIT_CALL_GAS，或者能够成功通过 estimateGas 预估；
      // 不再在代码里静态写死默认值，以免难以排查问题。
      let callGasLimit: bigint;
      if (process.env.SUBMIT_CALL_GAS) {
        callGasLimit = BigInt(process.env.SUBMIT_CALL_GAS);
      } else {
        try {
          const rpcUrl = process.env.RPC_URL ?? "https://mainnet.base.org";
          const chainId = parseInt(process.env.CHAIN_ID ?? "8453", 10);
          const providerForGas = createProvider(rpcUrl, chainId);
          callGasLimit = await providerForGas.estimateGas({
            account: sender,
            to: target,
            data: callData,
          });
        } catch {
          throw new Error(
            "Failed to estimate call gas. Please set SUBMIT_CALL_GAS in .env or ensure TARGET/CALL_DATA are correct.",
          );
        }
      }
      const verificationGasLimit = BigInt(verificationGasLimitFromPrice ?? 100_000);
      const preVerificationGas = BigInt(preVerificationGasFromPrice ?? 50_000);
      const totalGas = callGasLimit + verificationGasLimit + preVerificationGas;
      const gasCostWei = totalGas * gasPriceWei;
      console.log("\n--- value 计算过程 ---");
      console.log("  callGasLimit:        ", callGasLimit.toString());
      console.log("  verificationGasLimit:", verificationGasLimit.toString());
      console.log("  preVerificationGas:  ", preVerificationGas.toString());
      console.log("  totalGas:            ", totalGas.toString());
      console.log("  gasPriceWei:         ", gasPriceWei.toString());
      console.log("  gasCostWei (gas*price):", gasCostWei.toString());
      console.log("  gasCostEth:          ", `${Number(gasCostWei) / 1e18} ETH`);
      console.log("  tokenPerETH:         ", tokenPerETH.toString(), "(token smallest units per 1 ETH)");
      console.log("  safetyMargin:        ", "1.2 (default 20%)");
      const amount = calculatePaymentAmount({
        gas: totalGas,
        gasPriceWei,
        tokenPerETH,
      });
      console.log("  amount (token units):", amount.toString());
      console.log("--- end ---\n");

      // 5. 构造 EIP-3009 typed data，并使用同一个私钥签名，得到 r,s,v
      const chainId = parseInt(requireEnv("CHAIN_ID"), 10);
      const erc3009Token = requireEnv("ERC3009_TOKEN_ADDRESS") as `0x${string}`;
      const rpcUrl = requireEnv("RPC_URL");
      const provider = createProvider(rpcUrl, chainId);
      // 从合约 eip712Domain() 读取 EIP-712 domain，与链上完全一致（如不可用则回退到本地配置）
      const domain = await fetchEip712DomainFromToken({
        provider,
        token: erc3009Token,
        chainId,
        fallbackName: process.env.ERC3009_TOKEN_NAME,
        fallbackVersion: process.env.ERC3009_TOKEN_VERSION,
      });

      const erc3009Typed: TransferWithAuthorizationTypedData =
        buildTransferWithAuthorizationTypedData({
          domain: {
            name: domain.name,
            version: domain.version,
            chainId: domain.chainId,
            verifyingContract: domain.verifyingContract,
          },
          from: sender,
          to: erc3009Receiver,
          value: amount,
          validAfter: BigInt(validAfter),
          validBefore: BigInt(validBefore),
          nonce,
        });

      console.log("erc3009Typed", erc3009Typed);

      const erc3009Signature = await account.signTypedData(
        erc3009Typed as unknown as any,
      );
      const sigBytes = hexToBytes(erc3009Signature as `0x${string}`);
      const r = `0x${Buffer.from(sigBytes.slice(0, 32)).toString("hex")}` as `0x${string}`;
      const s = `0x${Buffer.from(sigBytes.slice(32, 64)).toString("hex")}` as `0x${string}`;
      const v = sigBytes[64] ?? 27;
      // 6. 用签名构造 paymasterAndData，并生成最终 UserOp + 提交
      const paymasterAndData2 = buildErc3009PaymasterAndData({
        paymaster,
        paymentType,
        expectedSender,
        erc3009Receiver,
        value: amount,
        validAfter: BigInt(validAfter),
        validBefore: BigInt(validBefore),
        nonce,
        v,
        r,
        s,
      });
      const prepared2 = await client.preparePayment({
        sender,
        target,
        callData,
        callGasLimit,
        verificationGasLimit,
        preVerificationGas,
        paymasterAndData: paymasterAndData2,
      });
      const signature = await account.sign({ hash: prepared2.userOpHash as `0x${string}` });
      console.log("prepared2", signature,prepared2,hexToBytes(prepared2.userOpHash as `0x${string}`));
      const result = await client.submitPayment({
        userOp: { ...prepared2.userOp, signature },
        signature,
      });
      console.log("  requestId:", result.requestId);
    } catch (e) {
      console.log("  error:", (e as Error).message);
    }
    return;
  }

  console.log("  skipped: set SENDER_PRIVATE_KEY to sign locally and submit");
}

async function cmdAll(): Promise<void> {
  console.log("=== 1. getTokenPrice ===\n");
  await cmdPrice();
  console.log("\n=== 2. getTokenPrice (Token/ETH) ===\n");
  await cmdEthPrice();
  console.log("\n=== 3. getQuote ===\n");
  await cmdQuote();
  console.log("\n=== 4. state (before) ===\n");
  await cmdState();
  console.log("\n=== 5. preparePayment ===\n");
  await cmdPrepare();
  console.log("\n=== 6. submitPayment ===\n");
  await cmdSubmit();
  console.log("\n=== 7. state (after) ===\n");
  await cmdState();
  console.log("\n=== 8. getStatus ===\n");
  await cmdStatus();
}

function usage(): void {
  console.log(`
Usage: tsx examples/basic.ts <command>

Commands:
  price      getTokenPrice()
  eth-price  getEthPrice()
  quote      getQuote()
  prepare    preparePayment()
  state      query on-chain ERC3009 token balances
  status     getStatus(REQUEST_ID)
  submit     submitPayment() (set SENDER_PRIVATE_KEY to sign locally, or SUBMIT_SIGNATURE for manual)
  all        run all above (default)

Examples:
  npm run example
  npm run example:price
  npm run example:eth-price
  npm run example:quote
  npm run example:prepare
  npm run example:status
  npm run example:submit
`);
}

const commands: Record<string, () => Promise<void>> = {
  price: cmdPrice,
  "eth-price": cmdEthPrice,
  quote: cmdQuote,
  prepare: cmdPrepare,
  state: cmdState,
  status: cmdStatus,
  submit: cmdSubmit,
  all: cmdAll,
};

async function main() {
  const cmd = process.argv[2] ?? "all";
  if (cmd === "help" || cmd === "-h" || cmd === "--help") {
    usage();
    return;
  }
  const run = commands[cmd];
  if (!run) {
    console.error("Unknown command:", cmd);
    usage();
    process.exit(1);
  }
  await run();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
