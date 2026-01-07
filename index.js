const dns2 = require('dns2');
const dgram = require("dgram");
const readline = require('node:readline');

const { Packet } = dns2;
const upstreamHost = '8.8.8.8';

const blockList = [
  'youtube.com',
  'instagram.com',
  'reddit.com',
  'steam.com',
  'figma.com'  
];
let isBlocking = false;
let isBlockingStrict = false;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function sendDnsPacket(packetBuffer, upstreamPort = 53) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");

    socket.once("message", (msg) => {
      socket.close();
      resolve(msg);
    });

    socket.once("error", (err) => {
      socket.close();
      reject(err);
    });

    socket.send(packetBuffer, upstreamPort, upstreamHost, (err) => {
      if (err) {
        socket.close();
        reject(err);
      }
    });
  });
}

function takeCliInput() {
  rl.question(`>>>`, input => {
    if (input == 'block_enable') enableBlock();
    if (input == 'block_disable') disableBlock();
    if (input == 'status') statusUpdateCLI();
    if (input.startsWith('block_enable_for')){
      try {
        const parts = input.split(" ");
        enableBlockFor(parts[1]);
      } catch (err) {
        console.log(err);
      }
    };
    takeCliInput();
  });
}

function enableBlock() {
  isBlocking = true;
  isBlockingStrict = true;
}

function disableBlock() {
  isBlocking = false;
  isBlockingStrict = false;
}
  

async function enableBlockFor(time) {
  isBlocking = true;
  isBlockingStrict = false;
  console.log(time)
  await delay(time * 1000);
  if (!isBlockingStrict) isBlocking = false;
}

function statusUpdateCLI() {
  console.log("Blocking: " + isBlocking);
  console.log("Timer Active " + !isBlockingStrict);
  console.log("DNS Expected Upstream: " + upstreamHost);
}

function blockTest(request) {
  let questions = request.questions;
  let requestBlocked = questions.every(item => blockList.includes(item.name));
  if (requestBlocked && isBlocking) {
    return true;
  } else {
    return false;
  }
}

const server = dns2.createServer({
  udp: true,
  tcp: true,
  handle: async (request, send, rinfo) => {
    let output = null;
    let siteAllowed = !blockTest(request);
    if (siteAllowed){
      try {
        const packet = request.toBuffer();
        const response = await sendDnsPacket(packet);
        output = response; 
      } catch (err) {
        const failure = Packet.createResponseFromRequest(request);
        console.log(err);
        failure.header.rcode = 2;
        output = failure;
      }
    } else {
      const blocked = Packet.createResponseFromRequest(request);
      blocked.header.rcode = 5;
      output = blocked;
    }
    
    send(output);
  },
});

server.on('request', (request, response, rinfo) => {
  console.log(request.header.id, request.questions[0]);
});

server.on('requestError', (error) => {
  console.log('Client sent an invalid request', error);
});

server.on('listening', () => {
  console.log(server.addresses());
  takeCliInput();
});

server.on('close', () => {
  rl.close();
  console.log('');
  console.log('DNS Traffic Closed');
  console.log('Server Safely Shut Down');
});

server.listen({
  udp: { 
    port: 53,
    address: "127.0.0.1",
    type: "udp4",
  },
  
  tcp: { 
    port: 53,
    address: "127.0.0.1",
  },
});

//Safe Shutdown initiation
process.on('SIGTERM', () => {
  server.close();
});

process.on('SIGINT', () => {
  server.close();
});

//Skip normal RL kill and move straight to shutdown. Prevents multi CTRL+C
rl.on('SIGINT', () => {
  rl.close();
  process.kill(process.pid, 'SIGINT');
}); 

rl.on('SIGTERM', () => {
  rl.close();
  process.kill(process.pid, 'SIGTERM');
});