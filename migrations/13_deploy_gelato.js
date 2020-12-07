const GelatoCore = artifacts.require('GelatoCore');
const GelatoGasPriceOracle = artifacts.require('GelatoGasPriceOracle');

module.exports = async function(deployer) {
  const ORACLE_REQUEST_DATA = '0x50d25bcd'; // latestAnswer() selector
  const GELATO_MAX_GAS = 7000000;
  const INTERNAL_GAS_REQUIREMENT = 100000;
  const MIN_EXECUTOR_STAKE = 10; // 1 Ether
  const EXECUTOR_SUCCESS_SHARE = 5;
  const SYS_ADMIN_SUCCESS_SHARE = 5;

  await deployer.deploy(GelatoGasPriceOracle, 21);
  await deployer.deploy(GelatoCore, {
    gelatoGasPriceOracle: GelatoGasPriceOracle.address,
    oracleRequestData: ORACLE_REQUEST_DATA,
    gelatoMaxGas: GELATO_MAX_GAS,
    internalGasRequirement: INTERNAL_GAS_REQUIREMENT,
    minExecutorStake: MIN_EXECUTOR_STAKE,
    executorSuccessShare: EXECUTOR_SUCCESS_SHARE,
    sysAdminSuccessShare: SYS_ADMIN_SUCCESS_SHARE,
    totalSuccessShare: EXECUTOR_SUCCESS_SHARE + SYS_ADMIN_SUCCESS_SHARE,
  });
};
