// backend/src/services/blockchain/factory.ts
// Factory contract interaction service

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

export interface CreateMarketParams {
  creator: string;
  title: string;
  description: string;
  category: string;
  closingTime: number;
  resolutionTime: number;
}

export interface CreateMarketResult {
  txHash: string;
  marketId: string;
}

export class FactoryService {
  private readonly rpcServer: rpc.Server;
  private readonly factoryContractId: string;
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

    this.factoryContractId =
      process.env.FACTORY_CONTRACT_ADDRESS ?? '';

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
   * Call Factory.create_market()
   */
  async createMarket(
    params: CreateMarketParams,
  ): Promise<CreateMarketResult> {
    if (!this.factoryContractId) {
      throw new Error('Factory contract address not configured');
    }

    const contract = new Contract(this.factoryContractId);
    const sourceAccount = await this.rpcServer.getAccount(
      this.adminKeypair.publicKey(),
    );

    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        contract.call(
          'create_market',
          nativeToScVal(params.creator, { type: 'address' }),
          nativeToScVal(params.title, { type: 'symbol' }),
          nativeToScVal(params.description, { type: 'symbol' }),
          nativeToScVal(params.category, { type: 'symbol' }),
          nativeToScVal(params.closingTime, { type: 'u64' }),
          nativeToScVal(params.resolutionTime, { type: 'u64' }),
        ),
      )
      .setTimeout(30)
      .build();

    transaction.sign(this.adminKeypair);

    const response = await this.rpcServer.sendTransaction(transaction);
    
    if (response.status === 'ERROR') {
      throw new Error(`Transaction failed: ${response.errorResult}`);
    }

    return {
      txHash: response.hash,
      marketId: 'mock-market-id', // TODO: Extract from transaction result
    };
  }

  /**
   * Get market count
   */
  async getMarketCount(): Promise<number> {
    const contract = new Contract(this.factoryContractId);
    const sourceAccount = await this.rpcServer.getAccount(
      this.adminKeypair.publicKey(),
    );

    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call('get_market_count'))
      .setTimeout(30)
      .build();

    const response = await this.rpcServer.simulateTransaction(transaction);
    
    if (response.error) {
      throw new Error(`Simulation failed: ${response.error}`);
    }

    const result = response.result?.retval;
    if (!result) {
      return 0;
    }

    return Number(scValToNative(result));
  }
}
