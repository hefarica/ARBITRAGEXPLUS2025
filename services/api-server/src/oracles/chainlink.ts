import { Logger } from '../lib/logger.js';

export class ChainlinkOracle {
  private logger: Logger;
  private assets: any[];
  
  constructor(assets: any[]) {
    this.logger = new Logger('ChainlinkOracle');
    this.assets = assets;
  }
  
  async getPrices() {
    return [];
  }
}
