import type { Low } from 'lowdb/lib/core/Low';
import { JSONFilePreset } from 'lowdb/node';

type Data = {
  wallets: { email: string; embeddedWalletId: string; createdAt: string }[];
};

export class WalletDatabase {
  private db: Low<Data> | undefined;

  constructor(dbName: string = 'wallets.json') {
    this.init(dbName);
  }

  private async init(dbName: string) {
    const defaultData: Data = { wallets: [] };
    this.db = await JSONFilePreset<Data>(dbName, defaultData);
  }

  /**
   * Saves or updates a user wallet mapping.
   */
  public async saveWallet(email: string, walletId: string): Promise<void> {
    if (!this.db) {
      await this.init('wallets.json');
    }

    await this.db?.update(({ wallets }: Data) => {
      const existing = wallets.find((w) => w.email === email);
      if (existing) {
        existing.embeddedWalletId = walletId;
      } else {
        wallets.push({
          email,
          embeddedWalletId: walletId,
          createdAt: new Date().toISOString(),
        });
      }
    });
  }

  /**
   * Retrieve a wallet ID by email
   */
  public async getWalletByEmail(email: string): Promise<string | null> {
    if (!this.db) {
      await this.init('wallets.json');
    }

    const record = this.db?.data.wallets.find((w: { email: string }) => w.email === email);
    return record ? record.embeddedWalletId : null;
  }
}
