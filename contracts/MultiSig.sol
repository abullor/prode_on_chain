// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/// @title MultiSig implementation to limit the operations in ProdeLogic.
/// @author Ariel Bullor
contract MultiSig {
    struct Txn {
        address to;
        bool executed;
        bytes data;
    }

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    modifier txnExists(uint256 _txnId) {
        _txnExists(_txnId);
        _;
    }

    modifier notApproved(uint256 _txnId) {
        _notApproved(_txnId);
        _;
    }

    modifier notExecuted(uint256 _txnId) {
        _notExecuted(_txnId);
        _;
    }

    address[] public owners;
    mapping(address => bool) isOwner;
    uint256 immutable public required;
    Txn[] public txns;

    mapping(uint256 => mapping(address => bool)) public approved;

    constructor(address[] memory _owners, uint256 _required) {
        require(_owners.length > 0, "Owners required");
        require(_required > 0 && _required <= _owners.length, "Invalid required number of owners");

        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];

            require(!isOwner[owner], "Owner is not unique");

            isOwner[owner] = true;
            owners.push(owner);
        }

        required = _required;
    }

    /// @notice Submits a transaction for later execution.
    function submit(address _to, bytes calldata _data) external onlyOwner returns(uint256) {
        txns.push(Txn({
            to: _to,
            data: _data,
            executed: false
        }));

        return txns.length - 1;
    }

    /// @notice Approves a transaction that should exist if it's not executed nor approved.
    function approve(uint256 _txnId) external onlyOwner txnExists(_txnId) notExecuted(_txnId) notApproved(_txnId) {
        approved[_txnId][msg.sender] = true;
    }

    /// @notice Executes a transaction if it has the required approvals and it hasn't been already executed.
    function execute(uint256 _txnId) external txnExists(_txnId) notExecuted(_txnId) {
        require(_getApprovalCount(_txnId) >= required, "Not enough approvals");

        Txn storage txn = txns[_txnId];

        txn.executed = true;

        (bool success, bytes memory result) = txn.to.call{value: 0}(txn.data);

        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    /// @notice Returns the number of approvals for a given transaction id.
    function _getApprovalCount(uint256 _txnId) private view returns (uint256 count) {
        uint256 ownersLength = owners.length;

        for (uint256 i = 0; i < ownersLength; i++) {
            if (approved[_txnId][owners[i]]) {
                unchecked {
                    ++count;
                }
            }
        }
    }

    // Modifier impls
    function _onlyOwner() private view {
        require(isOwner[msg.sender], "Not owner");
    }

    function _txnExists(uint256 _txnId) private view {
        require(_txnId < txns.length, "Txn does not exist");
    }

    function _notApproved(uint256 _txnId) private view {
        require(!approved[_txnId][msg.sender], "Txn already approved");
    }

    function _notExecuted(uint256 _txnId) private view {
        require(!txns[_txnId].executed, "Txn already executed");
    }
}