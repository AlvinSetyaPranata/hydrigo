export const sensorRegistryAbi = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'recordId', type: 'bytes32' },
      { indexed: false, internalType: 'string', name: 'deviceId', type: 'string' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'ph', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'ec', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'waterTemp', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'humidity', type: 'uint256' }
    ],
    name: 'ReadingRecorded',
    type: 'event'
  },
  {
    inputs: [
      { internalType: 'string', name: 'deviceId', type: 'string' },
      { internalType: 'uint256', name: 'timestamp', type: 'uint256' },
      { internalType: 'uint256', name: 'ph', type: 'uint256' },
      { internalType: 'uint256', name: 'ec', type: 'uint256' },
      { internalType: 'uint256', name: 'waterTemp', type: 'uint256' },
      { internalType: 'uint256', name: 'humidity', type: 'uint256' }
    ],
    name: 'recordReading',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
]
