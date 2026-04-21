// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract HydrigoAnchor {
    struct ReadingAnchor {
        uint256 offchainBlockIndex;
        uint256 readingId;
        bytes32 payloadHash;
        bytes32 blockHash;
        string deviceId;
        string lettuceBedId;
        string recordedAt;
        uint256 anchoredAt;
        address anchoredBy;
    }

    mapping(uint256 => ReadingAnchor) public anchors;

    event ReadingAnchored(
        uint256 indexed offchainBlockIndex,
        uint256 indexed readingId,
        bytes32 indexed blockHash,
        bytes32 payloadHash,
        address anchoredBy
    );

    function anchorReading(
        uint256 offchainBlockIndex,
        uint256 readingId,
        bytes32 payloadHash,
        bytes32 blockHash,
        string calldata deviceId,
        string calldata lettuceBedId,
        string calldata recordedAt
    ) external {
        require(anchors[offchainBlockIndex].anchoredAt == 0, "block already anchored");

        anchors[offchainBlockIndex] = ReadingAnchor({
            offchainBlockIndex: offchainBlockIndex,
            readingId: readingId,
            payloadHash: payloadHash,
            blockHash: blockHash,
            deviceId: deviceId,
            lettuceBedId: lettuceBedId,
            recordedAt: recordedAt,
            anchoredAt: block.timestamp,
            anchoredBy: msg.sender
        });

        emit ReadingAnchored(offchainBlockIndex, readingId, blockHash, payloadHash, msg.sender);
    }
}
