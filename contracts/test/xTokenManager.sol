//SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";


contract xTokenManager is Initializable, OwnableUpgradeable {
  // key address corresponds to a manager 
  // of an map of fund to whether the address manages that fund
  mapping(address => mapping(address => bool)) managers;

  function initialize() external initializer {
      __Context_init_unchained();
      __Ownable_init_unchained();
  }

  /**
   * @dev Add a manager to an xAsset fund
   */
  function addManager(address manager, address fund) external onlyOwner {
    if(!managers[manager][fund]) {
      managers[manager][fund] = true;
    }
  }

  /**
   * @dev Remove a manager from an xAsset fund
   */
  function removeManager(address manager, address fund) external onlyOwner {
    require(managers[manager][fund], "Address is not manager of this fund");
    managers[manager][fund] = false;
  }

  /**
   * @dev Check if an address is a manager for a fund
   */
  function isManager(address manager, address fund) public view returns (bool) {
    return managers[manager][fund];
  }
}