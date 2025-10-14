import { ethers } from 'ethers';

console.log('TypeScript Executor Service');

async function main() {
    console.log('Executing main function...');
    // Example of using ethers
    // const provider = new ethers.JsonRpcProvider('http://localhost:8545'); // Replace with your RPC provider
    // const blockNumber = await provider.getBlockNumber();
    // console.log(`Current block number: ${blockNumber}`);
}

main().catch(error => {
    console.error('Error in executor service:', error);
    process.exit(1);
});

