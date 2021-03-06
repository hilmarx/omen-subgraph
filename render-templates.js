const fs = require('fs-extra');
const mustache = require('mustache');

module.exports = function(callback) {
  (async () => {
    const networkType = await web3.eth.net.getNetworkType();
    const templateData = {
      network: {
        main: 'mainnet',
        private: 'development',
      }[networkType] || networkType,
      nuancedBinaryTemplateId: {
        main: 6,
        rinkeby: 5,
      }[networkType] || 5,
    };

    for(const contractName of [
      'FPMMDeterministicFactory',
      'FixedProductMarketMaker',
      'ConditionalTokens',
      'Realitio',
      'RealitioProxy',
      'RealitioScalarAdapter',
      'ERC20Detailed',
      'DXTokenRegistry',
      'GeneralizedTCR',
      'UniswapV2Factory',
      'UniswapV2Pair',
      'WETH9',
      'DAI',
      'USDC',
      'USDT',
    ]) {
      const { abi } = fs.readJsonSync(`build/contracts/${contractName}.json`);
      fs.outputJsonSync(`abis/${contractName}.json`, abi, { spaces: 2 });

      const C = artifacts.require(contractName);
      try {
        const { address } = C;
        templateData[contractName] = {
          address,
          addressLowerCase: address.toLowerCase(),
          startBlock: (
            await web3.eth.getTransactionReceipt(C.transactionHash)
          ).blockNumber,
        };
      } catch (e) {}
    }

    for (const templatedFileDesc of [
      ['subgraph', 'yaml'],
      ['src/utils/token', 'ts'],
      ['src/FPMMDeterministicFactoryMapping', 'ts'],
      ['src/ConditionalTokensMapping', 'ts'],
      ['src/RealitioMapping', 'ts'],
      ['src/UniswapV2PairMapping', 'ts'],
    ]) {
      const template = fs.readFileSync(`${templatedFileDesc[0]}.template.${templatedFileDesc[1]}`).toString();
      fs.writeFileSync(
        `${templatedFileDesc[0]}.${templatedFileDesc[1]}`,
        mustache.render(template, templateData),
      );
    }
  })().then(() => callback(), callback);
};
