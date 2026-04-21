// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract SensorRegistry {
    struct Reading {
        string deviceId;
        uint256 timestamp;
        uint256 ph;
        uint256 ec;
        uint256 waterTemp;
        uint256 humidity;
    }

    mapping(bytes32 => Reading) public readings;

    event ReadingRecorded(
        bytes32 indexed recordId,
        string deviceId,
        uint256 timestamp,
        uint256 ph,
        uint256 ec,
        uint256 waterTemp,
        uint256 humidity
    );

    function recordReading(
        string calldata deviceId,
        uint256 timestamp,
        uint256 ph,
        uint256 ec,
        uint256 waterTemp,
        uint256 humidity
    ) external returns (bytes32) {
        bytes32 recordId = keccak256(
            abi.encodePacked(deviceId, timestamp, ph, ec, waterTemp, humidity)
        );

        readings[recordId] = Reading({
            deviceId: deviceId,
            timestamp: timestamp,
            ph: ph,
            ec: ec,
            waterTemp: waterTemp,
            humidity: humidity
        });

        emit ReadingRecorded(recordId, deviceId, timestamp, ph, ec, waterTemp, humidity);

        return recordId;
    }
}
