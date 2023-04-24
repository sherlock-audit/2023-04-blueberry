
# Blueberry Update contest details

- Join [Sherlock Discord](https://discord.gg/MABEWyASkp)
- Submit findings using the issue page in your private contest repo (label issues as med or high)
- [Read for more details](https://docs.sherlock.xyz/audits/watsons)

# Q&A

### Q: On what chains are the smart contracts going to be deployed?
Mainnet, Arbitrum
___

### Q: Which ERC20 tokens do you expect will interact with the smart contracts? 
Whitelisted
___

### Q: Which ERC721 tokens do you expect will interact with the smart contracts? 
Uni-v3 LP tokens, whitelisted
___

### Q: Which ERC777 tokens do you expect will interact with the smart contracts? 
none
___

### Q: Are there any FEE-ON-TRANSFER tokens interacting with the smart contracts?

none
___

### Q: Are there any REBASING tokens interacting with the smart contracts?

none
___

### Q: Are the admins of the protocols your contracts integrate with (if any) TRUSTED or RESTRICTED?
Trusted
___

### Q: Is the admin/owner of the protocol/contracts TRUSTED or RESTRICTED?
Trusted
___

### Q: Are there any additional protocol roles? If yes, please explain in detail:
none
___

### Q: Is the code/contract expected to comply with any EIPs? Are there specific assumptions around adhering to those EIPs that Watsons should be aware of?
none
___

### Q: Please list any known issues/acceptable risks that should not result in a valid finding.
- Rebasing tokens, tokens that change balance on transfer, with token burns, etc, are not compatible with the system and should not be whitelisted.

- Centralization risk is known: the DAO multi-sig for the protocol is able to set the various configurations for the protocol. 


___

### Q: Please provide links to previous audits (if any).
Sherlock audit - https://github.com/sherlock-audit/2023-02-blueberry-judging/issues
___

### Q: Are there any off-chain mechanisms or off-chain procedures for the protocol (keeper bots, input validation expectations, etc)?
none
___

### Q: In case of external protocol integrations, are the risks of external contracts pausing or executing an emergency withdrawal acceptable? If not, Watsons will submit issues related to these situations that can harm your protocol's functionality.
We utilize chainlink price feeds as the primary source, if they are paused it may result in stale pricing or reverting transactions. But the system utilizes an aggregated oracle approach to avoid those issues.
___



# Audit scope


[blueberry-core @ 25cf493e536e7c5d895bb7c712ce6ba0f3cb03c9](https://github.com/Blueberryfi/blueberry-core/tree/25cf493e536e7c5d895bb7c712ce6ba0f3cb03c9)
- [blueberry-core/contracts/BlueBerryBank.sol](blueberry-core/contracts/BlueBerryBank.sol)
- [blueberry-core/contracts/FeeManager.sol](blueberry-core/contracts/FeeManager.sol)
- [blueberry-core/contracts/ProtocolConfig.sol](blueberry-core/contracts/ProtocolConfig.sol)
- [blueberry-core/contracts/interfaces/IBank.sol](blueberry-core/contracts/interfaces/IBank.sol)
- [blueberry-core/contracts/interfaces/IBaseOracle.sol](blueberry-core/contracts/interfaces/IBaseOracle.sol)
- [blueberry-core/contracts/interfaces/ICoreOracle.sol](blueberry-core/contracts/interfaces/ICoreOracle.sol)
- [blueberry-core/contracts/interfaces/IERC20Wrapper.sol](blueberry-core/contracts/interfaces/IERC20Wrapper.sol)
- [blueberry-core/contracts/interfaces/IFeeManager.sol](blueberry-core/contracts/interfaces/IFeeManager.sol)
- [blueberry-core/contracts/interfaces/IHardVault.sol](blueberry-core/contracts/interfaces/IHardVault.sol)
- [blueberry-core/contracts/interfaces/IProtocolConfig.sol](blueberry-core/contracts/interfaces/IProtocolConfig.sol)
- [blueberry-core/contracts/interfaces/ISoftVault.sol](blueberry-core/contracts/interfaces/ISoftVault.sol)
- [blueberry-core/contracts/interfaces/IWERC20.sol](blueberry-core/contracts/interfaces/IWERC20.sol)
- [blueberry-core/contracts/interfaces/IWETH.sol](blueberry-core/contracts/interfaces/IWETH.sol)
- [blueberry-core/contracts/interfaces/IWIchiFarm.sol](blueberry-core/contracts/interfaces/IWIchiFarm.sol)
- [blueberry-core/contracts/interfaces/balancer/IBalancerPool.sol](blueberry-core/contracts/interfaces/balancer/IBalancerPool.sol)
- [blueberry-core/contracts/interfaces/band/IStdReference.sol](blueberry-core/contracts/interfaces/band/IStdReference.sol)
- [blueberry-core/contracts/interfaces/chainlink/IFeedRegistry.sol](blueberry-core/contracts/interfaces/chainlink/IFeedRegistry.sol)
- [blueberry-core/contracts/interfaces/compound/ICErc20.sol](blueberry-core/contracts/interfaces/compound/ICErc20.sol)
- [blueberry-core/contracts/interfaces/compound/ICErc20_2.sol](blueberry-core/contracts/interfaces/compound/ICErc20_2.sol)
- [blueberry-core/contracts/interfaces/compound/ICEtherEx.sol](blueberry-core/contracts/interfaces/compound/ICEtherEx.sol)
- [blueberry-core/contracts/interfaces/compound/IComptroller.sol](blueberry-core/contracts/interfaces/compound/IComptroller.sol)
- [blueberry-core/contracts/interfaces/curve/ICurvePool.sol](blueberry-core/contracts/interfaces/curve/ICurvePool.sol)
- [blueberry-core/contracts/interfaces/curve/ICurveRegistry.sol](blueberry-core/contracts/interfaces/curve/ICurveRegistry.sol)
- [blueberry-core/contracts/interfaces/curve/ILiquidityGauge.sol](blueberry-core/contracts/interfaces/curve/ILiquidityGauge.sol)
- [blueberry-core/contracts/interfaces/ichi/IICHIVault.sol](blueberry-core/contracts/interfaces/ichi/IICHIVault.sol)
- [blueberry-core/contracts/interfaces/ichi/IICHIVaultFactory.sol](blueberry-core/contracts/interfaces/ichi/IICHIVaultFactory.sol)
- [blueberry-core/contracts/interfaces/ichi/IIchiFarm.sol](blueberry-core/contracts/interfaces/ichi/IIchiFarm.sol)
- [blueberry-core/contracts/interfaces/ichi/IIchiV2.sol](blueberry-core/contracts/interfaces/ichi/IIchiV2.sol)
- [blueberry-core/contracts/interfaces/sushi/IMasterChef.sol](blueberry-core/contracts/interfaces/sushi/IMasterChef.sol)
- [blueberry-core/contracts/libraries/BBMath.sol](blueberry-core/contracts/libraries/BBMath.sol)
- [blueberry-core/contracts/libraries/UniV3/UniV3WrappedLib.sol](blueberry-core/contracts/libraries/UniV3/UniV3WrappedLib.sol)
- [blueberry-core/contracts/libraries/UniV3/UniV3WrappedLibMockup.sol](blueberry-core/contracts/libraries/UniV3/UniV3WrappedLibMockup.sol)
- [blueberry-core/contracts/mock/MockERC20.sol](blueberry-core/contracts/mock/MockERC20.sol)
- [blueberry-core/contracts/mock/MockFeedRegistry.sol](blueberry-core/contracts/mock/MockFeedRegistry.sol)
- [blueberry-core/contracts/mock/MockIchiFarm.sol](blueberry-core/contracts/mock/MockIchiFarm.sol)
- [blueberry-core/contracts/mock/MockIchiV2.sol](blueberry-core/contracts/mock/MockIchiV2.sol)
- [blueberry-core/contracts/mock/MockIchiVault.sol](blueberry-core/contracts/mock/MockIchiVault.sol)
- [blueberry-core/contracts/mock/MockOracle.sol](blueberry-core/contracts/mock/MockOracle.sol)
- [blueberry-core/contracts/mock/MockWETH.sol](blueberry-core/contracts/mock/MockWETH.sol)
- [blueberry-core/contracts/oracle/AggregatorOracle.sol](blueberry-core/contracts/oracle/AggregatorOracle.sol)
- [blueberry-core/contracts/oracle/BandAdapterOracle.sol](blueberry-core/contracts/oracle/BandAdapterOracle.sol)
- [blueberry-core/contracts/oracle/BaseAdapter.sol](blueberry-core/contracts/oracle/BaseAdapter.sol)
- [blueberry-core/contracts/oracle/ChainlinkAdapterOracle.sol](blueberry-core/contracts/oracle/ChainlinkAdapterOracle.sol)
- [blueberry-core/contracts/oracle/CoreOracle.sol](blueberry-core/contracts/oracle/CoreOracle.sol)
- [blueberry-core/contracts/oracle/IchiVaultOracle.sol](blueberry-core/contracts/oracle/IchiVaultOracle.sol)
- [blueberry-core/contracts/oracle/UniswapV2Oracle.sol](blueberry-core/contracts/oracle/UniswapV2Oracle.sol)
- [blueberry-core/contracts/oracle/UniswapV3AdapterOracle.sol](blueberry-core/contracts/oracle/UniswapV3AdapterOracle.sol)
- [blueberry-core/contracts/oracle/UsingBaseOracle.sol](blueberry-core/contracts/oracle/UsingBaseOracle.sol)
- [blueberry-core/contracts/spell/BasicSpell.sol](blueberry-core/contracts/spell/BasicSpell.sol)
- [blueberry-core/contracts/spell/IchiSpell.sol](blueberry-core/contracts/spell/IchiSpell.sol)
- [blueberry-core/contracts/utils/BlueBerryConst.sol](blueberry-core/contracts/utils/BlueBerryConst.sol)
- [blueberry-core/contracts/utils/BlueBerryErrors.sol](blueberry-core/contracts/utils/BlueBerryErrors.sol)
- [blueberry-core/contracts/utils/ERC1155NaiveReceiver.sol](blueberry-core/contracts/utils/ERC1155NaiveReceiver.sol)
- [blueberry-core/contracts/vault/HardVault.sol](blueberry-core/contracts/vault/HardVault.sol)
- [blueberry-core/contracts/vault/SoftVault.sol](blueberry-core/contracts/vault/SoftVault.sol)
- [blueberry-core/contracts/wrapper/WERC20.sol](blueberry-core/contracts/wrapper/WERC20.sol)
- [blueberry-core/contracts/wrapper/WIchiFarm.sol](blueberry-core/contracts/wrapper/WIchiFarm.sol)
- [blueberry-core/contracts/wrapper/WAuraPools.sol](blueberry-core/contracts/wrapper/WAuraPools.sol)
- [blueberry-core/contracts/wrapper/WConvexPools.sol](blueberry-core/contracts/wrapper/WConvexPools.sol)
- [blueberry-core/contracts/wrapper/WCurveGauge.sol](blueberry-core/contracts/wrapper/WCurveGauge.sol)
- [blueberry-core/contracts/utils/EnsureApprove.sol](blueberry-core/contracts/utils/EnsureApprove.sol)
- [blueberry-core/contracts/spell/AuraSpell.sol](blueberry-core/contracts/spell/AuraSpell.sol)
- [blueberry-core/contracts/spell/ConvexSpell.sol](blueberry-core/contracts/spell/ConvexSpell.sol)
- [blueberry-core/contracts/spell/CurveSpell.sol](blueberry-core/contracts/spell/CurveSpell.sol)
- [blueberry-core/contracts/spell/ShortLongSpell.sol](blueberry-core/contracts/spell/ShortLongSpell.sol)
- [blueberry-core/contracts/oracle/CurveOracle.sol](blueberry-core/contracts/oracle/CurveOracle.sol)
- [blueberry-core/contracts/oracle/BaseOracleExt.sol](blueberry-core/contracts/oracle/BaseOracleExt.sol)
- [blueberry-core/contracts/oracle/BalancerPairOracle.sol](blueberry-core/contracts/oracle/BalancerPairOracle.sol)
- [blueberry-core/contracts/libraries/Paraswap/Utils.sol](blueberry-core/contracts/libraries/Paraswap/Utils.sol)
- [blueberry-core/contracts/libraries/Paraswap/PSwapLib.sol](blueberry-core/contracts/libraries/Paraswap/PSwapLib.sol)
- [blueberry-core/contracts/interfaces/uniswap/IUniswapV2Router02.sol](blueberry-core/contracts/interfaces/uniswap/IUniswapV2Router02.sol)
- [blueberry-core/contracts/interfaces/uniswap/ISwapRouter.sol](blueberry-core/contracts/interfaces/uniswap/ISwapRouter.sol)
- [blueberry-core/contracts/interfaces/paraswap/IParaswap.sol](blueberry-core/contracts/interfaces/paraswap/IParaswap.sol)
- [blueberry-core/contracts/interfaces/curve/ICurveGaugeController.sol](blueberry-core/contracts/interfaces/curve/ICurveGaugeController.sol)
- [blueberry-core/contracts/interfaces/curve/ICurveFactory.sol](blueberry-core/contracts/interfaces/curve/ICurveFactory.sol)
- [blueberry-core/contracts/interfaces/curve/ICurveCryptoSwapRegistry.sol](blueberry-core/contracts/interfaces/curve/ICurveCryptoSwapRegistry.sol)
- [blueberry-core/contracts/interfaces/curve/ICurveCryptoFactory.sol](blueberry-core/contracts/interfaces/curve/ICurveCryptoFactory.sol)
- [blueberry-core/contracts/interfaces/curve/ICurveAddressProvider.sol](blueberry-core/contracts/interfaces/curve/ICurveAddressProvider.sol)
- [blueberry-core/contracts/interfaces/convex/IRewarder.sol](blueberry-core/contracts/interfaces/convex/IRewarder.sol)
- [blueberry-core/contracts/interfaces/convex/ICvxPools.sol](blueberry-core/contracts/interfaces/convex/ICvxPools.sol)
- [blueberry-core/contracts/interfaces/balancer/IBalancerVault.sol](blueberry-core/contracts/interfaces/balancer/IBalancerVault.sol)
- [blueberry-core/contracts/interfaces/aura/IAuraRewarder.sol](blueberry-core/contracts/interfaces/aura/IAuraRewarder.sol)
- [blueberry-core/contracts/interfaces/aura/IAuraPools.sol](blueberry-core/contracts/interfaces/aura/IAuraPools.sol)
- [blueberry-core/contracts/interfaces/IWCurveGauge.sol](blueberry-core/contracts/interfaces/IWCurveGauge.sol)
- [blueberry-core/contracts/interfaces/IWConvexPools.sol](blueberry-core/contracts/interfaces/IWConvexPools.sol)
- [blueberry-core/contracts/interfaces/IWAuraPools.sol](blueberry-core/contracts/interfaces/IWAuraPools.sol)
- [blueberry-core/contracts/interfaces/ICurveOracle.sol](blueberry-core/contracts/interfaces/ICurveOracle.sol)


