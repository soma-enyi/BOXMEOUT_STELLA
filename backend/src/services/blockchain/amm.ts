// backend/src/services/blockchain/amm.ts
// AMM contract interaction service

import {
  Contract,
  rpc,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Keypair,
  nativeToScVal,
  scValToNative,
} from '@stellar/stellar-sdk';

interface CreatePoolParams {
  marketId: string; // hex string (BytesN<32>)
  initialLiquidity: bigint;
}

interface CreatePoolResult {
  txHash: string;
  reserves: { yes: bigint; no: bigint };
  odds: { yes: number; no: number };
}

export class AmmService {
  private readonly rpcServer: rpc.Server;
  private readonly ammContractId: string;
  private readonly networkPassphrase: string;
  private readonly adminKeypair: Keypair;

  constructor() {
    const rpcUrl =
      process.env.STELLAR_SOROBAN_RPC_URL ??
      'https://soroban-testnet.stellar.org';

    const network =
      process.env.STELLAR_NETWORK ?? 'testnet';

    this.rpcServer = new rpc.Server(rpcUrl, {
      allowHttp: rpcUrl.includes('localhost'),
    });

    this.ammContractId =
      process.env.AMM_CONTRACT_ADDRESS ?? '';

    this.networkPassphrase =
      network === 'mainnet'
        ? Networks.PUBLIC
        : Networks.TESTNET;

    this.adminKeypair = Keypair.fromSecret(
      process.env.ADMIN_WALLET_SECRET ??
        'SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
    );
  }

  /**
   * Call AMM.create_pool(market_id, initial_liquidity)
   */
  async createPool(
    params: CreatePoolParams,
  ): Promise<CreatePoolResult> {
    if (!this.ammContractId) {
      throw new Error('AMM contract address not configured');
    }

    const contract = new Contract(this.ammContractId);
    const sourceAccount = await this.rpcServer.getAccount(
      this.adminKeypair.publicKey(),
    );

    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        contract.call(
          'create_pool',
          nativeToScVal(this.adminKeypair.publicKey(), { type: 'address' }),
          nativeToScVal(params.marketId, { type: 'bytes' }),
          nativeToScVal(params.initialLiquidity, { type: 'u128' }),
        ),
      )
      .setTimeout(30)
      .build();

    transaction.sign(this.adminKeypair);

    const response = await this.rpcServer.sendTransaction(transaction);
    
    if (response.status === 'ERROR') {
      throw new Error(`Transaction failed: ${response.errorResult}`);
    }

    // Wait for confirmation and get result
    const txHash = response.hash;
    
    // Get pool state after creation
    const poolState = await this.getPoolState(params.marketId);
    
    return {
      txHash,
      reserves: poolState.reserves,
      odds: poolState.odds,
    };
  }

  /**
   * Read-only call: get pool state
   */
  async getPoolState(
    marketId: string,
  ): Promise<{
    reserves: { yes: bigint; no: bigint };
    odds: { yes: number; no: number };
  }> {
    const contract = new Contract(this.ammContractId);
    const sourceAccount = await this.rpcServer.getAccount(
      this.adminKeypair.publicKey(),
    );

    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        contract.call(
          'get_pool_state',
          nativeToScVal(marketId, { type: 'bytes' }),
        ),
      )
      .setTimeout(30)
      .build();

    const response = await this.rpcServer.simulateTransaction(transaction);
    
    if (response.error) {
      throw new Error(`Simulation failed: ${response.error}`);
    }

    const result = response.result?.retval;
    if (!result) {
      throw new Error('No result from contract call');
    }

    // Parse the result (yes_reserve, no_reserve, total_liquidity, yes_odds, no_odds)
    const [yesReserve, noReserve, , yesOdds, noOdds] = scValToNative(result);
    
    return {
      reserves: {
        yes: BigInt(yesReserve),
        no: BigInt(noReserve),
      },
      odds: {
        yes: Number(yesOdds),
        no: Number(noOdds),
      },
    };
  }
}
