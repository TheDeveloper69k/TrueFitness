const ZKLib = require('node-zklib');

const ZK_IP = '192.168.1.2';
const ZK_PORT = 4370;

async function test() {
  console.log(`Connecting to ZKTeco at ${ZK_IP}:${ZK_PORT}...`);
  const zk = new ZKLib(ZK_IP, ZK_PORT, 5000, 4000);

  try {
    await zk.createSocket();
    console.log('✅ Connected! Connection type:', zk.connectionType);

    const info = await zk.getInfo();
    console.log('Device info:', info);

    await zk.disconnect();
    console.log('Disconnected.');
  } catch (err) {
    console.error('❌ Failed:', err);
  }
}

test();